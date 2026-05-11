// Disparo de reengajamento — registra cada execução em reengajamento_dispatch_runs
// e cada evento por lead em reengajamento_eventos para acompanhamento na UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAGE_DESCARTE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";
const MAX_RUN_MS = 140_000; // 140s — fica abaixo do timeout do edge function

function nowBRT(): Date {
  const d = new Date();
  return new Date(d.getTime() - 3 * 60 * 60 * 1000);
}

function withinWindow(cfg: any): boolean {
  const brt = nowBRT();
  const dow = brt.getUTCDay() === 0 ? 7 : brt.getUTCDay();
  if (cfg.dias_semana && !cfg.dias_semana.includes(dow)) return false;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let bodyForce = false;
  let iniciadoPor = "cron";
  try {
    if (req.method === "POST") {
      const b = await req.clone().json().catch(() => ({}));
      bodyForce = !!(b as any)?.force;
      if ((b as any)?.iniciado_por) iniciadoPor = String((b as any).iniciado_por);
      else if (bodyForce) iniciadoPor = "manual";
    }
  } catch { /* ignore */ }

  const force = bodyForce || new URL(req.url).searchParams.get("force") === "1";
  const startedAt = Date.now();
  let runId: string | null = null;
  const errs: string[] = [];

  const updateRun = async (patch: Record<string, unknown>) => {
    if (!runId) return;
    await supabase.from("reengajamento_dispatch_runs").update(patch).eq("id", runId);
  };

  try {
    const { data: cfg } = await supabase.from("reengajamento_config").select("*").limit(1).maybeSingle();
    if (!cfg) return new Response(JSON.stringify({ error: "no config" }), { status: 500, headers: corsHeaders });

    if (!cfg.enabled && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!withinWindow(cfg) && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "out_of_window" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (force) {
      await supabase.from("reengajamento_config").update({ paused: false }).eq("id", cfg.id);
    }

    const cutoff = new Date(Date.now() - cfg.lookback_days * 24 * 60 * 60 * 1000).toISOString();

    const { data: leads, error: leadsErr } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, tipo_descarte, stage_changed_at")
      .eq("stage_id", STAGE_DESCARTE_ID)
      .eq("tipo_descarte", "reengajavel")
      .is("reengajamento_enviado_at", null)
      .not("telefone", "is", null)
      .gte("stage_changed_at", cutoff)
      .order("stage_changed_at", { ascending: false })
      .limit(cfg.daily_limit);

    if (leadsErr) throw leadsErr;

    const totalAlvo = (leads || []).length;

    // Cria a execução
    const { data: runRow } = await supabase
      .from("reengajamento_dispatch_runs")
      .insert({ status: "running", total_alvo: totalAlvo, iniciado_por: iniciadoPor })
      .select("id")
      .single();
    runId = runRow?.id ?? null;

    if (totalAlvo === 0) {
      await updateRun({ status: "completed", finished_at: new Date().toISOString(), motivo_parada: "Nenhum lead elegível encontrado" });
      return new Response(JSON.stringify({ run_id: runId, sent: 0, total: 0, reason: "no_leads" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evoUrl || !evoKey) throw new Error("Evolution env vars missing");

    const delayMin = Math.max(2, Number(cfg.delay_min_seconds || 8));
    const delayMax = Math.max(delayMin, Number(cfg.delay_max_seconds || 20));

    let sent = 0, failed = 0, skipped = 0;
    let stopReason: string | null = null;

    for (const lead of leads || []) {
      // Limite de tempo do edge function
      if (Date.now() - startedAt > MAX_RUN_MS) {
        stopReason = `Limite de tempo do servidor atingido — execute novamente para continuar (${sent}/${totalAlvo} processados)`;
        await updateRun({ status: "timeout", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });
        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "timeout" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Verifica pause/disable em tempo real
      const { data: liveCfg } = await supabase
        .from("reengajamento_config")
        .select("paused, enabled")
        .eq("id", cfg.id)
        .maybeSingle();
      if (liveCfg?.paused) {
        stopReason = "Pausado pelo usuário";
        await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });
        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "paused", paused: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!liveCfg?.enabled && !force) {
        stopReason = "Disparo desativado";
        await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });
        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const phone = normalizePhone(lead.telefone || "");
      if (!phone) {
        await supabase.from("pipeline_leads")
          .update({ reengajamento_status: "telefone_invalido", reengajamento_enviado_at: new Date().toISOString() })
          .eq("id", lead.id);
        await supabase.from("reengajamento_eventos").insert({
          lead_id: lead.id, run_id: runId, tipo: "telefone_invalido", detalhe: lead.telefone,
        });
        skipped++;
        await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
        continue;
      }

      const firstName = (lead.nome || "").split(" ")[0] || "tudo bem";
      const text = (cfg.mensagem_template || "").replace(/\{nome\}/g, firstName);

      try {
        const resp = await fetch(`${evoUrl}/message/sendText/${cfg.evolution_instance}`, {
          method: "POST",
          headers: { apikey: evoKey, "Content-Type": "application/json" },
          body: JSON.stringify({ number: phone, text }),
        });
        const result = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          failed++;
          const errMsg = `${lead.nome}: ${JSON.stringify(result).slice(0, 160)}`;
          errs.push(errMsg);
          await supabase.from("reengajamento_eventos").insert({
            lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: errMsg.slice(0, 500),
          });
          await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20), ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
          continue;
        }

        const messageId = result?.key?.id || result?.messageId || crypto.randomUUID();

        await supabase.from("pipeline_leads")
          .update({
            reengajamento_enviado_at: new Date().toISOString(),
            reengajamento_status: "enviado",
          })
          .eq("id", lead.id);

        await supabase.from("whatsapp_mensagens").insert({
          lead_id: lead.id,
          instance_name: cfg.evolution_instance,
          direction: "sent",
          body: text,
          whatsapp_message_id: messageId,
          timestamp: new Date().toISOString(),
          delivery_status: "sent",
        });

        await supabase.from("reengajamento_eventos").insert({
          lead_id: lead.id, run_id: runId, tipo: "enviado", detalhe: phone,
        });

        sent++;
        await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });

        // delay configurável anti-spam
        const delayMs = (delayMin + Math.random() * (delayMax - delayMin)) * 1000;
        await new Promise((r) => setTimeout(r, delayMs));
      } catch (e) {
        failed++;
        const errMsg = `${lead.nome}: ${e instanceof Error ? e.message : String(e)}`;
        errs.push(errMsg);
        await supabase.from("reengajamento_eventos").insert({
          lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: errMsg.slice(0, 500),
        });
        await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20), ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
      }
    }

    await updateRun({
      status: "completed",
      finished_at: new Date().toISOString(),
      motivo_parada: `Disparo concluído (${sent}/${totalAlvo} enviados)`,
      enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20),
    });

    return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "completed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("reengajamento-enqueue error:", msg);
    if (runId) {
      await updateRun({ status: "error", finished_at: new Date().toISOString(), motivo_parada: msg.slice(0, 500), erros: errs.slice(-20) });
    }
    return new Response(JSON.stringify({ run_id: runId, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
