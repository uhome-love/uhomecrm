// Disparo "Visita Amanhã" — envia template Meta para leads ativos do pipeline
// nas etapas configuradas. Idempotente (1 envio por lead via UNIQUE em visita_amanha_disparos).
// Padrão clonado de reengajamento-descartados-enqueue (throttle, auto-pausa, validação Meta).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUN_MS = 140_000;

function nowBRT(): Date {
  const d = new Date();
  return new Date(d.getTime() - 3 * 60 * 60 * 1000);
}

function withinWindow(cfg: any): boolean {
  const brt = nowBRT();
  const hh = brt.getUTCHours();
  const mm = brt.getUTCMinutes();
  const cur = hh * 60 + mm;
  const [hi, mi] = String(cfg.horario_inicio).split(":").map(Number);
  const [hf, mf] = String(cfg.horario_fim).split(":").map(Number);
  return cur >= hi * 60 + mi && cur <= hf * 60 + mf;
}

function normalizePhone(raw: string): string | null {
  let p = (raw || "").replace(/\D/g, "");
  if (!p) return null;
  if (p.startsWith("0")) p = p.substring(1);
  if (!p.startsWith("55")) p = "55" + p;
  if (p.length === 12) {
    const ddd = p.substring(2, 4);
    const rest = p.substring(4);
    if (/^[6-9]/.test(rest)) p = `55${ddd}9${rest}`;
  }
  if (p.length < 12 || p.length > 13) return null;
  return p;
}

function isMetaQualityBlock(err: string): boolean {
  const m = err.toLowerCase();
  return m.includes("template") && (m.includes("paused") || m.includes("disabled") || m.includes("quality"));
}

