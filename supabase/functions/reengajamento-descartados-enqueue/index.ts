// Disparo de reengajamento — suporta canal Meta (oficial) ou Evolution (anti-ban v2).
// Evolution v2: spintax (variantes), delay 60-180s, pausa longa a cada N envios,
// validação de número, warmup diário, janela horária estrita.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isCampaignDispatchEnabled, pausedResponse } from "../_shared/campaign-gate.ts";

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
  phoneNumberId: string; accessToken: string; to: string; templateName: string; lang: string; nome: string; headerImageUrl?: string;
}): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const url = `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`;
  const buildBody = (withHeader: boolean) => {
    const components: any[] = [];
    if (withHeader && params.headerImageUrl) {
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { link: params.headerImageUrl } }],
      });
    }
    components.push({ type: "body", parameters: [{ type: "text", text: params.nome }] });
    return {
      messaging_product: "whatsapp",
      to: params.to,
      type: "template",
      template: { name: params.templateName, language: { code: params.lang }, components },
    };
  };
  const post = async (withHeader: boolean) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(withHeader)),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, data };
  };
  try {
    let resp = await post(true);
    // Auto-retry sem header quando o template não tem header component (Meta #132018)
    if (!resp.ok && params.headerImageUrl) {
      const errStr = JSON.stringify(resp.data);
      if (/132018|does not contain (title|header) component|no parameters allowed/i.test(errStr)) {
        resp = await post(false);
      }
    }
    if (!resp.ok) return { ok: false, error: JSON.stringify(resp.data).slice(0, 300) };
    const wamid = resp.data?.messages?.[0]?.id;
    return { ok: true, wamid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // WABA RECOVERY — gatekeeper global de disparo de campanha
  const gate = await isCampaignDispatchEnabled();
  if (!gate.enabled) return pausedResponse("reengajamento-descartados-enqueue", gate, corsHeaders);


  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let bodyForce = false;
  let iniciadoPor = "cron";
  let bodyWave: number | null = null;
  let bodyMinDiasOverride: number | null = null;
  let bodyIncludeArchived = false;
  let bodyDailyLimitOverride: number | null = null;
  let bodyAudience: any = null;
  try {
    if (req.method === "POST") {
      const b = await req.clone().json().catch(() => ({}));
      bodyForce = !!(b as any)?.force;
      if ((b as any)?.iniciado_por) iniciadoPor = String((b as any).iniciado_por);
      else if (bodyForce) iniciadoPor = "manual";
      if ((b as any)?.wave) bodyWave = Number((b as any).wave);
      if ((b as any)?.min_dias_override !== undefined && (b as any)?.min_dias_override !== null) {
        bodyMinDiasOverride = Number((b as any).min_dias_override);
      }
      bodyIncludeArchived = !!(b as any)?.include_archived;
      if ((b as any)?.daily_limit_override) bodyDailyLimitOverride = Number((b as any).daily_limit_override);
      if ((b as any)?.audience && typeof (b as any).audience === "object") bodyAudience = (b as any).audience;
    }
  } catch { /* ignore */ }

  const isCustomAudience = !!bodyAudience?.source;
  const audSource: string = isCustomAudience
    ? (bodyAudience.source === "descartados"
        ? `descartados:${bodyAudience.tipo_descarte || "reengajavel"}`
        : bodyAudience.source === "oferta_ativa_lista"
          ? `oferta_ativa:${(((bodyAudience.lista_ids && bodyAudience.lista_ids.length) ? bodyAudience.lista_ids : (bodyAudience.lista_id ? [bodyAudience.lista_id] : [])) as string[]).slice().sort().join(",") || "?"}`
          : `pipeline:${(bodyAudience.stage_ids || []).slice().sort().join(",")}`)
    : "";
  // Canonical source for routing on reply (column audience_source in reengajamento_meta_disparos)
  const audienceSourceCanonical: string = isCustomAudience
    ? String(bodyAudience.source)
    : "legacy";

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
      // Override explícito vindo do front (Central de Reengajamento) tem prioridade sobre o default da config
      const overrideTpl = (bodyAudience?.template_name && String(bodyAudience.template_name).trim()) || "";
      const overrideLang = (bodyAudience?.template_language && String(bodyAudience.template_language).trim()) || "";
      metaTemplate = overrideTpl || String((wave === 2 ? cfg.meta_template_name_2 : cfg.meta_template_name) || "");
      metaLang = overrideLang || String(cfg.meta_template_language || "pt_BR");
      if (!metaTemplate) throw new Error(wave === 2 ? "meta_template_name_2 não configurado" : "meta_template_name não configurado");
    }

    // Mensagens (Evolution) e variantes — selecionar pela onda
    const evoTemplate: string = String((wave === 2 ? cfg.mensagem_template_2 : cfg.mensagem_template) || "");
    const evoVariantes: string[] = (wave === 2 ? cfg.mensagens_variantes_2 : cfg.mensagens_variantes) || [];
    if (canal === "evolution" && !evoTemplate && (!evoVariantes || evoVariantes.length === 0)) {
      throw new Error(wave === 2 ? "mensagem_template_2 vazio" : "mensagem_template vazio");
    }

    const cutoff = new Date(Date.now() - cfg.lookback_days * 24 * 60 * 60 * 1000).toISOString();

    const effectiveLimit = bodyDailyLimitOverride && bodyDailyLimitOverride > 0
      ? bodyDailyLimitOverride
      : (isCustomAudience && Number(bodyAudience?.limit) > 0 ? Number(bodyAudience.limit) : cfg.daily_limit);

    let leads: Array<{ id: string; nome: string; telefone: string | null; ref: "pipeline_lead" | "oferta_ativa_lead" }> = [];

    if (isCustomAudience) {
      const src = String(bodyAudience.source);
      const dedupMode = String(bodyAudience.dedup_mode || "exclude_sent");
      const dedupLookbackDays = Math.max(1, Number(bodyAudience.dedup_lookback_days || 30));
      const dedupSince = new Date(Date.now() - dedupLookbackDays * 24 * 3600 * 1000).toISOString();

      if (src === "descartados") {
        const includeArchivedCustom = bodyAudience.include_archived === true;
        const tipoFilter = String(bodyAudience.tipo_descarte || "reengajavel");
        const cooldownDias = Math.max(0, Number(bodyAudience.cooldown_dias ?? 7));
        const cooldownCutoff = new Date(Date.now() - cooldownDias * 24 * 3600 * 1000).toISOString();
        const RESPONDEU_NAO = ["respondeu_nao", "respondeu_nao_wave2", "bloqueado", "telefone_invalido"];
        let q = supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, reengajamento_enviado_at")
          .eq("stage_id", STAGE_DESCARTE_ID)
          .not("telefone", "is", null);
        if (!includeArchivedCustom) q = q.eq("arquivado", false);
        if (tipoFilter === "reengajavel") {
          q = q.neq("tipo_descarte", "definitivo")
               .not("reengajamento_status", "in", `(${RESPONDEU_NAO.join(",")})`);
        } else if (tipoFilter === "definitivo") {
          q = q.eq("tipo_descarte", "definitivo");
        }
        if (bodyAudience.periodo?.from) q = q.gte("stage_changed_at", String(bodyAudience.periodo.from));
        if (bodyAudience.periodo?.to) q = q.lte("stage_changed_at", String(bodyAudience.periodo.to));
        if (bodyAudience.empreendimento) q = q.eq("empreendimento", String(bodyAudience.empreendimento));
        // Dedup novo: cooldown (default). Modos antigos como override.
        if (dedupMode === "exclude_sent") {
          q = q.is("reengajamento_enviado_at", null);
        } else if (dedupMode === "only_sent_before" && bodyAudience.dedup_cutoff) {
          q = q.not("reengajamento_enviado_at", "is", null).lte("reengajamento_enviado_at", String(bodyAudience.dedup_cutoff));
        } else if (dedupMode === "include_all") {
          // sem filtro
        } else if (cooldownDias > 0) {
          q = q.or(`reengajamento_enviado_at.is.null,reengajamento_enviado_at.lt.${cooldownCutoff}`);
        }
        const { data, error } = await q.order("stage_changed_at", { ascending: false }).limit(effectiveLimit);
        if (error) throw error;
        leads = (data || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, ref: "pipeline_lead" }));
      } else if (src === "pipeline_ativo") {
        const stageIds: string[] = (bodyAudience.stage_ids || []).filter(Boolean);
        if (stageIds.length === 0) throw new Error("audience.stage_ids vazio");
        let q = supabase
          .from("pipeline_leads")
          .select("id, nome, telefone")
          .in("stage_id", stageIds)
          .eq("arquivado", false)
          .not("telefone", "is", null);
        if (bodyAudience.periodo?.from) q = q.gte("created_at", String(bodyAudience.periodo.from));
        if (bodyAudience.periodo?.to) q = q.lte("created_at", String(bodyAudience.periodo.to));
        if (bodyAudience.empreendimento) q = q.eq("empreendimento", String(bodyAudience.empreendimento));
        const { data, error } = await q.order("created_at", { ascending: false }).limit(effectiveLimit * 2);
        if (error) throw error;
        let cand = (data || []).map((l: any) => ({ id: l.id as string, nome: l.nome, telefone: l.telefone, ref: "pipeline_lead" as const }));
        if (dedupMode !== "include_all" && cand.length > 0) {
          const ids = cand.map((c) => c.id);
          let evQ = supabase.from("reengajamento_eventos")
            .select("lead_id")
            .eq("audience_source", audSource)
            .eq("tipo", "enviado")
            .in("lead_id", ids)
            .gte("created_at", dedupSince);
          if (dedupMode === "only_sent_before" && bodyAudience.dedup_cutoff) {
            evQ = evQ.lte("created_at", String(bodyAudience.dedup_cutoff));
          }
          const { data: evs } = await evQ;
          const enviadosSet = new Set((evs || []).map((e: any) => e.lead_id));
          if (dedupMode === "exclude_sent") cand = cand.filter((c) => !enviadosSet.has(c.id));
          else if (dedupMode === "only_sent_before") cand = cand.filter((c) => enviadosSet.has(c.id));
        }
        leads = cand.slice(0, effectiveLimit);
      } else if (src === "oferta_ativa_lista") {
        const listaIds: string[] = (bodyAudience.lista_ids && bodyAudience.lista_ids.length)
          ? bodyAudience.lista_ids.map(String)
          : (bodyAudience.lista_id ? [String(bodyAudience.lista_id)] : []);
        if (listaIds.length === 0) throw new Error("audience.lista_id ou lista_ids obrigatório");
        let q = supabase
          .from("oferta_ativa_leads")
          .select("id, nome, telefone")
          .in("lista_id", listaIds)
          .not("telefone", "is", null);
        if (bodyAudience.periodo?.from) q = q.gte("created_at", String(bodyAudience.periodo.from));
        if (bodyAudience.periodo?.to) q = q.lte("created_at", String(bodyAudience.periodo.to));
        if (bodyAudience.empreendimento) q = q.eq("empreendimento", String(bodyAudience.empreendimento));
        const { data, error } = await q.order("created_at", { ascending: false }).limit(effectiveLimit * 2);
        if (error) throw error;
        let cand = (data || []).map((l: any) => ({ id: l.id as string, nome: l.nome, telefone: l.telefone, ref: "oferta_ativa_lead" as const }));
        if (dedupMode !== "include_all" && cand.length > 0) {
          const ids = cand.map((c) => c.id);
          let evQ = supabase.from("reengajamento_eventos")
            .select("lead_id")
            .eq("audience_source", audSource)
            .eq("tipo", "enviado")
            .in("lead_id", ids)
            .gte("created_at", dedupSince);
          if (dedupMode === "only_sent_before" && bodyAudience.dedup_cutoff) {
            evQ = evQ.lte("created_at", String(bodyAudience.dedup_cutoff));
          }
          const { data: evs } = await evQ;
          const enviadosSet = new Set((evs || []).map((e: any) => e.lead_id));
          if (dedupMode === "exclude_sent") cand = cand.filter((c) => !enviadosSet.has(c.id));
          else if (dedupMode === "only_sent_before") cand = cand.filter((c) => enviadosSet.has(c.id));
        }
        leads = cand.slice(0, effectiveLimit);
      } else {
        throw new Error(`audience.source inválido: ${src}`);
      }
    } else {
      // === Fluxo legado: descartados reengajáveis ===
      let leadsQuery = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, tipo_descarte, stage_changed_at, reengajamento_enviado_at")
        .eq("stage_id", STAGE_DESCARTE_ID)
        .eq("tipo_descarte", "reengajavel")
        .not("telefone", "is", null);

      if (!bodyIncludeArchived) {
        leadsQuery = leadsQuery.eq("arquivado", false);
      }

      if (wave === 1) {
        leadsQuery = leadsQuery
          .is("reengajamento_enviado_at", null)
          .gte("stage_changed_at", cutoff);
      } else {
        const minDias = Math.max(0, Number(
          bodyMinDiasOverride !== null ? bodyMinDiasOverride : (cfg.wave2_min_dias_apos_wave1 || 5)
        ));
        const wave2Cutoff = new Date(Date.now() - minDias * 24 * 60 * 60 * 1000).toISOString();
        leadsQuery = leadsQuery
          .eq("reengajamento_status", "enviado")
          .is("reengajamento_wave2_at", null)
          .lte("reengajamento_enviado_at", wave2Cutoff);
      }

      const { data: legacyLeads, error: leadsErr } = await leadsQuery
        .order("stage_changed_at", { ascending: false })
        .limit(effectiveLimit);
      if (leadsErr) throw leadsErr;
      leads = (legacyLeads || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, ref: "pipeline_lead" }));
    }

    const totalAlvo = leads.length;

    const { data: runRow } = await supabase
      .from("reengajamento_dispatch_runs")
      .insert({
        status: "running",
        total_alvo: totalAlvo,
        iniciado_por: iniciadoPor,
        audience_source: isCustomAudience ? audSource : null,
        audience_payload: isCustomAudience ? bodyAudience : null,
      } as any)
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
      // Reset reativado_por_nutricao para permitir que o webhook reabra o ciclo de
      // reativação quando o lead responder SIM novamente (caso já tenha sido
      // reativado em ciclo anterior e descartado de novo).
      return wave === 2
        ? { reengajamento_wave2_at: nowIso, reengajamento_status: sentStatus, reativado_por_nutricao: false }
        : { reengajamento_enviado_at: nowIso, reengajamento_status: sentStatus, reativado_por_nutricao: false };
    };
    const markPhoneInvalidPatch = () => {
      const nowIso = new Date().toISOString();
      // Em wave 2 mantém status original e só marca wave2_at para não retentar
      return wave === 2
        ? { reengajamento_wave2_at: nowIso }
        : { reengajamento_status: "telefone_invalido", reengajamento_enviado_at: nowIso };
    };

    // Guard: só altera pipeline_leads quando o público é o legado (descartados)
    // ou quando o custom é descartados. Em pipeline_ativo/oferta_ativa não polui.
    const canTouchPipelineLead = (lead: { ref: string }) =>
      lead.ref === "pipeline_lead" && (!isCustomAudience || String(bodyAudience?.source) === "descartados");

    const insertEvento = async (payload: Record<string, unknown>) => {
      await supabase.from("reengajamento_eventos").insert({
        ...payload,
        audience_source: isCustomAudience ? audSource : null,
      } as any);
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
            body: JSON.stringify({ force: true, wave, iniciado_por: `${iniciadoPor}_continuacao`, min_dias_override: bodyMinDiasOverride, include_archived: bodyIncludeArchived, daily_limit_override: bodyDailyLimitOverride, audience: bodyAudience || undefined }),
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
        if (canTouchPipelineLead(lead)) {
          await supabase.from("pipeline_leads")
            .update(markPhoneInvalidPatch())
            .eq("id", lead.id);
        }
        await insertEvento({
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
          if (canTouchPipelineLead(lead)) {
            await supabase.from("pipeline_leads")
              .update(markPhoneInvalidPatch())
              .eq("id", lead.id);
          }
          await insertEvento({
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
          const headerImageUrl = String((wave === 2 ? cfg.meta_header_image_url_2 : cfg.meta_header_image_url) || "").trim() || undefined;
          const r = await sendMetaTemplate({
            phoneNumberId: metaPhoneId, accessToken: metaToken, to: phone,
            templateName: metaTemplate, lang: metaLang, nome: firstName, headerImageUrl,
          });
          if (!r.ok) {
            failed++;
            const errMsg = `${lead.nome}: ${r.error}`;
            errs.push(errMsg);
            await insertEvento({
              lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: errMsg.slice(0, 500),
            });

            // 🛑 Auto-pause: se 5+ falhas consecutivas com sinais de bloqueio Meta (template pausado / qualidade)
            if (isMetaQualityBlock(r.error || "")) {
              consecutiveMetaQualityFails++;
              if (consecutiveMetaQualityFails >= 5) {
                stopReason = `Auto-pausa: template "${metaTemplate}" provavelmente pausado pela Meta (${consecutiveMetaQualityFails} falhas consecutivas: "${(r.error || "").slice(0, 120)}"). Verifique o WhatsApp Manager.`;
                await supabase.from("reengajamento_config").update({ paused: true, updated_at: new Date().toISOString() }).eq("id", cfg.id);
                await insertEvento({
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
          // Audit log: SEMPRE registrar o disparo (independe do público)
          await supabase.from("reengajamento_meta_disparos").insert({
            lead_id: lead.id, run_id: runId, wamid: r.wamid, template_name: metaTemplate,
            template_language: metaLang, phone, status: "sent", sent_at: new Date().toISOString(),
            audience_source: audienceSourceCanonical,
          });
          // pipeline_leads.update só em público legado/descartados (não poluir oferta_ativa/pipeline_ativo)
          if (canTouchPipelineLead(lead)) {
            await supabase.from("pipeline_leads").update(markSentPatch()).eq("id", lead.id);
          }
          await insertEvento({
            lead_id: lead.id, run_id: runId, tipo: "enviado", detalhe: `[meta:${metaTemplate}] ${phone}`,
          });
          sent++;
        } else {
          // EVOLUTION com spintax
          const text = pickVariant(evoVariantes, evoTemplate, firstName);
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
              await insertEvento({
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
            await insertEvento({
              lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: errMsg.slice(0, 500),
            });
            await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20), ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
            continue;
          }
          const messageId = result?.key?.id || result?.messageId || crypto.randomUUID();
          if (canTouchPipelineLead(lead)) {
            await supabase.from("pipeline_leads").update(markSentPatch()).eq("id", lead.id);
            await supabase.from("whatsapp_mensagens").insert({
              lead_id: lead.id, instance_name: cfg.evolution_instance, direction: "sent",
              body: text, whatsapp_message_id: messageId, timestamp: new Date().toISOString(),
              delivery_status: "sent",
            });
          }
          await insertEvento({
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
            await insertEvento({
              lead_id: lead.id, run_id: runId, tipo: "pausa_longa", detalhe: `${Math.round(ms/1000)}s após ${sent} envios`,
            });
          }
          await new Promise(r => setTimeout(r, ms));
        }
      } catch (e) {
        failed++;
        const errMsg = `${lead.nome}: ${e instanceof Error ? e.message : String(e)}`;
        errs.push(errMsg);
        await insertEvento({
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
