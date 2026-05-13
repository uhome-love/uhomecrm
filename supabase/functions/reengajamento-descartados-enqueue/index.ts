// Disparo de reengajamento — suporta canal Meta (oficial) ou Evolution (anti-ban v2).
// Evolution v2: spintax (variantes), delay 60-180s, pausa longa a cada N envios,
// validação de número, warmup diário, janela horária estrita.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAGE_DESCARTE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";
const MAX_RUN_MS = 140_000;

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

function pickVariant(variants: string[], fallback: string, nome: string): string {
  const list = (variants && variants.length > 0) ? variants : [fallback];
  const tpl = list[Math.floor(Math.random() * list.length)];
  return (tpl || fallback || "").replace(/\{nome\}/g, nome);
}

async function parseResponseBody(resp: Response): Promise<unknown> {
  const text = await resp.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stringifyErrorPayload(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (payload == null) return "sem resposta";
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function isEvolutionSystemicError(payload: unknown): boolean {
  const msg = stringifyErrorPayload(payload).toLowerCase();
  return msg.includes("connection closed") || msg.includes("cannot read properties of undefined (reading 'id')");
}

async function getEvolutionConnectionState(evoUrl: string, evoKey: string, instance: string): Promise<string> {
  const r = await fetch(`${evoUrl}/instance/connectionState/${instance}`, {
    method: "GET",
    headers: { apikey: evoKey, "Content-Type": "application/json" },
  });
  if (!r.ok) return "close";
  const data = await parseResponseBody(r);
  return String((data as any)?.instance?.state ?? (data as any)?.state ?? "close").toLowerCase();
}

async function validateNumberEvolution(evoUrl: string, evoKey: string, instance: string, phone: string): Promise<boolean> {
  try {
    const r = await fetch(`${evoUrl}/chat/whatsappNumbers/${instance}`, {
      method: "POST",
      headers: { apikey: evoKey, "Content-Type": "application/json" },
      body: JSON.stringify({ numbers: [phone] }),
    });
    if (!r.ok) return true; // se endpoint falhar, não bloqueia
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data?.numbers || []);
    const found = arr.find((x: any) => String(x?.number || x?.jid || "").includes(phone));
    if (!found) return true;
    return found?.exists !== false;
  } catch { return true; }
}

async function sendMetaTemplate(params: {
  phoneNumberId: string; accessToken: string; to: string; templateName: string; lang: string; nome: string;
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

  let bodyForce = false;
  let iniciadoPor = "cron";
  let bodyWave: number | null = null;
  try {
    if (req.method === "POST") {
      const b = await req.clone().json().catch(() => ({}));
      bodyForce = !!(b as any)?.force;
      if ((b as any)?.iniciado_por) iniciadoPor = String((b as any).iniciado_por);
      else if (bodyForce) iniciadoPor = "manual";
      if ((b as any)?.wave) bodyWave = Number((b as any).wave);
    }
  } catch { /* ignore */ }

  const url = new URL(req.url);
  const force = bodyForce || url.searchParams.get("force") === "1";
  const waveParam = bodyWave ?? Number(url.searchParams.get("wave") || "1");
  const wave: 1 | 2 = waveParam === 2 ? 2 : 1;
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

    const canal: "meta" | "evolution" = (cfg.canal === "meta") ? "meta" : "evolution";

    // Validações por canal
    let evoUrl = "", evoKey = "";
    let metaPhoneId = "", metaToken = "", metaTemplate = "", metaLang = "pt_BR";
    if (canal === "evolution") {
      evoUrl = Deno.env.get("EVOLUTION_API_URL") || "";
      evoKey = Deno.env.get("EVOLUTION_API_KEY") || "";
      if (!evoUrl || !evoKey) throw new Error("Evolution env vars missing");
      if (!cfg.evolution_instance) throw new Error("Instância Evolution não configurada");
    } else {
      metaPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
      metaToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
      if (!metaPhoneId || !metaToken) throw new Error("Meta env vars missing");
      metaTemplate = String((wave === 2 ? cfg.meta_template_name_2 : cfg.meta_template_name) || "");
      metaLang = String(cfg.meta_template_language || "pt_BR");
      if (!metaTemplate) throw new Error(wave === 2 ? "meta_template_name_2 não configurado" : "meta_template_name não configurado");
    }

    // Mensagens (Evolution) e variantes — selecionar pela onda
    const evoTemplate: string = String((wave === 2 ? cfg.mensagem_template_2 : cfg.mensagem_template) || "");
    const evoVariantes: string[] = (wave === 2 ? cfg.mensagens_variantes_2 : cfg.mensagens_variantes) || [];
    if (canal === "evolution" && !evoTemplate && (!evoVariantes || evoVariantes.length === 0)) {
      throw new Error(wave === 2 ? "mensagem_template_2 vazio" : "mensagem_template vazio");
    }

    const cutoff = new Date(Date.now() - cfg.lookback_days * 24 * 60 * 60 * 1000).toISOString();

    // Query base — diferente por onda
    let leadsQuery = supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, tipo_descarte, stage_changed_at, reengajamento_enviado_at")
      .eq("stage_id", STAGE_DESCARTE_ID)
      .eq("tipo_descarte", "reengajavel")
      .eq("arquivado", false)
      .not("telefone", "is", null);

    if (wave === 1) {
      leadsQuery = leadsQuery
        .is("reengajamento_enviado_at", null)
        .gte("stage_changed_at", cutoff);
    } else {
      // Wave 2: já receberam a 1ª (status 'enviado'), nunca receberam wave 2,
      // e a 1ª foi há pelo menos N dias.
      const minDias = Math.max(0, Number(cfg.wave2_min_dias_apos_wave1 || 5));
      const wave2Cutoff = new Date(Date.now() - minDias * 24 * 60 * 60 * 1000).toISOString();
      leadsQuery = leadsQuery
        .eq("reengajamento_status", "enviado")
        .is("reengajamento_wave2_at", null)
        .lte("reengajamento_enviado_at", wave2Cutoff);
    }

    const { data: leads, error: leadsErr } = await leadsQuery
      .order("stage_changed_at", { ascending: false })
      .limit(cfg.daily_limit);

    if (leadsErr) throw leadsErr;
    const totalAlvo = (leads || []).length;

    const { data: runRow } = await supabase
      .from("reengajamento_dispatch_runs")
      .insert({ status: "running", total_alvo: totalAlvo, iniciado_por: iniciadoPor })
      .select("id")
      .single();
    runId = runRow?.id ?? null;

    if (totalAlvo === 0) {
      await updateRun({ status: "completed", finished_at: new Date().toISOString(), motivo_parada: "Nenhum lead elegível encontrado" });
      return new Response(JSON.stringify({ run_id: runId, sent: 0, total: 0, reason: "no_leads", canal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (canal === "evolution") {
      const state = await getEvolutionConnectionState(evoUrl, evoKey, cfg.evolution_instance);
      if (state !== "open") {
        const reason = `WhatsApp da nutrição desconectado (${state}). Reconecte a instância antes de disparar.`;
        await updateRun({
          status: "error",
          finished_at: new Date().toISOString(),
          motivo_parada: reason,
          enviados: 0,
          falhas: 0,
          ignorados: 0,
        });
        return new Response(JSON.stringify({ run_id: runId, error: reason, reason: "instance_disconnected", canal }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const delayMin = Math.max(2, Number(cfg.delay_min_seconds || 60));
    const delayMax = Math.max(delayMin, Number(cfg.delay_max_seconds || 180));
    const pausaA = Math.max(2, Number(cfg.pausa_longa_a_cada || 6));
    const pausaMin = Math.max(30, Number(cfg.pausa_longa_min_seconds || 180));
    const pausaMax = Math.max(pausaMin, Number(cfg.pausa_longa_max_seconds || 480));

    let sent = 0, failed = 0, skipped = 0;
    let stopReason: string | null = null;
    let consecutiveMetaQualityFails = 0;

    const isMetaQualityBlock = (msg: string) => {
      const m = (msg || "").toLowerCase();
      return m.includes("ecosystem engagement")
        || m.includes("template is paused")
        || m.includes("template paused")
        || m.includes("template was paused")
        || m.includes("part of an experiment")
        || m.includes("(#131049)")
        || m.includes("(#131050)")
        || m.includes("quality rating");
    };

    // Patches por onda (helpers)
    const sentStatus = wave === 2 ? "enviado_wave2" : "enviado";
    const markSentPatch = () => {
      const nowIso = new Date().toISOString();
      return wave === 2
        ? { reengajamento_wave2_at: nowIso, reengajamento_status: sentStatus }
        : { reengajamento_enviado_at: nowIso, reengajamento_status: sentStatus };
    };
    const markPhoneInvalidPatch = () => {
      const nowIso = new Date().toISOString();
      // Em wave 2 mantém status original e só marca wave2_at para não retentar
      return wave === 2
        ? { reengajamento_wave2_at: nowIso }
        : { reengajamento_status: "telefone_invalido", reengajamento_enviado_at: nowIso };
    };

    for (const lead of leads || []) {
      if (Date.now() - startedAt > MAX_RUN_MS) {
        // Encadeia automaticamente um próximo run para continuar de onde parou
        // (a query já exclui leads com reengajamento_enviado_at preenchido).
        const restantes = totalAlvo - sent - failed - skipped;
        stopReason = `Lote 1 concluído (${sent}/${totalAlvo}). Continuando automaticamente em novo lote para os ${restantes} restantes...`;
        await updateRun({ status: "completed", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });

        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          // fire-and-forget: dispara próximo lote sem bloquear esta resposta
          fetch(`${supabaseUrl}/functions/v1/reengajamento-descartados-enqueue`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ force: true, iniciado_por: `${iniciadoPor}_continuacao` }),
          }).catch((err) => console.error("Falha ao encadear próximo lote:", err));
        } catch (chainErr) {
          console.error("Erro ao agendar continuação:", chainErr);
        }

        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "batch_continued", canal, continuation: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: liveCfg } = await supabase
        .from("reengajamento_config").select("paused, enabled").eq("id", cfg.id).maybeSingle();
      if (liveCfg?.paused) {
        stopReason = "Pausado pelo usuário";
        await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });
        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "paused", paused: true, canal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!liveCfg?.enabled && !force) {
        stopReason = "Disparo desativado";
        await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });
        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "disabled", canal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const phone = normalizePhone(lead.telefone || "");
      if (!phone) {
        await supabase.from("pipeline_leads")
          .update(markPhoneInvalidPatch())
          .eq("id", lead.id);
        await supabase.from("reengajamento_eventos").insert({
          lead_id: lead.id, run_id: runId, tipo: "telefone_invalido", detalhe: lead.telefone,
        });
        skipped++;
        await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
        continue;
      }

      // Validação prévia (só Evolution)
      if (canal === "evolution" && cfg.validar_numero) {
        const exists = await validateNumberEvolution(evoUrl, evoKey, cfg.evolution_instance, phone);
        if (!exists) {
          await supabase.from("pipeline_leads")
            .update(markPhoneInvalidPatch())
            .eq("id", lead.id);
          await supabase.from("reengajamento_eventos").insert({
            lead_id: lead.id, run_id: runId, tipo: "telefone_invalido", detalhe: `${phone} sem WhatsApp`,
          });
          skipped++;
          await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
          continue;
        }
      }

      const firstName = (lead.nome || "").split(" ")[0] || "tudo bem";

      try {
        if (canal === "meta") {
          const r = await sendMetaTemplate({
            phoneNumberId: metaPhoneId, accessToken: metaToken, to: phone,
            templateName: metaTemplate, lang: metaLang, nome: firstName,
          });
          if (!r.ok) {
            failed++;
            const errMsg = `${lead.nome}: ${r.error}`;
            errs.push(errMsg);
            await supabase.from("reengajamento_eventos").insert({
              lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: errMsg.slice(0, 500),
            });

            // 🛑 Auto-pause: se 5+ falhas consecutivas com sinais de bloqueio Meta (template pausado / qualidade)
            if (isMetaQualityBlock(r.error || "")) {
              consecutiveMetaQualityFails++;
              if (consecutiveMetaQualityFails >= 5) {
                stopReason = `Auto-pausa: template "${metaTemplate}" provavelmente pausado pela Meta (${consecutiveMetaQualityFails} falhas consecutivas: "${(r.error || "").slice(0, 120)}"). Verifique o WhatsApp Manager.`;
                await supabase.from("reengajamento_config").update({ paused: true, updated_at: new Date().toISOString() }).eq("id", cfg.id);
                await supabase.from("reengajamento_eventos").insert({
                  lead_id: lead.id, run_id: runId, tipo: "auto_pausa_meta", detalhe: stopReason.slice(0, 500),
                });
                await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20) });
                return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "auto_paused_meta_quality", paused: true, canal, motivo: stopReason }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
              }
            } else {
              consecutiveMetaQualityFails = 0;
            }

            await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20), ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
            continue;
          }
          consecutiveMetaQualityFails = 0;
          await supabase.from("reengajamento_meta_disparos").insert({
            lead_id: lead.id, run_id: runId, wamid: r.wamid, template_name: metaTemplate,
            template_language: metaLang, phone, status: "sent", sent_at: new Date().toISOString(),
          });
          await supabase.from("pipeline_leads").update({
            reengajamento_enviado_at: new Date().toISOString(),
            reengajamento_status: "enviado",
          }).eq("id", lead.id);
          await supabase.from("reengajamento_eventos").insert({
            lead_id: lead.id, run_id: runId, tipo: "enviado", detalhe: `[meta:${metaTemplate}] ${phone}`,
          });
          sent++;
        } else {
          // EVOLUTION com spintax
          const text = pickVariant(cfg.mensagens_variantes || [], cfg.mensagem_template, firstName);
          const resp = await fetch(`${evoUrl}/message/sendText/${cfg.evolution_instance}`, {
            method: "POST",
            headers: { apikey: evoKey, "Content-Type": "application/json" },
            body: JSON.stringify({ number: phone, text }),
          });
          const result = await parseResponseBody(resp);
          if (!resp.ok) {
            const payloadText = stringifyErrorPayload(result).slice(0, 300);
            if (isEvolutionSystemicError(result)) {
              const reason = `Evolution indisponível durante o disparo: ${payloadText}`;
              failed++;
              errs.push(`${lead.nome}: ${payloadText}`);
              await supabase.from("reengajamento_eventos").insert({
                lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: `${lead.nome}: ${payloadText}`.slice(0, 500),
              });
              await updateRun({
                status: "error",
                finished_at: new Date().toISOString(),
                motivo_parada: reason,
                enviados: sent,
                falhas: failed,
                ignorados: skipped,
                erros: errs.slice(-20),
                ultimo_lead_id: lead.id,
                ultimo_lead_nome: lead.nome,
              });
              return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "evolution_unavailable", error: reason, canal }), {
                status: 502,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            failed++;
            const errMsg = `${lead.nome}: ${payloadText}`;
            errs.push(errMsg);
            await supabase.from("reengajamento_eventos").insert({
              lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: errMsg.slice(0, 500),
            });
            await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20), ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
            continue;
          }
          const messageId = result?.key?.id || result?.messageId || crypto.randomUUID();
          await supabase.from("pipeline_leads").update({
            reengajamento_enviado_at: new Date().toISOString(),
            reengajamento_status: "enviado",
          }).eq("id", lead.id);
          await supabase.from("whatsapp_mensagens").insert({
            lead_id: lead.id, instance_name: cfg.evolution_instance, direction: "sent",
            body: text, whatsapp_message_id: messageId, timestamp: new Date().toISOString(),
            delivery_status: "sent",
          });
          await supabase.from("reengajamento_eventos").insert({
            lead_id: lead.id, run_id: runId, tipo: "enviado", detalhe: `[evo] ${phone} :: ${text.slice(0, 80)}`,
          });
          sent++;
        }

        await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });

        // Delays:
        // - Meta: rápido (rate limit Meta é altíssimo) — 1-3s só pra não estourar nada
        // - Evolution: 60-180s + pausa longa a cada N envios
        if (canal === "meta") {
          await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
        } else {
          const isLongPause = sent > 0 && sent % pausaA === 0;
          const ms = isLongPause
            ? (pausaMin + Math.random() * (pausaMax - pausaMin)) * 1000
            : (delayMin + Math.random() * (delayMax - delayMin)) * 1000;
          if (isLongPause) {
            await supabase.from("reengajamento_eventos").insert({
              lead_id: lead.id, run_id: runId, tipo: "pausa_longa", detalhe: `${Math.round(ms/1000)}s após ${sent} envios`,
            });
          }
          await new Promise(r => setTimeout(r, ms));
        }
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

    const finalStatus = failed > 0 && sent === 0 ? "error" : "completed";
    const finalReason = finalStatus === "error"
      ? `Disparo encerrado com falhas via ${canal} (${sent}/${totalAlvo} enviados, ${failed} falhas)`
      : `Disparo concluído via ${canal} (${sent}/${totalAlvo} enviados${failed > 0 ? `, ${failed} falhas` : ""})`;

    await updateRun({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      motivo_parada: finalReason,
      enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20),
    });

    return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: finalStatus, canal }), {
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
