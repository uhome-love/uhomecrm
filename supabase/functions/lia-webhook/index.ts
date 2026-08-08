/**
 * lia-webhook — recebe eventos de mensagem do Evolution para a instância
 * dedicada da Lia (uhome-lia-canoas).
 *
 * Autenticação (dupla, conforme a versão do Evolution):
 *   - query string:  ?s=<segredo>        (principal quando o servidor não
 *                                          suporta headers customizados)
 *   - header:        x-lia-secret        (aceito sempre que vier)
 * Qualquer um dos dois válido passa. Nenhum válido → 401.
 * Segredo lido de ia_config.webhook_secret (com webhook_secret_anterior
 * aceito durante rotação).
 *
 * Checagem de instância nos dois casos: evento de instância diferente de
 * ia_config.instancia é descartado com 200 (não 401), para não envenenar o
 * retry do Evolution.
 *
 * Esta função NÃO escreve no pipeline e NÃO chama o modelo. Apenas grava em
 * ia_mensagens. Envio depende de ia_config.enviar_habilitado (Fase 2).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lia-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

function extractBody(message: Record<string, any> | null | undefined): string | null {
  if (!message) return null;
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.audioMessage?.caption ||
    null
  );
}

function mediaType(message: Record<string, any> | null | undefined): string | null {
  if (!message) return null;
  if (message.imageMessage) return "image";
  if (message.videoMessage) return "video";
  if (message.audioMessage) return "audio";
  if (message.documentMessage) return "document";
  if (message.stickerMessage) return "sticker";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: cfg } = await supabase
      .from("ia_config")
      .select("webhook_secret, webhook_secret_anterior, instancia")
      .limit(1)
      .maybeSingle();

    if (!cfg?.webhook_secret) {
      return json({ error: "webhook não configurado" }, 503);
    }

    const url = new URL(req.url);
    const fromQuery = url.searchParams.get("s") || url.searchParams.get("secret");
    const fromHeader = req.headers.get("x-lia-secret");
    const validos = [cfg.webhook_secret, cfg.webhook_secret_anterior].filter(Boolean) as string[];

    const autorizado =
      (!!fromQuery && validos.includes(fromQuery)) ||
      (!!fromHeader && validos.includes(fromHeader));

    if (!autorizado) return json({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({} as Record<string, any>));
    const instancia = payload.instance || payload.instanceName || payload.instance_name || null;

    // Instância errada: 200 silencioso, sem retry no Evolution.
    if (instancia && cfg.instancia && String(instancia) !== String(cfg.instancia)) {
      return json({ ok: true, ignored: "instancia_diferente", instancia });
    }

    const evento = payload.event || payload.type || "";
    const data = payload.data || payload.message || payload;
    const key = data?.key || {};
    const remoteJid: string = key.remoteJid || data?.remoteJid || "";

    // Grupos e broadcasts ficam de fora.
    if (!remoteJid || !remoteJid.endsWith("@s.whatsapp.net")) {
      return json({ ok: true, ignored: "jid_nao_individual" });
    }

    const telefone = normalizePhone(remoteJid.split("@")[0]);
    const last8 = telefone.slice(-8);
    const fromMe = key.fromMe === true;
    const externalId: string | null = key.id ? String(key.id) : null;

    const { data: iaLead } = await supabase
      .from("ia_leads")
      .select("id, etapa")
      .eq("telefone_last8", last8)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!iaLead) {
      // Não é lead da caixa da Lia. Registra e sai — sem tocar no pipeline.
      await supabase.from("ops_events").insert({
        fn: "lia-webhook",
        level: "info",
        category: "business",
        message: "mensagem_sem_ia_lead",
        ctx: { telefone_last8: last8, evento },
      });
      return json({ ok: true, ignored: "sem_ia_lead" });
    }

    // Idempotência por id da mensagem do WhatsApp.
    if (externalId) {
      const { data: dup } = await supabase
        .from("ia_mensagens")
        .select("id")
        .eq("evolution_message_id", externalId)
        .maybeSingle();
      if (dup) return json({ ok: true, ignored: "duplicada", ia_mensagem_id: dup.id });
    }

    const msg = data?.message || null;
    const texto = extractBody(msg);
    const tipo = mediaType(msg);

    const { data: inserted, error: insErr } = await supabase
      .from("ia_mensagens")
      .insert({
        ia_lead_id: iaLead.id,
        direcao: fromMe ? "out" : "in",
        conteudo: texto,
        tipo: tipo || "texto",
        evolution_message_id: externalId,
        idempotency_key: externalId ? `evo:${externalId}` : null,
        autor: fromMe ? "humano" : "lead",
        timestamp_origem: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("ia_mensagens insert:", insErr.message);
      return json({ ok: false, error: insErr.message }, 200);
    }

    await supabase
      .from("ia_leads")
      .update({ ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", iaLead.id);

    // Fase 2: acorda o cérebro. Ele decide sozinho se é hora (debounce, lock,
    // travas) — o webhook só avisa e não espera resposta, para nunca segurar
    // o retry do Evolution.
    if (!fromMe) {
      const brainUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/lia-brain`;
      const chamada = fetch(brainUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ action: "turno", ia_lead_id: iaLead.id }),
      })
        .then(async (r) => console.log("lia-brain:", r.status, (await r.text()).slice(0, 300)))
        .catch((err) => console.error("lia-brain trigger:", err));

      // Sem waitUntil o isolate morre junto com a resposta e o cérebro nunca roda.
      const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
        .EdgeRuntime;
      rt?.waitUntil?.(chamada);

    }

    return json({ ok: true, ia_lead_id: iaLead.id, ia_mensagem_id: inserted.id });

  } catch (e) {
    console.error("lia-webhook error:", e);
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