async function sendMetaTemplate(params: {
  phoneNumberId: string; accessToken: string; to: string;
  templateName: string; lang: string; nome: string;
}): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const url = `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.lang },
      components: [
        { type: "body", parameters: [{ type: "text", text: params.nome }] },
      ],
    },
  };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: JSON.stringify(data).slice(0, 300) };
    const wamid = data?.messages?.[0]?.id;
    return { ok: true, wamid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let force = false;
  let dailyLimitOverride: number | null = null;
  try {
    if (req.method === "POST") {
      const b = await req.clone().json().catch(() => ({}));
      force = !!(b as any)?.force;
      if ((b as any)?.daily_limit_override) dailyLimitOverride = Number((b as any).daily_limit_override);
    }
  } catch { /* ignore */ }

  const startedAt = Date.now();
  const errs: string[] = [];

  try {
    const { data: cfg } = await supabase.from("visita_amanha_config").select("*").limit(1).maybeSingle();
    if (!cfg) {
      return new Response(JSON.stringify({ error: "no config" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!cfg.enabled && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (cfg.paused && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "paused" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!withinWindow(cfg) && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "out_of_window" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (force) {
      await supabase.from("visita_amanha_config").update({ paused: false, updated_at: new Date().toISOString() }).eq("id", cfg.id);
    }

    const metaPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
    const metaToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    if (!metaPhoneId || !metaToken) throw new Error("Meta env vars missing");

    const metaTemplate: string = String(cfg.meta_template_name || "visita_amanha_v1");
    const metaLang: string = String(cfg.meta_template_language || "pt_BR");
    const stagesAlvo: string[] = Array.isArray(cfg.stages_alvo) ? cfg.stages_alvo : [];

    // Resolve stage_ids alvo
    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, nome")
      .in("nome", stagesAlvo);
    const stageIds: string[] = (stages || []).map(s => s.id);
    if (stageIds.length === 0) throw new Error("Nenhuma stage alvo encontrada");

    // Leads elegíveis: nas stages alvo, com telefone, ativos (não arquivados)
    // E que ainda NÃO receberam disparo (LEFT JOIN visita_amanha_disparos IS NULL)
    const effectiveLimit = (dailyLimitOverride && dailyLimitOverride > 0) ? dailyLimitOverride : cfg.daily_limit;

    // Buscar leads elegíveis paginado para evitar limite de 1000 do PostgREST
    const PAGE_SIZE = 1000;
    let alvos: any[] = [];
    for (let offset = 0; offset < effectiveLimit; offset += PAGE_SIZE) {
      const lim = Math.min(PAGE_SIZE, effectiveLimit - offset);
      const { data: page, error } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, corretor_id, stage_id")
        .in("stage_id", stageIds)
        .eq("arquivado", false)
        .not("telefone", "is", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + lim - 1);
      if (error) throw error;
      if (!page || page.length === 0) break;
      alvos = alvos.concat(page);
      if (page.length < lim) break;
    }

    // Filtrar os que já receberam disparo
    const leadIds = alvos.map(l => l.id);
    const jaEnviados = new Set<string>();
    for (let i = 0; i < leadIds.length; i += 1000) {
      const batch = leadIds.slice(i, i + 1000);
      const { data: existentes } = await supabase
        .from("visita_amanha_disparos")
        .select("pipeline_lead_id")
        .in("pipeline_lead_id", batch);
      (existentes || []).forEach(e => jaEnviados.add(e.pipeline_lead_id));
    }
    const leads = alvos.filter(l => !jaEnviados.has(l.id)).slice(0, effectiveLimit);

    let sent = 0, failed = 0, skipped = 0;
    let consecutiveBlock = 0;
    const totalAlvo = leads.length;

    for (let i = 0; i < leads.length; i++) {
      if (Date.now() - startedAt > MAX_RUN_MS) {
        return new Response(JSON.stringify({
          partial: true, sent, failed, skipped, total: totalAlvo,
          processed: i, message: "Tempo máximo atingido — chame novamente para continuar.",
          errors: errs.slice(-10),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const lead = leads[i];
      const phone = normalizePhone(lead.telefone || "");
      if (!phone) {
        skipped++;
        continue;
      }
      const firstName = (lead.nome || "").split(" ")[0] || "tudo bem";

      const r = await sendMetaTemplate({
        phoneNumberId: metaPhoneId, accessToken: metaToken, to: phone,
        templateName: metaTemplate, lang: metaLang, nome: firstName,
      });

      if (!r.ok) {
        failed++;
        errs.push(`${lead.nome}: ${r.error}`);
        if (isMetaQualityBlock(r.error || "")) {
          consecutiveBlock++;
          if (consecutiveBlock >= 5) {
            await supabase.from("visita_amanha_config").update({
              paused: true, updated_at: new Date().toISOString(),
            }).eq("id", cfg.id);
            return new Response(JSON.stringify({
              auto_paused: true, reason: "meta_quality_block", sent, failed, skipped,
              total: totalAlvo, errors: errs.slice(-10),
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } else {
          consecutiveBlock = 0;
        }
      } else {
        consecutiveBlock = 0;
        await supabase.from("visita_amanha_disparos").insert({
          pipeline_lead_id: lead.id,
          wamid: r.wamid,
          phone,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        sent++;
      }

      // Throttle: delay entre envios
      const minMs = (cfg.delay_min_seconds || 60) * 1000;
      const maxMs = (cfg.delay_max_seconds || 180) * 1000;
      const delay = Math.floor(minMs + Math.random() * (maxMs - minMs));

      // Pausa longa a cada N envios
      const isLongBreak = sent > 0 && sent % (cfg.pausa_longa_a_cada || 6) === 0;
      const longMin = (cfg.pausa_longa_min_seconds || 180) * 1000;
      const longMax = (cfg.pausa_longa_max_seconds || 480) * 1000;
      const sleepMs = isLongBreak
        ? Math.floor(longMin + Math.random() * (longMax - longMin))
        : delay;

      if (i < leads.length - 1) {
        await new Promise(res => setTimeout(res, sleepMs));
      }
    }

    return new Response(JSON.stringify({
      ok: true, sent, failed, skipped, total: totalAlvo,
      duration_ms: Date.now() - startedAt,
      errors: errs.slice(-10),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("visita-amanha-enqueue error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : String(e),
      errors: errs.slice(-10),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
