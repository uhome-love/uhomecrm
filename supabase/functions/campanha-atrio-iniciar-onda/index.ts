// Inicia uma onda da Campanha Átrio: loop sequencial com cadência 5s,
// kill switch a cada 20 envios (>5% erro), guard de volume, códigos Meta 132016/131056/131057.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const TEMPLATE_NAME = "atrio_disparo";
const TEMPLATE_LANG = "pt_BR";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const IMAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/atrio/atrio_disparo_2026_05.jpg`;
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VOLUME_GUARD = 700;
const CADENCIA_MS = 5000;
const MAX_BATCH_PER_RUN = 20;
const CONTROL_SYNC_EVERY = 10;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function sendTemplate(phone: string, nome: string) {
  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: [
        { type: "header", parameters: [{ type: "image", image: { link: IMAGE_URL } }] },
        { type: "body", parameters: [{ type: "text", text: nome || "olá" }] },
      ],
    },
  };
  const resp = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify(body),
  });
  const json: any = await resp.json();
  if (!resp.ok) {
    return { ok: false, code: String(json?.error?.code || resp.status), detail: json?.error?.message || JSON.stringify(json) };
  }
  return { ok: true, wamid: json?.messages?.[0]?.id || null };
}

async function authenticateRequest(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (bearerToken && bearerToken === SERVICE_ROLE_KEY) {
    return { userId: null as string | null, isInternal: true, error: null as Response | null };
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return { userId: null as string | null, isInternal: false, error: auth.error };
  }

  return { userId: auth.userId, isInternal: false, error: null as Response | null };
}

async function syncControleTotals(supabase: ReturnType<typeof createClient>, onda: number) {
  const [sentRes, failedRes, pendingRes] = await Promise.all([
    supabase.from("campanha_atrio_audiencia").select("lead_id", { count: "exact", head: true }).eq("onda", onda).eq("status", "sent"),
    supabase.from("campanha_atrio_audiencia").select("lead_id", { count: "exact", head: true }).eq("onda", onda).eq("status", "failed"),
    supabase.from("campanha_atrio_audiencia").select("lead_id", { count: "exact", head: true }).eq("onda", onda).eq("status", "pending"),
  ]);

  const enviados = sentRes.count || 0;
  const erros = failedRes.count || 0;
  const pendentes = pendingRes.count || 0;

  await supabase.from("campanha_atrio_controle").update({
    total_enviado: enviados,
    total_erros: erros,
  }).eq("onda", onda);

  return { enviados, erros, pendentes };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors();

  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  if (!auth.isInternal) {
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: auth.userId, _role: "admin" });
    if (!isAdmin) return errorResponse("forbidden", 403);
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const onda = Number(body?.onda);
  if (!(onda >= 1 && onda <= 9)) return errorResponse("onda inválida (1-9)", 400);
  const continuation = body?.continuation === true || auth.isInternal;

  // 1) Kill switch global
  const { data: flag } = await supabase
    .from("system_flags").select("flag_value").eq("flag_name", "campanha_atrio_enabled").maybeSingle();
  if (!flag?.flag_value) return errorResponse("Kill switch desligado. Ative a flag campanha_atrio_enabled.", 403);

  // 2) Validações de estado
  const { data: ctrl } = await supabase.from("campanha_atrio_controle").select("*").eq("onda", onda).maybeSingle();
  if (!ctrl) return errorResponse("onda não encontrada", 404);
  const canStartFresh = ctrl.status === "aguardando";
  const canContinueCurrentRun = continuation && ctrl.status === "em_curso";
  if (!canStartFresh && !canContinueCurrentRun) {
    return errorResponse(`onda ${onda} está ${ctrl.status}, não pode iniciar`, 409);
  }
  const force = body?.force === true || continuation;
  // Predecessor check: encontra a onda anterior DENTRO DO MESMO LOTE
  const loteAtual = ctrl.lote || 1;
  const { data: prevOndas } = await supabase
    .from("campanha_atrio_controle")
    .select("onda, status, concluida_em")
    .eq("lote", loteAtual)
    .lt("onda", onda)
    .order("onda", { ascending: false })
    .limit(1);
  const prev = prevOndas?.[0];
  if (prev) {
    if (prev.status !== "concluida") return errorResponse(`onda ${prev.onda} (mesmo lote) ainda não concluída`, 409);
    if (prev?.concluida_em && !force) {
      const diff = Date.now() - new Date(prev.concluida_em).getTime();
      if (diff < 20 * 60 * 1000) return errorResponse(`aguarde 20min após conclusão da onda anterior (faltam ${Math.ceil((20*60*1000 - diff)/60000)}min)`, 409);
    }
  }

  // 3) Guard de volume
  if ((ctrl.total_alvo || 0) > VOLUME_GUARD) return errorResponse(`volume ${ctrl.total_alvo} > ${VOLUME_GUARD}`, 400);

  // 4) Buscar audiência pending (filtra pelo lote da onda — chave composta)
  const { data: audiencia, error: audErr } = await supabase
    .from("campanha_atrio_audiencia")
    .select("lead_id, nome, telefone_normalizado, empreendimento_origem, ordem, lote")
    .eq("onda", onda).eq("lote", loteAtual).eq("status", "pending").order("ordem");
  if (audErr) return errorResponse(audErr.message, 500);
  if (!audiencia || audiencia.length === 0) {
    const synced = await syncControleTotals(supabase, onda);
    if (synced.pendentes === 0) {
      await supabase.from("campanha_atrio_controle").update({
        status: "concluida",
        concluida_em: ctrl.concluida_em || new Date().toISOString(),
        total_enviado: synced.enviados,
        total_erros: synced.erros,
      }).eq("onda", onda);
      return jsonResponse({ ok: true, onda, total_a_processar: 0, message: "Onda já finalizada." });
    }
    return errorResponse("nenhum lead pending nesta onda", 400);
  }
  const lote = audiencia.slice(0, MAX_BATCH_PER_RUN);

  // 5) Marcar onda em curso
  await supabase.from("campanha_atrio_controle").update({
    status: "em_curso", iniciada_em: ctrl.iniciada_em || new Date().toISOString(), pausada_em: null, motivo_pausa: null,
  }).eq("onda", onda);

  // Resposta imediata + processamento em background
  const bgRun = async () => {
    let enviados = ctrl.total_enviado || 0, erros = ctrl.total_erros || 0, processados = 0;
    const hoje = new Date().toISOString().slice(0,10);
    for (const lead of lote) {
      // Re-checa kill switch a cada iteração
      const { data: f } = await supabase.from("system_flags").select("flag_value").eq("flag_name","campanha_atrio_enabled").maybeSingle();
      if (!f?.flag_value) {
        await supabase.from("campanha_atrio_controle").update({
          status: "pausada", pausada_em: new Date().toISOString(), motivo_pausa: "kill_switch_manual",
        }).eq("onda", onda);
        console.log(`🛑 Onda ${onda} pausada (kill switch)`);
        return;
      }

      // Sanitização defensiva: remove " | Profissão" caso tenha escapado
      const nomeLimpo = (lead.nome || "").split("|")[0].split("/")[0].split(" - ")[0].trim().slice(0, 60);
      const res = await sendTemplate(lead.telefone_normalizado, nomeLimpo);
      processados++;

      if (res.ok) {
        enviados++;
        await supabase.from("campanha_atrio_eventos").insert({
          lead_id: lead.lead_id, telefone: lead.telefone_normalizado, nome: lead.nome,
          onda, empreendimento_origem: lead.empreendimento_origem,
          status_envio: "sucesso", mensagem_id_meta: res.wamid,
        });
        await supabase.from("campanha_atrio_audiencia").update({ status: "sent" }).eq("lead_id", lead.lead_id);
        // Marca lead como reengajado pela campanha Átrio
        await supabase.from("pipeline_leads").update({
          reengajamento_status: "enviado",
          reengajamento_enviado_at: new Date().toISOString(),
        }).eq("id", lead.lead_id);
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: lead.lead_id, tipo: "campanha_atrio",
          titulo: `Disparo Átrio — Onda ${onda}`,
          descricao: `Template ${TEMPLATE_NAME} enviado. Lead marcado como reengajado (campanha_atrio).`,
          data: hoje, status: "concluida",
        });

      } else {
        erros++;
        await supabase.from("campanha_atrio_eventos").insert({
          lead_id: lead.lead_id, telefone: lead.telefone_normalizado, nome: lead.nome,
          onda, empreendimento_origem: lead.empreendimento_origem,
          status_envio: "erro", codigo_erro_meta: res.code, detalhe_erro: res.detail?.slice(0, 500),
        });
        await supabase.from("campanha_atrio_audiencia").update({ status: "failed" }).eq("lead_id", lead.lead_id);

        // Códigos fatais Meta → pausa imediata
        if (["132016","131056","131057"].includes(res.code || "")) {
          await supabase.from("campanha_atrio_controle").update({
            status: "pausada", pausada_em: new Date().toISOString(),
            motivo_pausa: `meta_error_${res.code}`, total_enviado: enviados, total_erros: erros,
          }).eq("onda", onda);
          console.log(`🛑 Onda ${onda} pausada por código fatal ${res.code}`);
          return;
        }
      }

      // Kill switch automático: >5% erro a cada 20 envios
      if (processados >= 20 && processados % 20 === 0) {
        const taxa = erros / processados;
        if (taxa > 0.05) {
          await supabase.from("system_flags").update({ flag_value: false, reason: `auto-killswitch: ${(taxa*100).toFixed(1)}% erro` }).eq("flag_name", "campanha_atrio_enabled");
          await supabase.from("campanha_atrio_controle").update({
            status: "pausada", pausada_em: new Date().toISOString(),
            motivo_pausa: `auto_killswitch_${(taxa*100).toFixed(1)}pct`,
            total_enviado: enviados, total_erros: erros,
          }).eq("onda", onda);
          console.log(`🛑 Auto kill switch acionado (${(taxa*100).toFixed(1)}% erro)`);
          return;
        }
      }

      // Update contadores a cada 10
      if (processados % CONTROL_SYNC_EVERY === 0) {
        const synced = await syncControleTotals(supabase, onda);
        enviados = synced.enviados;
        erros = synced.erros;
      }

      await sleep(CADENCIA_MS);
    }

    const synced = await syncControleTotals(supabase, onda);
    enviados = synced.enviados;
    erros = synced.erros;

    if (synced.pendentes > 0) {
      console.log(`🔁 Onda ${onda} continuará em novo lote: ${synced.pendentes} pendentes`);
      await fetch(`${SUPABASE_URL}/functions/v1/campanha-atrio-iniciar-onda`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ onda, continuation: true, force: true }),
      });
      return;
    }

    await supabase.from("campanha_atrio_controle").update({
      status: "concluida", concluida_em: new Date().toISOString(),
      total_enviado: enviados, total_erros: erros,
    }).eq("onda", onda);
    console.log(`✅ Onda ${onda} concluída: ${enviados} enviados / ${erros} erros`);
  };

  // background sem aguardar (Edge runtime: usar EdgeRuntime.waitUntil quando disponível)
  // @ts-ignore
  const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
  if (typeof waitUntil === "function") waitUntil(bgRun()); else bgRun();

  return jsonResponse({ ok: true, onda, total_a_processar: lote.length, pendentes_restantes: Math.max(audiencia.length - lote.length, 0), message: continuation ? "Onda retomada em background." : "Onda iniciada em background." });
});
