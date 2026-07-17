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
// Encadeia o próximo lote bem antes do limite de wall-clock da plataforma (~150s),
// evitando que a função seja morta no meio e deixe o run travado em "running".
const MAX_RUN_MS = 110_000;
const STALE_RUNNING_MINUTES = 4;
// Meta marketing em base fria: priorizar reputação/entrega, não velocidade.
const META_DELAY_MIN_MS = 8_000;
const META_DELAY_MAX_MS = 15_000;
const META_GUARD_RECENT_MINUTES = 15;
const META_GUARD_MIN_RESOLVED = 30;
const META_THROTTLE_RATIO = 0.15;
const META_STRONG_THROTTLE_RATIO = 0.25;
const META_CRITICAL_FAIL_RATIO = 0.40;
const META_QUEUE_BATCH_SIZE = 3;
const EVOLUTION_QUEUE_BATCH_SIZE = 5;
const QUEUE_STALE_MINUTES = 6;
const CONSECUTIVE_FAILURE_PAUSE_LIMIT = 50;

type FailureCategory =
  | "meta_quality_pacing"
  | "meta_payment_eligibility"
  | "meta_user_experiment"
  | "meta_undeliverable"
  | "meta_optout"
  | "meta_template_paused"
  | "evolution_disconnected"
  | "evolution_unavailable"
  | "transient_external_api"
  | "unknown";

type MetaThrottleLevel = 0 | 1 | 2;

type MetaQualityDecision = {
  level: MetaThrottleLevel;
  ratio: number;
  resolved: number;
  qualityFailures: number;
  reason: string | null;
  critical: boolean;
};

export function metaThrottleForRatio(ratio: number, resolved: number): MetaThrottleLevel {
  if (resolved < META_GUARD_MIN_RESOLVED || ratio < META_THROTTLE_RATIO) return 0;
  return ratio >= META_STRONG_THROTTLE_RATIO ? 2 : 1;
}

export function metaDelayRange(level: MetaThrottleLevel): [number, number] {
  if (level === 2) return [45_000, 75_000];
  if (level === 1) return [20_000, 35_000];
  return [META_DELAY_MIN_MS, META_DELAY_MAX_MS];
}

const FAILURE_CATEGORY_LABELS: Record<FailureCategory, string> = {
  meta_quality_pacing: "Qualidade/limite da Meta",
  meta_payment_eligibility: "Elegibilidade ou pagamento da Meta",
  meta_user_experiment: "Restrição experimental da Meta para destinatários",
  meta_undeliverable: "Mensagem não entregue",
  meta_optout: "Destinatário optou por não receber marketing",
  meta_template_paused: "Template pausado/reprovado pela Meta",
  evolution_disconnected: "Instância WhatsApp desconectada",
  evolution_unavailable: "Evolution indisponível",
  transient_external_api: "Instabilidade temporária da API externa",
  unknown: "Falha não classificada",
};

function classifyFailure(raw: string | null | undefined): FailureCategory {
  const msg = (raw || "").toLowerCase();
  if (!msg) return "unknown";
  if (msg.includes("business eligibility") || msg.includes("payment issue") || msg.includes("billing")) return "meta_payment_eligibility";
  if (msg.includes("healthy ecosystem") || msg.includes("ecosystem engagement") || msg.includes("131049") || msg.includes("131050") || msg.includes("quality rating")) return "meta_quality_pacing";
  if (msg.includes("part of an experiment")) return "meta_user_experiment";
  if (msg.includes("stop receiving marketing") || msg.includes("opt-out") || msg.includes("opt out")) return "meta_optout";
  if (msg.includes("template is paused") || msg.includes("template paused") || msg.includes("template was paused") || msg.includes("132015") || msg.includes("132016")) return "meta_template_paused";
  if (msg.includes("message undeliverable") || msg.includes("unable to deliver")) return "meta_undeliverable";
  if (msg.includes("service temporarily unavailable") || msg.includes('"is_transient":true') || msg.includes("is_transient")) return "transient_external_api";
  if (msg.includes("connection closed") || msg.includes("disconnected") || msg.includes("close")) return "evolution_disconnected";
  if (msg.includes("cannot read properties of undefined") || msg.includes("evolution indisponível")) return "evolution_unavailable";
  return "unknown";
}

function explainFailureCategory(category: FailureCategory, sample?: string | null): string {
  const label = FAILURE_CATEGORY_LABELS[category] || FAILURE_CATEGORY_LABELS.unknown;
  if (category === "meta_quality_pacing") return `${label}: a Meta está limitando/recusando entrega para preservar qualidade. Pausa recomendada antes de retomar.`;
  if (category === "meta_payment_eligibility") return `${label}: revise cobrança/elegibilidade da conta antes de reenviar.`;
  if (category === "meta_user_experiment") return `${label}: parte dos destinatários não pode receber este marketing agora.`;
  if (category === "meta_undeliverable") return `${label}: os números/template não estão entregando com consistência.`;
  if (category === "meta_optout") return `${label}: não reenvie para esses números.`;
  if (category === "meta_template_paused") return `${label}: troque ou regularize o template antes de retomar.`;
  if (category === "evolution_disconnected") return `${label}: reconecte a instância antes de retomar.`;
  if (category === "evolution_unavailable") return `${label}: aguarde estabilidade da Evolution antes de retomar.`;
  if (category === "transient_external_api") return `${label}: pode ser reprocessado depois com segurança.`;
  return `${label}${sample ? `: ${sample.slice(0, 180)}` : "."}`;
}

async function interruptibleDelay(ms: number, shouldStop: () => Promise<boolean>): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await shouldStop()) return true;
    await new Promise((resolve) => setTimeout(resolve, Math.min(2000, deadline - Date.now())));
  }
  return false;
}

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

function normalizeInitiator(raw: string): string {
  const value = String(raw || "manual_custom").replace(/(_continuacao)+$/g, "");
  return value.length > 80 ? value.slice(0, 80) : value;
}

function last8Of(raw: string | null | undefined): string {
  const d = (raw || "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
}

function isMetaQualityBlockText(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("healthy ecosystem")
    || m.includes("ecosystem engagement")
    || m.includes("template is paused")
    || m.includes("template paused")
    || m.includes("template was paused")
    || m.includes("part of an experiment")
    || m.includes("131049")
    || m.includes("131050")
    || m.includes("132015")
    || m.includes("132016")
    || m.includes("quality rating");
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

// Faz upload da imagem de header UMA vez para a Meta e retorna um media id reutilizável.
// Elimina o "Media upload error" causado pela Meta refazer o fetch do link a cada envio.
async function uploadMetaMediaFromUrl(phoneNumberId: string, accessToken: string, imageUrl: string): Promise<string | null> {
  try {
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return null;
    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([bytes], { type: contentType }), `header.${contentType.includes("png") ? "png" : "jpg"}`);
    const up = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error("uploadMetaMediaFromUrl failed:", JSON.stringify(data).slice(0, 300));
      return null;
    }
    return data?.id || null;
  } catch (e) {
    console.error("uploadMetaMediaFromUrl error:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function sendMetaTemplate(params: {
  phoneNumberId: string; accessToken: string; to: string; templateName: string; lang: string; nome: string; headerImageUrl?: string; headerMediaId?: string;
}): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const url = `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`;
  const buildBody = (withHeader: boolean) => {
    const components: any[] = [];
    if (withHeader && (params.headerMediaId || params.headerImageUrl)) {
      // Preferir media id (upload único) ao link (refetch por envio = "Media upload error")
      const image = params.headerMediaId ? { id: params.headerMediaId } : { link: params.headerImageUrl };
      components.push({
        type: "header",
        parameters: [{ type: "image", image }],
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
    if (!resp.ok && (params.headerImageUrl || params.headerMediaId)) {
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

  // NOTA: o gate global (campaign_dispatch_enabled) é verificado ABAIXO, após o parse do body.
  // Disparos MANUAIS (iniciado_por começa com "manual" / "auto_resume_ui") — acionados
  // explicitamente pelo usuário na Central — passam mesmo com o kill-switch global desligado.
  // Qualquer chamada automática (cron/continuação não-manual) continua bloqueada.

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
  let bodyRunId: string | null = null;
  try {
    if (req.method === "POST") {
      const b = await req.clone().json().catch(() => ({}));
      bodyForce = !!(b as any)?.force;
      if ((b as any)?.iniciado_por) iniciadoPor = normalizeInitiator(String((b as any).iniciado_por));
      else if (bodyForce) iniciadoPor = "manual";
      if ((b as any)?.wave) bodyWave = Number((b as any).wave);
      if ((b as any)?.min_dias_override !== undefined && (b as any)?.min_dias_override !== null) {
        bodyMinDiasOverride = Number((b as any).min_dias_override);
      }
      bodyIncludeArchived = !!(b as any)?.include_archived;
      if ((b as any)?.daily_limit_override) bodyDailyLimitOverride = Number((b as any).daily_limit_override);
      if ((b as any)?.audience && typeof (b as any).audience === "object") bodyAudience = (b as any).audience;
      if ((b as any)?.run_id) bodyRunId = String((b as any).run_id);
    }
  } catch { /* ignore */ }

  // GATE GLOBAL — bloqueia qualquer disparo automático. Só passa disparo manual
  // explícito acionado pelo usuário (iniciado_por manual*/auto_resume_ui).
  const isManualDispatch = /^(manual|auto_resume_ui)/.test(iniciadoPor) || (!!bodyRunId && bodyForce);
  if (!isManualDispatch) {
    const gate = await isCampaignDispatchEnabled();
    if (!gate.enabled) return pausedResponse("reengajamento-descartados-enqueue", gate, corsHeaders);
  }


  // Fontes: aceita `sources: string[]` (combinado) ou `source` único (compat).
  const singleSourceKey = (src: string): string =>
    src === "descartados"
      ? `descartados:${bodyAudience.tipo_descarte || "reengajavel"}`
      : src === "oferta_ativa_lista"
        ? `oferta_ativa:${(((bodyAudience.lista_ids && bodyAudience.lista_ids.length) ? bodyAudience.lista_ids : (bodyAudience.lista_id ? [bodyAudience.lista_id] : [])) as string[]).slice().sort().join(",") || "?"}`
        : `pipeline:${(bodyAudience.stage_ids || []).slice().sort().join(",")}`;
  let sourcesArr: string[] = [];
  let isCustomAudience = false;
  let isCombined = false;
  let primarySource = "";
  let audSource = "";
  let audienceSourceCanonical = "legacy";
  const refreshAudienceContext = () => {
    sourcesArr = (Array.isArray(bodyAudience?.sources) && bodyAudience.sources.length)
      ? bodyAudience.sources.map(String)
      : (bodyAudience?.source ? [String(bodyAudience.source)] : []);
    isCustomAudience = sourcesArr.length > 0;
    isCombined = sourcesArr.length > 1;
    primarySource = sourcesArr[0] || "";
    audSource = isCustomAudience
      ? (isCombined ? `combo:${sourcesArr.slice().sort().join("+")}` : singleSourceKey(primarySource))
      : "";
    // Canonical source for routing on reply (column audience_source in reengajamento_meta_disparos)
    audienceSourceCanonical = isCustomAudience
      ? (isCombined ? "combo" : primarySource)
      : "legacy";
  };
  refreshAudienceContext();

  const url = new URL(req.url);
  const force = bodyForce || url.searchParams.get("force") === "1";
  const waveParam = bodyWave ?? Number(url.searchParams.get("wave") || "1");
  const wave: 1 | 2 = waveParam === 2 ? 2 : 1;
  const startedAt = Date.now();
  const workerId = crypto.randomUUID();
  let runId: string | null = null;
  const errs: string[] = [];

  const updateRun = async (patch: Record<string, unknown>) => {
    if (!runId) return;
    await supabase.from("reengajamento_dispatch_runs").update(patch).eq("id", runId);
  };

  try {
    await supabase
      .from("reengajamento_dispatch_runs")
      .update({
        status: "timeout",
        finished_at: new Date().toISOString(),
        motivo_parada: "Encerrado automaticamente: execução antiga ficou travada sem resposta da função",
      } as any)
      .eq("status", "running")
      .neq("id", bodyRunId || "00000000-0000-0000-0000-000000000000")
      .lt("started_at", new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000).toISOString());

    const { data: cfg } = await supabase.from("reengajamento_config").select("*").limit(1).maybeSingle();
    if (!cfg) return new Response(JSON.stringify({ error: "no config" }), { status: 500, headers: corsHeaders });

    if (!cfg.enabled && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!withinWindow(cfg) && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "out_of_window" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (bodyRunId) {
      const { data: existingRun, error: existingRunErr } = await supabase
        .from("reengajamento_dispatch_runs")
        .select("id, audience_payload, iniciado_por, status")
        .eq("id", bodyRunId)
        .maybeSingle();
      if (existingRunErr || !existingRun) {
        return new Response(JSON.stringify({ error: "run_not_found", run_id: bodyRunId }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      bodyAudience = (existingRun as any).audience_payload || bodyAudience;
      iniciadoPor = normalizeInitiator(String((existingRun as any).iniciado_por || iniciadoPor));
      refreshAudienceContext();
    }

    if ((cfg as any).paused_until_release && !force) {
      return new Response(JSON.stringify({
        skipped: true,
        paused: true,
        reason: "locked_quality_pause",
        motivo: (cfg as any).paused_reason || "Pausa de qualidade ativa",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Uma continuação automática (micro-lote seguinte) NÃO deve limpar a pausa/cancelamento
    // do usuário. Detectamos continuação por run_id no body OU iniciado_por "*_continuacao".
    const isContinuation = !!bodyRunId || /_continuacao$/.test(iniciadoPor);

    // Se for continuação e o usuário já pediu para pausar/parar, encerra sem processar mais nada.
    if (isContinuation) {
      const { data: liveCfgPre } = await supabase
        .from("reengajamento_config").select("paused, enabled").eq("id", cfg.id).maybeSingle();
      let cancelRequested = false;
      if (bodyRunId) {
        const { data: runPre } = await supabase
          .from("reengajamento_dispatch_runs").select("cancel_requested").eq("id", bodyRunId).maybeSingle();
        cancelRequested = !!(runPre as any)?.cancel_requested;
      }
      if (cancelRequested || (liveCfgPre as any)?.paused) {
        if (bodyRunId) {
          await supabase.from("reengajamento_dispatch_runs").update({
            status: cancelRequested ? "cancelled" : "paused",
            finished_at: new Date().toISOString(),
            motivo_parada: cancelRequested ? "Parado pelo usuário" : "Pausado pelo usuário",
          } as any).eq("id", bodyRunId);
          // Libera itens presos em "processing" para não travar a fila.
          await supabase.from("reengajamento_dispatch_queue")
            .update({ status: "pending", locked_at: null, locked_by: null } as any)
            .eq("run_id", bodyRunId).eq("status", "processing");
        }
        return new Response(JSON.stringify({
          skipped: true,
          paused: !cancelRequested,
          cancelled: cancelRequested,
          reason: cancelRequested ? "cancelled" : "paused",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Só limpa a pausa em um início manual (force sem ser continuação).
    if (force && !isContinuation) {
      await supabase.from("reengajamento_config").update({
        paused: false,
        paused_until_release: false,
        paused_reason: null,
        guard_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq("id", cfg.id);
    }


    const { data: activeRuns } = await supabase
      .from("reengajamento_dispatch_runs")
      .select("id, started_at, enviados, falhas, ignorados")
      .eq("status", "running")
      .gte("started_at", new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000).toISOString())
      .neq("id", bodyRunId || "00000000-0000-0000-0000-000000000000")
      .order("started_at", { ascending: false })
      .limit(1);
    if (activeRuns && activeRuns.length > 0) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: "active_run_in_progress",
        active_run_id: activeRuns[0].id,
        message: "Já existe um disparo em andamento; esta chamada foi ignorada para evitar duplicidade.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const requestedCanal = String(bodyAudience?.canal || "").toLowerCase();
    const canal: "meta" | "evolution" = requestedCanal === "meta" || requestedCanal === "evolution"
      ? requestedCanal
      : ((cfg.canal === "meta") ? "meta" : "evolution");

    // Validações por canal
    let evoUrl = "", evoKey = "";
    let metaPhoneId = "", metaToken = "", metaTemplate = "", metaLang = "pt_BR";
    let metaHeaderImageUrl: string | undefined;
    let metaHeaderMediaId: string | undefined;
    // Imagem de header por disparo (override): cada template pode ter sua própria imagem fixa.
    const overrideHeaderImg = (bodyAudience?.header_image_url && String(bodyAudience.header_image_url).trim()) || "";
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
      // Imagem de header: resolve uma vez e faz upload UMA vez para obter media id reutilizável.
      metaHeaderImageUrl = overrideHeaderImg || String((wave === 2 ? cfg.meta_header_image_url_2 : cfg.meta_header_image_url) || "").trim() || undefined;
      if (metaHeaderImageUrl) {
        metaHeaderMediaId = (await uploadMetaMediaFromUrl(metaPhoneId, metaToken, metaHeaderImageUrl)) || undefined;
        console.log(`Meta header media: ${metaHeaderMediaId ? `id=${metaHeaderMediaId}` : "upload falhou, fallback para link"}`);
      }
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

    let leads: Array<{ id: string; queue_id?: string; nome: string; telefone: string | null; email?: string | null; ref: "pipeline_lead" | "oferta_ativa_lead" }> = [];
    let supressosRemovidos = 0;
    let pipelineAtivosRemovidos = 0;
    let frequenciaRemovidos = 0;
    let telefonesInvalidosRemovidos = 0;
    let removidosPorTemplateRecente = 0;
    let removidosPorEventoRecente = 0;
    let duplicadosFilaRemovidos = 0;
    let totalBrutoCapturado: number | null = null;
    let totalAlvo = 0;
    let initialSent = 0;
    let initialFailed = 0;
    let initialSkipped = 0;

    if (!bodyRunId && isCustomAudience) {
      const dedupMode = String(bodyAudience.dedup_mode || "exclude_sent");
      const dedupLookbackDays = Math.max(1, Number(bodyAudience.dedup_lookback_days || 30));
      const dedupSince = new Date(Date.now() - dedupLookbackDays * 24 * 3600 * 1000).toISOString();
      type Lead = { id: string; nome: string; telefone: string | null; email?: string | null; ref: "pipeline_lead" | "oferta_ativa_lead" };
      const last8 = (raw: string | null): string => {
        const d = (raw || "").replace(/\D/g, "");
        return d.length >= 8 ? d.slice(-8) : d;
      };
      const empList: string[] = (Array.isArray((bodyAudience as any).empreendimentos) && (bodyAudience as any).empreendimentos.length)
        ? ((bodyAudience as any).empreendimentos as unknown[]).filter((s): s is string => typeof s === "string" && s.length > 0)
        : (bodyAudience.empreendimento ? [String(bodyAudience.empreendimento)] : []);


      const fetchDescartados = async (cap: number): Promise<Lead[]> => {
        const includeArchivedCustom = bodyAudience.include_archived === true;
        const tipoFilter = String(bodyAudience.tipo_descarte || "reengajavel");
        const cooldownDias = Math.max(0, Number(bodyAudience.cooldown_dias ?? 7));
        const cooldownCutoff = new Date(Date.now() - cooldownDias * 24 * 3600 * 1000).toISOString();
        const RESPONDEU_NAO = ["respondeu_nao", "respondeu_nao_wave2", "bloqueado", "telefone_invalido"];
        let q: any = supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, email, reengajamento_enviado_at")
          .eq("stage_id", STAGE_DESCARTE_ID)
          .not("telefone", "is", null);
        if (!includeArchivedCustom) q = q.eq("arquivado", false);
        if (tipoFilter === "reengajavel") {
          // NULL-safe: leads sem tipo_descarte/status (nunca contatados) SÃO reengajáveis
          q = q.or("tipo_descarte.is.null,tipo_descarte.neq.definitivo")
               .or(`reengajamento_status.is.null,reengajamento_status.not.in.(${RESPONDEU_NAO.join(",")})`);
        } else if (tipoFilter === "definitivo") {
          q = q.eq("tipo_descarte", "definitivo");
        }
        if (bodyAudience.periodo?.from) q = q.gte("stage_changed_at", String(bodyAudience.periodo.from));
        if (bodyAudience.periodo?.to) q = q.lte("stage_changed_at", String(bodyAudience.periodo.to));
        if (empList.length) q = q.in("empreendimento", empList);
        const motivosSel = Array.isArray((bodyAudience as any).motivos_descarte)
          ? ((bodyAudience as any).motivos_descarte as unknown[]).filter((s): s is string => typeof s === "string" && s.length > 0)
          : [];
        if (motivosSel.length) q = q.in("motivo_descarte", motivosSel);
        if (dedupMode === "exclude_sent") {
          q = q.is("reengajamento_enviado_at", null);
        } else if (dedupMode === "only_sent_before" && bodyAudience.dedup_cutoff) {
          q = q.not("reengajamento_enviado_at", "is", null)
               .filter("reengajamento_enviado_at", "lte", String(bodyAudience.dedup_cutoff));
        } else if (dedupMode === "include_all") {
          // sem filtro
        } else if (cooldownDias > 0) {
          q = q.or(`reengajamento_enviado_at.is.null,reengajamento_enviado_at.lt.${cooldownCutoff}`);
        }
        const { data, error } = await q.order("stage_changed_at", { ascending: false }).limit(cap);
        if (error) throw error;
        return (data || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, email: l.email, ref: "pipeline_lead" }));
      };

      const dedupViaEventos = async (cand: Lead[], sourceKey: string): Promise<Lead[]> => {
        if (dedupMode === "include_all" || cand.length === 0) return cand;
        const ids = cand.map((c) => c.id);
        let evQ = supabase.from("reengajamento_eventos")
          .select("lead_id")
          .eq("audience_source", sourceKey)
          .eq("tipo", "enviado")
          .in("lead_id", ids)
          .gte("created_at", dedupSince);
        if (dedupMode === "only_sent_before" && bodyAudience.dedup_cutoff) {
          evQ = evQ.lte("created_at", String(bodyAudience.dedup_cutoff));
        }
        const { data: evs } = await evQ;
        const enviadosSet = new Set((evs || []).map((e: any) => e.lead_id));
        if (dedupMode === "exclude_sent") {
          const filtered = cand.filter((c) => !enviadosSet.has(c.id));
          removidosPorEventoRecente += cand.length - filtered.length;
          return filtered;
        }
        if (dedupMode === "only_sent_before") return cand.filter((c) => enviadosSet.has(c.id));
        return cand;
      };

      const dedupOfertaViaMetaTemplate = async (cand: Lead[]): Promise<Lead[]> => {
        if (canal !== "meta" || !metaTemplate || dedupMode === "include_all" || cand.length === 0) return cand;
        const phonesSent = new Set<string>();
        let mf = 0;
        const PG = 1000;
        while (true) {
          const { data: rows, error: rowsErr } = await supabase
            .from("reengajamento_meta_disparos")
            .select("phone")
            .eq("template_name", metaTemplate)
            .gte("created_at", dedupSince)
            .not("phone", "is", null)
            .range(mf, mf + PG - 1);
          if (rowsErr) { console.error("dedup meta disparos error:", rowsErr.message); break; }
          if (!rows || rows.length === 0) break;
          for (const row of rows) {
            const key = last8(String((row as any).phone || ""));
            if (key) phonesSent.add(key);
          }
          if (rows.length < PG) break;
          mf += PG;
        }
        if (phonesSent.size === 0) return cand;
        const before = cand.length;
        const filtered = cand.filter((lead) => !phonesSent.has(last8(lead.telefone)));
        removidosPorTemplateRecente += before - filtered.length;
        console.log(`Dedup Meta template ${metaTemplate}: ${before - filtered.length} oferta ativa removidos por tentativa recente`);
        return filtered;
      };

      const fetchPipelineAtivo = async (cap: number): Promise<Lead[]> => {
        const stageIds: string[] = (bodyAudience.stage_ids || []).filter(Boolean);
        if (stageIds.length === 0) throw new Error("audience.stage_ids vazio");
        let q = supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, email")
          .in("stage_id", stageIds)
          .eq("arquivado", false)
          .not("telefone", "is", null);
        if (bodyAudience.periodo?.from) q = q.gte("created_at", String(bodyAudience.periodo.from));
        if (bodyAudience.periodo?.to) q = q.lte("created_at", String(bodyAudience.periodo.to));
        if (empList.length) q = q.in("empreendimento", empList);
        const { data, error } = await q.order("created_at", { ascending: false }).limit(cap);
        if (error) throw error;
        const cand = (data || []).map((l: any) => ({ id: l.id as string, nome: l.nome, telefone: l.telefone, email: l.email, ref: "pipeline_lead" as const }));
        return dedupViaEventos(cand, `pipeline:${(bodyAudience.stage_ids || []).slice().sort().join(",")}`);
      };

      const fetchOfertaAtiva = async (cap: number): Promise<Lead[]> => {
        const listaIds: string[] = (bodyAudience.lista_ids && bodyAudience.lista_ids.length)
          ? bodyAudience.lista_ids.map(String)
          : (bodyAudience.lista_id ? [String(bodyAudience.lista_id)] : []);
        if (listaIds.length === 0) throw new Error("audience.lista_id ou lista_ids obrigatório");
        const buildQuery = () => {
          let q = supabase
            .from("oferta_ativa_leads")
            .select("id, nome, telefone, email")
            .in("lista_id", listaIds)
            .not("telefone", "is", null);
          if (bodyAudience.periodo?.from) q = q.gte("created_at", String(bodyAudience.periodo.from));
          if (bodyAudience.periodo?.to) q = q.lte("created_at", String(bodyAudience.periodo.to));
          if (empList.length) q = q.in("empreendimento", empList);
          return q.order("created_at", { ascending: false });
        };
        // Paginação: PostgREST limita respostas a ~1000 linhas por padrão, então
        // .limit(cap) sozinho nunca traz a lista inteira. Buscamos em páginas de 1000.
        const PAGE = 1000;
        const rows: any[] = [];
        let off = 0;
        while (rows.length < cap) {
          const upper = Math.min(off + PAGE, cap) - 1;
          const { data: pageData, error } = await buildQuery().range(off, upper);
          if (error) throw error;
          if (!pageData || pageData.length === 0) break;
          rows.push(...pageData);
          if (pageData.length < PAGE) break;
          off += PAGE;
        }
        const cand = rows.map((l: any) => ({ id: l.id as string, nome: l.nome, telefone: l.telefone, email: l.email, ref: "oferta_ativa_lead" as const }));
        totalBrutoCapturado = Math.max(totalBrutoCapturado || 0, rows.length);

        const byEventos = await dedupViaEventos(cand, `oferta_ativa:${listaIds.slice().sort().join(",")}`);
        return dedupOfertaViaMetaTemplate(byEventos);
      };

      const fetchForSource = async (src: string, cap: number): Promise<Lead[]> => {
        if (src === "descartados") return fetchDescartados(cap);
        if (src === "pipeline_ativo") return fetchPipelineAtivo(cap);
        if (src === "oferta_ativa_lista") return fetchOfertaAtiva(cap);
        throw new Error(`audience.source inválido: ${src}`);
      };

      if (!isCombined) {
        leads = (await fetchForSource(primarySource, primarySource === "descartados" ? effectiveLimit : effectiveLimit * 2)).slice(0, effectiveLimit);
      } else {
        // Combinado: prioridade descartados > oferta_ativa > pipeline_ativo, dedup por últimos 8 dígitos.
        const priority = ["descartados", "oferta_ativa_lista", "pipeline_ativo"];
        const ordered = priority.filter((s) => sourcesArr.includes(s));
        const seen = new Set<string>();
        const merged: Lead[] = [];
        for (const src of ordered) {
          const part = await fetchForSource(src, effectiveLimit * 2);
          for (const l of part) {
            const key = last8(l.telefone);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            merged.push(l);
            if (merged.length >= effectiveLimit) break;
          }
          if (merged.length >= effectiveLimit) break;
        }
        leads = merged;
      }
    } else if (!bodyRunId) {
      // === Fluxo legado: descartados reengajáveis ===
      let leadsQuery = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, email, tipo_descarte, stage_changed_at, reengajamento_enviado_at")
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
      leads = (legacyLeads || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, email: l.email, ref: "pipeline_lead" }));
    }

    if (!bodyRunId && isCustomAudience && leads.length > 0) {
      const before = leads.length;
      leads = leads.filter((l) => !!normalizePhone(l.telefone || ""));
      telefonesInvalidosRemovidos = before - leads.length;
      if (telefonesInvalidosRemovidos > 0) {
        console.log(`Telefones inválidos removidos antes da fila: ${telefonesInvalidosRemovidos} de ${before}`);
      }
    }

    // ── Supressão automática (só Meta): remove números que já falharam por
    // bloqueio de qualidade / opt-out / indisponível, evitando queimar a reputação do número.
    //
    // MODO TESTE CAUTELOSO: quando bodyAudience.modo_teste = true, "fura" APENAS as
    // supressões de motivo "Recebeu e/ou leu" / "cooldown_engajou" (que são cooldowns
    // reversíveis, não bloqueios reais da Meta). Bloqueios 131049/131050/131026/respondeu_nao
    // continuam intocáveis.
    const modoTeste = !!(bodyAudience as any)?.modo_teste && canal === "meta";
    if (!bodyRunId && canal === "meta" && leads.length > 0) {
      const nowIso = new Date().toISOString();
      const supressSet = new Set<string>();
      let from = 0;
      const PAGE = 1000;
      // paginar supressões ativas (permanente OR cooldown ainda vigente)
      // deslint: loop controlado por tamanho de página
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: sup, error: supErr } = await supabase
          .from("meta_supressao")
          .select("telefone_last8, suprimir_ate, motivo")
          .or(`suprimir_ate.is.null,suprimir_ate.gt.${nowIso}`)
          .range(from, from + PAGE - 1);
        if (supErr) { console.error("meta_supressao fetch error:", supErr.message); break; }
        if (!sup || sup.length === 0) break;
        for (const s of sup) {
          const motivo = String((s as any).motivo || "");
          // No modo teste, ignora somente cooldowns de engajamento (Recebeu/leu).
          if (modoTeste && /recebeu e\/ou leu|cooldown_engajou/i.test(motivo)) continue;
          supressSet.add(String(s.telefone_last8));
        }
        if (sup.length < PAGE) break;
        from += PAGE;
      }
      if (supressSet.size > 0) {
        const last8 = (raw: string | null): string => {
          const d = (raw || "").replace(/\D/g, "");
          return d.length >= 8 ? d.slice(-8) : d;
        };
        const before = leads.length;
        leads = leads.filter((l) => !supressSet.has(last8(l.telefone)));
        supressosRemovidos = before - leads.length;
        console.log(`Supressão Meta${modoTeste ? " (modo teste, ignora cooldown_engajou)" : ""}: ${supressosRemovidos} removidos de ${before} (lista ativa: ${supressSet.size})`);
      }
    }


    // ── GUARDA DE EXCLUSIVIDADE DO PIPELINE (crítico, todos os canais) ──
    // Nunca dispara para quem é lead ATIVO no pipeline (telefone OU e-mail).
    // Checagem em tempo de disparo: cobre quem virou lead ativo depois de entrar na lista.
    if (!bodyRunId && leads.length > 0) {
      const phoneSet = new Set<string>();
      const emailSet = new Set<string>();
      let pf = 0;
      const PG = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: pa, error: paErr } = await supabase
          .from("v_pipeline_ativo_contatos")
          .select("telefone_last8, email")
          .range(pf, pf + PG - 1);
        if (paErr) { console.error("v_pipeline_ativo_contatos error:", paErr.message); break; }
        if (!pa || pa.length === 0) break;
        for (const r of pa) {
          if (r.telefone_last8) phoneSet.add(String(r.telefone_last8));
          if (r.email) emailSet.add(String(r.email).toLowerCase());
        }
        if (pa.length < PG) break;
        pf += PG;
      }
      if (phoneSet.size > 0 || emailSet.size > 0) {
        const before = leads.length;
        leads = leads.filter((l) => {
          const ph = last8Of(l.telefone);
          const em = (l.email || "").trim().toLowerCase();
          if (ph && phoneSet.has(ph)) return false;
          if (em && emailSet.has(em)) return false;
          return true;
        });
        pipelineAtivosRemovidos = before - leads.length;
        console.log(`Guarda pipeline ativo: ${pipelineAtivosRemovidos} removidos de ${before}`);
      }
    }

    // ── GOVERNADOR DE FREQUÊNCIA POR DESTINATÁRIO (anti-131049) ──
    // Pula quem recebeu QUALQUER marketing (reengajamento + campanhas) nos últimos N dias.
    const freqCooldownDias = Math.max(0, Number((cfg as any).freq_cooldown_dias ?? 14));
    if (!bodyRunId && canal === "meta" && freqCooldownDias > 0 && leads.length > 0) {
      const freqCutoff = new Date(Date.now() - freqCooldownDias * 24 * 3600 * 1000).toISOString();
      const recentSet = new Set<string>();
      let ff = 0;
      const PG = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: fr, error: frErr } = await supabase
          .from("v_ultimo_marketing_por_telefone")
          .select("last8, ultimo_envio")
          .gt("ultimo_envio", freqCutoff)
          .range(ff, ff + PG - 1);
        if (frErr) { console.error("v_ultimo_marketing error:", frErr.message); break; }
        if (!fr || fr.length === 0) break;
        for (const r of fr) recentSet.add(String(r.last8));
        if (fr.length < PG) break;
        ff += PG;
      }
      if (recentSet.size > 0) {
        const before = leads.length;
        leads = leads.filter((l) => !recentSet.has(last8Of(l.telefone)));
        frequenciaRemovidos = before - leads.length;
        console.log(`Governador de frequência (${freqCooldownDias}d): ${frequenciaRemovidos} removidos de ${before}`);
      }
    }

    totalAlvo = leads.length;

    // ── MODO TESTE CAUTELOSO: amostra aleatória do público elegível ──
    // Alvo: 5% dos elegíveis, com mín 50 e máx 300. Se o público for menor que o mínimo,
    // usa o que houver. Sorteio embaralhado para não viesar por ordem de criação.
    let modoTesteInfo: null | { pct: number; min: number; max: number; original: number; sampled: number } = null;
    if (modoTeste && leads.length > 0 && !bodyRunId) {
      const MIN = 50, MAX = 300, PCT = 0.05;
      const target = Math.min(MAX, Math.max(MIN, Math.ceil(leads.length * PCT)));
      const finalSize = Math.min(target, leads.length);
      // shuffle Fisher-Yates
      for (let i = leads.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [leads[i], leads[j]] = [leads[j], leads[i]];
      }
      const original = leads.length;
      leads = leads.slice(0, finalSize);
      modoTesteInfo = { pct: PCT, min: MIN, max: MAX, original, sampled: leads.length };
      console.log(`Modo teste cauteloso: amostra de ${leads.length} sorteada de ${original} elegíveis`);
      totalAlvo = leads.length;
      // marca no bodyAudience para persistir no audience_payload da run
      bodyAudience = { ...(bodyAudience || {}), modo_teste: true, modo_teste_info: modoTesteInfo };
    }


    const buildAudienceAudit = (queueTotal?: number) => {
      const existingAudit = bodyAudience?.__audit && typeof bodyAudience.__audit === "object" ? bodyAudience.__audit : null;
      if (existingAudit) return { ...existingAudit, enfileirados: queueTotal ?? existingAudit.enfileirados ?? totalAlvo };
      return {
        total_bruto: totalBrutoCapturado ?? (totalAlvo + supressosRemovidos + pipelineAtivosRemovidos + frequenciaRemovidos + telefonesInvalidosRemovidos + removidosPorTemplateRecente + removidosPorEventoRecente),
        removidos_evento_recente: removidosPorEventoRecente,
        removidos_template_recente: removidosPorTemplateRecente,
        telefones_invalidos: telefonesInvalidosRemovidos,
        removidos_pipeline_ativo: pipelineAtivosRemovidos,
        removidos_frequencia: frequenciaRemovidos,
        suprimidos: supressosRemovidos,
        duplicados_fila: duplicadosFilaRemovidos,
        elegiveis_calculados: totalAlvo,
        enfileirados: queueTotal ?? totalAlvo,
      };
    };

    if (bodyRunId) {
      runId = bodyRunId;
      // IMPORTANTE: não resetar cancel_requested aqui. Se o usuário clicou "Parar"
      // durante o lote anterior, a continuação deve respeitar o cancelamento
      // (o guard em isContinuation acima já encerra o run antes de chegar aqui).
      await updateRun({
        status: "running",
        started_at: new Date().toISOString(),
        finished_at: null,
        motivo_parada: "Retomando fila pendente em micro-lotes",
      } as any);
    } else {
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

      if (runId && totalAlvo > 0) {
        const queueSeen = new Set<string>();
        const queueRows = leads
          .map((lead) => {
            const phone = normalizePhone(lead.telefone || "");
            const last8 = last8Of(phone || lead.telefone);
            if (!last8) return null;
            const dedupeKey = `${last8}:${canal === "meta" ? metaTemplate : "evolution"}`;
            if (queueSeen.has(dedupeKey)) return null;
            queueSeen.add(dedupeKey);
            return {
              run_id: runId,
              lead_id: lead.id,
              lead_ref: lead.ref,
              nome: lead.nome,
              telefone: lead.telefone,
              email: lead.email || null,
              phone_normalized: phone,
              phone_last8: last8,
              template_name: canal === "meta" ? metaTemplate : null,
              template_language: canal === "meta" ? metaLang : null,
              audience_source: audienceSourceCanonical,
              status: phone ? "pending" : "skipped",
              error_text: phone ? null : "telefone inválido",
              processed_at: phone ? null : new Date().toISOString(),
            };
          })
          .filter(Boolean);
        duplicadosFilaRemovidos = Math.max(0, totalAlvo - queueRows.length);
        for (let i = 0; i < queueRows.length; i += 500) {
          const { error: queueErr } = await supabase
            .from("reengajamento_dispatch_queue")
            .insert(queueRows.slice(i, i + 500) as any);
          if (queueErr) throw queueErr;
        }
        totalAlvo = queueRows.length;
        await updateRun({
          total_alvo: totalAlvo,
          audience_payload: isCustomAudience ? { ...bodyAudience, __audit: buildAudienceAudit(queueRows.length) } : bodyAudience,
          motivo_parada: `Fila criada: ${queueRows.length} números enfileirados de ${buildAudienceAudit(queueRows.length).total_bruto} registros brutos.`,
        } as any);
      }
    }

    const exclusoes = { suprimidos: supressosRemovidos, pipeline_ativo: pipelineAtivosRemovidos, frequencia: frequenciaRemovidos };
    const usingPersistentQueue = !!runId;

    if (usingPersistentQueue) {
      await supabase
        .from("reengajamento_dispatch_queue")
        .update({ status: "pending", locked_at: null } as any)
        .eq("run_id", runId)
        .eq("status", "processing")
        .lt("locked_at", new Date(Date.now() - QUEUE_STALE_MINUTES * 60 * 1000).toISOString());

      const [{ count: queueTotal }, { count: sentCount }, { count: failedCount }, { count: skippedCount }, { count: pendingCount }, { count: processingCount }] = await Promise.all([
        supabase.from("reengajamento_dispatch_queue").select("id", { count: "exact", head: true }).eq("run_id", runId),
        supabase.from("reengajamento_dispatch_queue").select("id", { count: "exact", head: true }).eq("run_id", runId).eq("status", "sent"),
        supabase.from("reengajamento_dispatch_queue").select("id", { count: "exact", head: true }).eq("run_id", runId).eq("status", "failed"),
        supabase.from("reengajamento_dispatch_queue").select("id", { count: "exact", head: true }).eq("run_id", runId).in("status", ["skipped", "suppressed", "cancelled"]),
        supabase.from("reengajamento_dispatch_queue").select("id", { count: "exact", head: true }).eq("run_id", runId).eq("status", "pending"),
        supabase.from("reengajamento_dispatch_queue").select("id", { count: "exact", head: true }).eq("run_id", runId).eq("status", "processing"),
      ]);

      totalAlvo = queueTotal || totalAlvo;
      initialSent = sentCount || 0;
      initialFailed = failedCount || 0;
      initialSkipped = skippedCount || 0;
      await updateRun({ total_alvo: totalAlvo, enviados: initialSent, falhas: initialFailed, ignorados: initialSkipped } as any);

      if ((pendingCount || 0) === 0 && (processingCount || 0) === 0) {
        const finalFailed = failedCount || 0;
        const finalSent = sentCount || 0;
        const finalSkipped = skippedCount || 0;
        const finalStatus = finalSent === 0 && totalAlvo > 0 ? "no_send" : "completed";
        const audit = buildAudienceAudit(totalAlvo);
        const auditTail = isCustomAudience
          ? ` Funil: ${audit.total_bruto} brutos → ${audit.enfileirados} enfileirados (${audit.telefones_invalidos} inválidos, ${audit.suprimidos} supressão Meta, ${audit.removidos_frequencia} frequência, ${audit.removidos_pipeline_ativo} pipeline ativo, ${audit.removidos_template_recente} template recente).`
          : "";
        const finalReason = finalStatus === "no_send"
          ? `Fila encerrada sem envio real via ${canal}: ${finalFailed} falhas e ${finalSkipped} ignorados de ${totalAlvo}. Motivo predominante: ${finalFailed > 0 ? explainFailureCategory(predominantFailureCategory(), errs[errs.length - 1]) : "leads ignorados por telefone inválido, supressão ou guarda de segurança"}.${auditTail}`
          : `Fila concluída via ${canal} (${finalSent}/${totalAlvo} enviados${finalFailed > 0 ? `, ${finalFailed} falhas` : ""}).${auditTail}`;
        await updateRun({ status: finalStatus, finished_at: new Date().toISOString(), motivo_parada: finalReason, enviados: finalSent, falhas: finalFailed, ignorados: finalSkipped });
        return new Response(JSON.stringify({ run_id: runId, sent: finalSent, failed: finalFailed, skipped: finalSkipped, total: totalAlvo, queued: totalAlvo, audit, reason: finalStatus, canal, queue_done: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const batchSize = canal === "meta" ? META_QUEUE_BATCH_SIZE : EVOLUTION_QUEUE_BATCH_SIZE;
      const { data: queueBatch, error: queueBatchErr } = await supabase.rpc(
        "claim_reengajamento_dispatch_queue",
        { p_run_id: runId, p_batch_size: batchSize, p_worker_id: workerId },
      );
      if (queueBatchErr) throw queueBatchErr;
      leads = (queueBatch || []).map((q: any) => ({
        id: q.lead_id,
        queue_id: q.id,
        nome: q.nome,
        telefone: q.phone_normalized || q.telefone,
        email: q.email,
        ref: q.lead_ref,
      }));
    }

    if (totalAlvo === 0) {
      const motivo = `Nenhum lead elegível. Removidos: ${pipelineAtivosRemovidos} ativos no pipeline, ${frequenciaRemovidos} por frequência, ${supressosRemovidos} suprimidos.`;
      await updateRun({ status: "completed", finished_at: new Date().toISOString(), motivo_parada: motivo });
      return new Response(JSON.stringify({ run_id: runId, sent: 0, total: 0, reason: "no_leads", canal, exclusoes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        return new Response(JSON.stringify({ ok: false, run_id: runId, error: reason, message: reason, reason: "instance_disconnected", recoverable: true, canal }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const delayMin = Math.max(2, Number(cfg.delay_min_seconds || 60));
    const delayMax = Math.max(delayMin, Number(cfg.delay_max_seconds || 180));
    const pausaA = Math.max(2, Number(cfg.pausa_longa_a_cada || 6));
    const pausaMin = Math.max(30, Number(cfg.pausa_longa_min_seconds || 180));
    const pausaMax = Math.max(pausaMin, Number(cfg.pausa_longa_max_seconds || 480));

    let sent = initialSent, failed = initialFailed, skipped = initialSkipped;
    let stopReason: string | null = null;
    let consecutiveMetaQualityFails = 0;
    let metaThrottleLevel = Math.min(2, Math.max(0, Number((cfg as any).throttle_level || 0))) as MetaThrottleLevel;

    // ── MODO TESTE CAUTELOSO: auto-pausa por janela deslizante ──
    // Ativa quando a run foi criada como modo_teste (persistido em audience_payload).
    // Regras: >15% falha nos últimos 20 envios OU total de falhas ≥ 20 → pausa e alerta.
    const runIsModoTeste = !!((bodyAudience as any)?.modo_teste);
    const MODO_TESTE_WINDOW = 20;
    const MODO_TESTE_FAIL_RATE = 0.15;
    const MODO_TESTE_MAX_FAILS = 20;
    const modoTesteWindow: number[] = []; // 1 = failed, 0 = sent
    const pushModoTesteOutcome = (isFail: boolean) => {
      if (!runIsModoTeste) return;
      modoTesteWindow.push(isFail ? 1 : 0);
      if (modoTesteWindow.length > MODO_TESTE_WINDOW) modoTesteWindow.shift();
    };
    const shouldPauseModoTeste = (): string | null => {
      if (!runIsModoTeste) return null;
      if (failed >= MODO_TESTE_MAX_FAILS) {
        return `Modo teste cauteloso: pausado ao atingir ${failed} falhas totais (limite ${MODO_TESTE_MAX_FAILS}). Revise a saúde do template/base antes de expandir.`;
      }
      if (modoTesteWindow.length >= MODO_TESTE_WINDOW) {
        const failInWindow = modoTesteWindow.reduce((a, b) => a + b, 0);
        const rate = failInWindow / modoTesteWindow.length;
        if (rate > MODO_TESTE_FAIL_RATE) {
          return `Modo teste cauteloso: pausado com ${failInWindow}/${modoTesteWindow.length} falhas nos últimos envios (${(rate * 100).toFixed(0)}% > ${(MODO_TESTE_FAIL_RATE * 100).toFixed(0)}%). Sinal de que a base/template está queimando reputação.`;
        }
      }
      return null;
    };


    const failureCategoryCounts: Record<string, number> = {};

    const rememberFailureCategory = (raw: string | null | undefined): FailureCategory => {
      const category = classifyFailure(raw);
      failureCategoryCounts[category] = (failureCategoryCounts[category] || 0) + 1;
      return category;
    };

    const predominantFailureCategory = (): FailureCategory => {
      const entries = Object.entries(failureCategoryCounts).sort((a, b) => b[1] - a[1]);
      return (entries[0]?.[0] as FailureCategory | undefined) || "unknown";
    };

    const pauseMetaForQuality = async (reason: string) => {
      await supabase.from("reengajamento_config").update({
        paused: true,
        paused_until_release: true,
        paused_reason: reason.slice(0, 500),
        paused_at_brt: nowBRT().toISOString().replace("Z", ""),
        updated_at: new Date().toISOString(),
      } as any).eq("id", cfg.id);
      return reason;
    };

    const persistThrottle = async (decision: MetaQualityDecision) => {
      if (decision.level === metaThrottleLevel) return;
      metaThrottleLevel = decision.level;
      const statusText = decision.level === 0
        ? "Ritmo normal restabelecido"
        : `Ritmo ${decision.level === 2 ? "fortemente reduzido" : "reduzido"}: ${(decision.ratio * 100).toFixed(0)}% de bloqueios recentes`;
      await supabase.from("reengajamento_config").update({
        throttle_level: decision.level,
        throttle_updated_at: new Date().toISOString(),
        paused_reason: decision.level > 0 ? statusText : null,
        updated_at: new Date().toISOString(),
      } as any).eq("id", cfg.id);
      await updateRun({ motivo_parada: statusText });
      await supabase.from("reengajamento_eventos").insert({
        run_id: runId,
        tipo: decision.level > 0 ? "ritmo_reduzido_meta" : "ritmo_normal_meta",
        detalhe: statusText,
        audience_source: isCustomAudience ? audSource : null,
      } as any);
    };

    const shouldStopNow = async () => {
      const [{ data: runState }, { data: liveCfg }] = await Promise.all([
        supabase.from("reengajamento_dispatch_runs").select("cancel_requested").eq("id", runId).maybeSingle(),
        supabase.from("reengajamento_config").select("paused, enabled").eq("id", cfg.id).maybeSingle(),
      ]);
      if (runState?.cancel_requested) {
        stopReason = "Parado pelo usuário";
        await updateRun({ status: "cancelled", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });
        return true;
      }
      if (liveCfg?.paused) {
        stopReason = "Pausado pelo usuário";
        await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });
        return true;
      }
      if (!liveCfg?.enabled && !force) {
        stopReason = "Disparo desativado";
        await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });
        return true;
      }
      return false;
    };

    // 🛑 Guarda de qualidade por TAXA DE ENTREGA (via webhook), GLOBAL entre continuações.
    // O erro 131049 ("healthy ecosystem engagement") chega DEPOIS do envio (status sent ok),
    // então só dá pra detectá-lo olhando delivered/read x failed reportados pelo webhook.
    // Se o bloco começar, pausa cedo para não transformar 30 falhas em 300+ falhas.
    const checkDeliveryQuality = async (): Promise<MetaQualityDecision> => {
      const normal: MetaQualityDecision = { level: 0, ratio: 0, resolved: 0, qualityFailures: 0, reason: null, critical: false };
      if (canal !== "meta" || !metaTemplate) return normal;
      const since = new Date(Date.now() - META_GUARD_RECENT_MINUTES * 60 * 1000).toISOString();
      const { data: lastTemplateRows } = await supabase
        .from("reengajamento_meta_disparos")
        .select("status, error_text, created_at")
        .eq("template_name", metaTemplate)
        .order("created_at", { ascending: false })
        .limit(CONSECUTIVE_FAILURE_PAUSE_LIMIT);
      if (lastTemplateRows && lastTemplateRows.length >= CONSECUTIVE_FAILURE_PAUSE_LIMIT && lastTemplateRows.every((row: any) => row.status === "failed")) {
        const counts: Record<string, number> = {};
        let sample: string | null = null;
        for (const row of lastTemplateRows as any[]) {
          if (!sample && row.error_text) sample = String(row.error_text);
          const c = classifyFailure(row.error_text);
          counts[c] = (counts[c] || 0) + 1;
        }
        const category = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as FailureCategory | undefined) || "unknown";
        return { level: 2, ratio: 1, resolved: lastTemplateRows.length, qualityFailures: lastTemplateRows.length, reason: `Pausa crítica por ${CONSECUTIVE_FAILURE_PAUSE_LIMIT} falhas seguidas no template "${metaTemplate}". ${explainFailureCategory(category, sample)}`, critical: true };
      }
      const [failedRes, deliveredRes, readRes, respRes, qualityFailRes] = await Promise.all([
        supabase.from("reengajamento_meta_disparos").select("id", { count: "exact", head: true }).eq("template_name", metaTemplate).gte("created_at", since).eq("status", "failed"),
        supabase.from("reengajamento_meta_disparos").select("id", { count: "exact", head: true }).eq("template_name", metaTemplate).gte("created_at", since).eq("status", "delivered"),
        supabase.from("reengajamento_meta_disparos").select("id", { count: "exact", head: true }).eq("template_name", metaTemplate).gte("created_at", since).eq("status", "read"),
        supabase.from("reengajamento_meta_disparos").select("id", { count: "exact", head: true }).eq("template_name", metaTemplate).gte("created_at", since).eq("status", "responded"),
        supabase.from("reengajamento_meta_disparos").select("id", { count: "exact", head: true }).eq("template_name", metaTemplate).gte("created_at", since).eq("status", "failed").or("error_text.ilike.%131049%,error_text.ilike.%healthy ecosystem%,error_text.ilike.%131050%,error_text.ilike.%132015%,error_text.ilike.%132016%"),
      ]);
      const failedN = failedRes.count || 0;
      const qualityFailN = qualityFailRes.count || 0;
      const okN = (deliveredRes.count || 0) + (readRes.count || 0) + (respRes.count || 0);
      const resolved = failedN + okN;
      if (resolved < META_GUARD_MIN_RESOLVED) return { ...normal, resolved, qualityFailures: qualityFailN };
      const ratio = qualityFailN / resolved;
      const level = metaThrottleForRatio(ratio, resolved);
      const critical = ratio > META_CRITICAL_FAIL_RATIO;
      const reason = level > 0
        ? `${critical ? "Pausa crítica" : "Redução automática de ritmo"}: ${(ratio * 100).toFixed(0)}% de bloqueios Meta recentes (${qualityFailN}/${resolved}) no template "${metaTemplate}" nos últimos ${META_GUARD_RECENT_MINUTES}min.`
        : null;
      return { level, ratio, resolved, qualityFailures: qualityFailN, reason, critical };
    };

    if (canal === "meta") {
      const preflightQuality = await checkDeliveryQuality();
      await persistThrottle(preflightQuality);
      if (preflightQuality.critical && preflightQuality.reason) {
        const reason = await pauseMetaForQuality(preflightQuality.reason);
        await updateRun({
          status: "paused",
          finished_at: new Date().toISOString(),
          motivo_parada: reason,
          enviados: sent,
          falhas: failed,
          ignorados: skipped,
          erros: errs.slice(-20),
        });
        if (runId) {
          await supabase
            .from("reengajamento_dispatch_queue")
            .update({ status: "pending", locked_at: null, locked_by: null } as any)
            .eq("run_id", runId)
            .eq("status", "processing")
            .eq("locked_by", workerId);
        }
        return new Response(JSON.stringify({ skipped: true, paused: true, reason: "meta_quality_critical", motivo: reason, canal }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
      lead.ref === "pipeline_lead" && (!isCustomAudience || sourcesArr.includes("descartados"));

    const insertEvento = async (payload: Record<string, unknown>) => {
      await supabase.from("reengajamento_eventos").insert({
        ...payload,
        audience_source: isCustomAudience ? audSource : null,
      } as any);
    };

    const updateQueueItem = async (lead: { queue_id?: string }, status: string, errorText?: string | null) => {
      if (!lead.queue_id) return;
      await supabase
        .from("reengajamento_dispatch_queue")
        .update({
          status,
          error_text: errorText ? String(errorText).slice(0, 500) : null,
          processed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
        } as any)
        .eq("id", lead.queue_id)
        .eq("locked_by", workerId);
    };

    const releaseProcessingQueue = async () => {
      if (!runId) return;
      await supabase
        .from("reengajamento_dispatch_queue")
        .update({ status: "pending", locked_at: null, locked_by: null } as any)
        .eq("run_id", runId)
        .eq("status", "processing")
        .eq("locked_by", workerId);
    };

    const getConsecutiveQueueFailureStreak = async (): Promise<{ streak: number; sample: string | null; category: FailureCategory } | null> => {
      if (!runId) return null;
      const { data } = await supabase
        .from("reengajamento_dispatch_queue")
        .select("status, error_text, processed_at")
        .eq("run_id", runId)
        .not("processed_at", "is", null)
        .order("processed_at", { ascending: false })
        .limit(CONSECUTIVE_FAILURE_PAUSE_LIMIT);
      if (!data || data.length < CONSECUTIVE_FAILURE_PAUSE_LIMIT) return null;
      const allFailed = data.every((row: any) => row.status === "failed");
      if (!allFailed) return null;
      const counts: Record<string, number> = {};
      let sample: string | null = null;
      for (const row of data as any[]) {
        if (!sample && row.error_text) sample = String(row.error_text);
        const c = classifyFailure(row.error_text);
        counts[c] = (counts[c] || 0) + 1;
      }
      const category = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as FailureCategory | undefined) || predominantFailureCategory();
      return { streak: data.length, sample, category };
    };

    const getConsecutiveMetaFailureStreak = async (): Promise<{ streak: number; sample: string | null; category: FailureCategory } | null> => {
      if (!runId || canal !== "meta") return null;
      const { data } = await supabase
        .from("reengajamento_meta_disparos")
        .select("status, error_text, created_at")
        .eq("run_id", runId)
        .order("created_at", { ascending: false })
        .limit(CONSECUTIVE_FAILURE_PAUSE_LIMIT);
      if (!data || data.length < CONSECUTIVE_FAILURE_PAUSE_LIMIT) return null;
      const allFailed = data.every((row: any) => row.status === "failed");
      if (!allFailed) return null;
      const counts: Record<string, number> = {};
      let sample: string | null = null;
      for (const row of data as any[]) {
        if (!sample && row.error_text) sample = String(row.error_text);
        const c = classifyFailure(row.error_text);
        counts[c] = (counts[c] || 0) + 1;
      }
      const category = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as FailureCategory | undefined) || predominantFailureCategory();
      return { streak: data.length, sample, category };
    };

    const pauseAfterConsecutiveFailures = async (lead: { id: string; nome: string }, latestError: string) => {
      const streak = (await getConsecutiveQueueFailureStreak()) || (await getConsecutiveMetaFailureStreak());
      if (!streak || streak.streak < CONSECUTIVE_FAILURE_PAUSE_LIMIT) return null;
      const reason = `Campanha pausada automaticamente após ${streak.streak} falhas seguidas via ${canal}${metaTemplate ? ` no template "${metaTemplate}"` : ""}. Motivo predominante: ${explainFailureCategory(streak.category, streak.sample)} Último erro: ${(latestError || streak.sample || "sem detalhe").slice(0, 220)}`;
      stopReason = reason;
      await supabase.from("reengajamento_config").update({
        paused: true,
        paused_reason: reason.slice(0, 500),
        paused_at_brt: nowBRT().toISOString().replace("Z", ""),
        updated_at: new Date().toISOString(),
      } as any).eq("id", cfg.id);
      await insertEvento({
        lead_id: lead.id,
        run_id: runId,
        tipo: "auto_pausa_50_falhas",
        detalhe: reason.slice(0, 500),
      });
      await updateRun({
        status: "paused",
        finished_at: new Date().toISOString(),
        motivo_parada: reason.slice(0, 500),
        enviados: sent,
        falhas: failed,
        ignorados: skipped,
        erros: errs.slice(-20),
        ultimo_lead_id: lead.id,
        ultimo_lead_nome: lead.nome,
      } as any);
      await releaseProcessingQueue();
      return { reason, category: streak.category, streak: streak.streak };
    };

    const scheduleQueueContinuation = async (motivo: string) => {
      if (!runId) return false;
      await updateRun({ status: "running", finished_at: null, motivo_parada: motivo, enviados: sent, falhas: failed, ignorados: skipped } as any);
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const continuation = fetch(`${supabaseUrl}/functions/v1/reengajamento-descartados-enqueue`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ force: true, run_id: runId, iniciado_por: `${normalizeInitiator(iniciadoPor)}_continuacao` }),
        }).catch((err) => console.error("Falha ao retomar fila persistente:", err));
        const edgeRuntime = (globalThis as any).EdgeRuntime;
        if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(continuation);
        return true;
      } catch (chainErr) {
        console.error("Erro ao agendar continuação da fila:", chainErr);
        return false;
      }
    };

    for (const lead of leads || []) {
      if (await shouldStopNow()) {
        await releaseProcessingQueue();
        const cancelled = stopReason === "Parado pelo usuário";
        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: cancelled ? "cancelled" : "paused", cancelled, paused: !cancelled, canal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Modo teste cauteloso: verifica auto-pausa antes de cada envio
      {
        const modoTesteReason = shouldPauseModoTeste();
        if (modoTesteReason) {
          stopReason = modoTesteReason;
          await insertEvento({ lead_id: lead.id, run_id: runId, tipo: "auto_pausa_modo_teste", detalhe: stopReason.slice(0, 500) });
          await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20) });
          await releaseProcessingQueue();
          return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "auto_paused_modo_teste", paused: true, canal, motivo: stopReason }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      if (Date.now() - startedAt > MAX_RUN_MS) {
        if (usingPersistentQueue) {
          await releaseProcessingQueue();
          const restantes = Math.max(0, totalAlvo - sent - failed - skipped);
          stopReason = `Micro-lote concluído (${sent}/${totalAlvo}). Retomando automaticamente os ${restantes} pendentes da fila...`;
          await scheduleQueueContinuation(stopReason);
          return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "queue_batch_continued", canal, continuation: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Encadeia automaticamente um próximo run para continuar de onde parou
        // (a query já exclui leads com reengajamento_enviado_at preenchido).
        const restantes = totalAlvo - sent - failed - skipped;
        stopReason = `Lote 1 concluído (${sent}/${totalAlvo}). Continuando automaticamente em novo lote para os ${restantes} restantes...`;
        await updateRun({ status: "completed", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped });

        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          // Mantém a requisição de continuação viva mesmo após retornar a resposta atual.
          // Sem waitUntil, o runtime pode cancelar o fetch em background e interromper a cadeia.
          const continuation = fetch(`${supabaseUrl}/functions/v1/reengajamento-descartados-enqueue`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ force: true, wave, iniciado_por: `${normalizeInitiator(iniciadoPor)}_continuacao`, min_dias_override: bodyMinDiasOverride, include_archived: bodyIncludeArchived, daily_limit_override: bodyDailyLimitOverride, audience: bodyAudience || undefined }),
          }).catch((err) => console.error("Falha ao encadear próximo lote:", err));
          const edgeRuntime = (globalThis as any).EdgeRuntime;
          if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(continuation);
        } catch (chainErr) {
          console.error("Erro ao agendar continuação:", chainErr);
        }

        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "batch_continued", canal, continuation: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        await updateQueueItem(lead, "skipped", "telefone inválido");
        await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
        continue;
      }

      // Guarda WABA histórica: opt-out, descarte definitivo e bombardeio por telefone/template.
      if (canal === "meta") {
        const { data: allowedData, error: allowedErr } = await supabase.rpc("check_send_allowed" as any, {
          p_lead_id: lead.ref === "pipeline_lead" ? lead.id : null,
          p_phone: phone,
          p_template: metaTemplate,
        });
        const allowed = (allowedData as any)?.allowed !== false;
        if (!allowedErr && !allowed) {
          const reason = String((allowedData as any)?.reason || "Bloqueado por guarda WABA");
          await insertEvento({
            lead_id: lead.id, run_id: runId, tipo: "ignorado_guard_waba", detalhe: reason.slice(0, 500),
          });
          skipped++;
          await updateQueueItem(lead, "suppressed", reason);
          await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
          continue;
        }
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
          await updateQueueItem(lead, "skipped", "sem WhatsApp");
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
            headerImageUrl: metaHeaderImageUrl, headerMediaId: metaHeaderMediaId,
          });
          if (!r.ok) {
            failed++;
            pushModoTesteOutcome(true);

            const errMsg = `${lead.nome}: ${r.error}`;
            errs.push(errMsg);
            rememberFailureCategory(r.error || errMsg);
            if (isMetaQualityBlockText(r.error || "")) {
              const last8 = phone.slice(-8);
              const code = (r.error || "").match(/13\d{4}/)?.[0] || null;
              const suprimirAte = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
              const { data: existingSup } = await supabase
                .from("meta_supressao")
                .select("id, ocorrencias")
                .eq("telefone_last8", last8)
                .maybeSingle();
              if (existingSup?.id) {
                await supabase.from("meta_supressao").update({
                  codigo: code,
                  motivo: "Falha síncrona de qualidade Meta",
                  template_name: metaTemplate,
                  suprimir_ate: suprimirAte,
                  ocorrencias: (existingSup.ocorrencias || 1) + 1,
                }).eq("id", existingSup.id);
              } else {
                await supabase.from("meta_supressao").insert({
                  telefone: phone,
                  telefone_last8: last8,
                  codigo: code,
                  motivo: "Falha síncrona de qualidade Meta",
                  template_name: metaTemplate,
                  suprimir_ate: suprimirAte,
                });
              }
            }
            await insertEvento({
              lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: errMsg.slice(0, 500),
            });
            await supabase.from("reengajamento_meta_disparos").insert({
              lead_id: lead.id,
              run_id: runId,
              wamid: null,
              template_name: metaTemplate,
              template_language: metaLang,
              phone,
              status: "failed",
              error_text: errMsg.slice(0, 500),
              sent_at: new Date().toISOString(),
              audience_source: audienceSourceCanonical,
            });
            await updateQueueItem(lead, "failed", errMsg);

            const fiftyPause = await pauseAfterConsecutiveFailures(lead, errMsg);
            if (fiftyPause) {
              return new Response(JSON.stringify({ ok: false, run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "auto_paused_50_consecutive_failures", paused: true, recoverable: true, canal, motivo: fiftyPause.reason, failure_category: fiftyPause.category }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 🛑 Auto-pause: só trava se falhar SEM PARAR (15+ falhas consecutivas com bloqueio Meta).
            // Enquanto estiver enviando mais do que falhando, segue (modo lento cuida do pacing).
            if (isMetaQualityBlockText(r.error || "")) {
              consecutiveMetaQualityFails++;
              if (consecutiveMetaQualityFails >= CONSECUTIVE_FAILURE_PAUSE_LIMIT) {
                stopReason = await pauseMetaForQuality(`Auto-pausa: template "${metaTemplate}" provavelmente pausado/limitado pela Meta (${consecutiveMetaQualityFails} falhas consecutivas: "${(r.error || "").slice(0, 120)}").`);
                await insertEvento({
                  lead_id: lead.id, run_id: runId, tipo: "auto_pausa_meta", detalhe: stopReason.slice(0, 500),
                });
                await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20) });
                await releaseProcessingQueue();
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
          await updateQueueItem(lead, "sent", null);
          sent++;
          pushModoTesteOutcome(false);


          // Guarda de qualidade por taxa de entrega — checa cedo e entre continuações
          if (sent % 5 === 0) {
            const quality = await checkDeliveryQuality();
            await persistThrottle(quality);
            if (quality.critical && quality.reason) {
              await insertEvento({ lead_id: lead.id, run_id: runId, tipo: "auto_pausa_meta", detalhe: quality.reason.slice(0, 500) });
                stopReason = await pauseMetaForQuality(quality.reason);
                await updateRun({ status: "paused", finished_at: new Date().toISOString(), motivo_parada: stopReason, enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20) });
                await releaseProcessingQueue();
                return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "auto_paused_delivery_quality", paused: true, canal, motivo: quality.reason }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }
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
              pushModoTesteOutcome(true);

              errs.push(`${lead.nome}: ${payloadText}`);
              rememberFailureCategory(payloadText);
              await insertEvento({
                lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: `${lead.nome}: ${payloadText}`.slice(0, 500),
              });
              await updateQueueItem(lead, "failed", payloadText);
              const fiftyPause = await pauseAfterConsecutiveFailures(lead, payloadText);
              if (fiftyPause) {
                return new Response(JSON.stringify({ ok: false, run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "auto_paused_50_consecutive_failures", paused: true, recoverable: true, canal, motivo: fiftyPause.reason, failure_category: fiftyPause.category }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
              }
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
              await releaseProcessingQueue();
              return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "evolution_unavailable", error: reason, canal }), {
                status: 502,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            failed++;
            pushModoTesteOutcome(true);

            const errMsg = `${lead.nome}: ${payloadText}`;
            errs.push(errMsg);
            rememberFailureCategory(payloadText);
            await insertEvento({
              lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: errMsg.slice(0, 500),
            });
            await updateQueueItem(lead, "failed", errMsg);
            const fiftyPause = await pauseAfterConsecutiveFailures(lead, errMsg);
            if (fiftyPause) {
              return new Response(JSON.stringify({ ok: false, run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "auto_paused_50_consecutive_failures", paused: true, recoverable: true, canal, motivo: fiftyPause.reason, failure_category: fiftyPause.category }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20), ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
            continue;
          }
          const resultObj = result && typeof result === "object" ? result as Record<string, unknown> : {};
          const resultKey = resultObj.key && typeof resultObj.key === "object" ? resultObj.key as Record<string, unknown> : {};
          const messageId = String(resultKey.id || resultObj.messageId || crypto.randomUUID());
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
          await updateQueueItem(lead, "sent", null);
          sent++;
          pushModoTesteOutcome(false);

        }

        await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });

        // Delays:
        // - Meta: 8-15s no ritmo normal, com redução adaptativa diante de bloqueios 131049
        // - Evolution: 60-180s + pausa longa a cada N envios
        if (canal === "meta") {
          const [metaDelayMin, metaDelayMax] = metaDelayRange(metaThrottleLevel);
          if (await interruptibleDelay(metaDelayMin + Math.random() * (metaDelayMax - metaDelayMin), shouldStopNow)) {
            await releaseProcessingQueue();
            const cancelled = stopReason === "Parado pelo usuário";
            return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: cancelled ? "cancelled" : "paused", cancelled, paused: !cancelled, canal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
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
          if (await interruptibleDelay(ms, shouldStopNow)) {
            await releaseProcessingQueue();
            const cancelled = stopReason === "Parado pelo usuário";
            return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: cancelled ? "cancelled" : "paused", cancelled, paused: !cancelled, canal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch (e) {
        failed++;
        pushModoTesteOutcome(true);

        const errMsg = `${lead.nome}: ${e instanceof Error ? e.message : String(e)}`;
        errs.push(errMsg);
        rememberFailureCategory(errMsg);
        await insertEvento({
          lead_id: lead.id, run_id: runId, tipo: "falha_envio", detalhe: errMsg.slice(0, 500),
        });
        await updateQueueItem(lead, "failed", errMsg);
        const fiftyPause = await pauseAfterConsecutiveFailures(lead, errMsg);
        if (fiftyPause) {
          return new Response(JSON.stringify({ ok: false, run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "auto_paused_50_consecutive_failures", paused: true, recoverable: true, canal, motivo: fiftyPause.reason, failure_category: fiftyPause.category }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await updateRun({ enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20), ultimo_lead_id: lead.id, ultimo_lead_nome: lead.nome });
      }
    }

    if (usingPersistentQueue) {
      const [{ count: pendingAfter }, { count: processingAfter }] = await Promise.all([
        supabase
          .from("reengajamento_dispatch_queue")
          .select("id", { count: "exact", head: true })
          .eq("run_id", runId)
          .eq("status", "pending"),
        supabase
          .from("reengajamento_dispatch_queue")
          .select("id", { count: "exact", head: true })
          .eq("run_id", runId)
          .eq("status", "processing"),
      ]);
      if ((pendingAfter || 0) > 0) {
        const motivo = `Micro-lote concluído (${sent}/${totalAlvo}). Retomando automaticamente ${pendingAfter} pendentes da fila.`;
        await scheduleQueueContinuation(motivo);
        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "queue_batch_continued", canal, continuation: true, pending: pendingAfter }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ((processingAfter || 0) > 0) {
        const motivo = `Aguardando ${(processingAfter || 0)} item(ns) já reservados por outro worker.`;
        await updateRun({ status: "running", finished_at: null, motivo_parada: motivo, enviados: sent, falhas: failed, ignorados: skipped });
        return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, reason: "queue_workers_active", canal, processing: processingAfter }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const finalAudit = buildAudienceAudit(totalAlvo);
    const finalAuditTail = isCustomAudience
      ? ` Funil: ${finalAudit.total_bruto} brutos → ${finalAudit.enfileirados} enfileirados (${finalAudit.telefones_invalidos} inválidos, ${finalAudit.suprimidos} supressão Meta, ${finalAudit.removidos_frequencia} frequência, ${finalAudit.removidos_pipeline_ativo} pipeline ativo, ${finalAudit.removidos_template_recente} template recente).`
      : "";
    const finalStatus = sent === 0 && totalAlvo > 0 ? "no_send" : "completed";
    const finalReason = finalStatus === "no_send"
      ? `Disparo encerrado sem envio real via ${canal}: ${failed} falhas e ${skipped} ignorados de ${totalAlvo}. Motivo predominante: ${failed > 0 ? explainFailureCategory(predominantFailureCategory(), errs[errs.length - 1]) : "leads ignorados por telefone inválido, supressão ou guarda de segurança"}.${finalAuditTail}`
      : `Disparo concluído via ${canal} (${sent}/${totalAlvo} enviados${failed > 0 ? `, ${failed} falhas` : ""}).${finalAuditTail}`;

    await updateRun({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      motivo_parada: finalReason,
      enviados: sent, falhas: failed, ignorados: skipped, erros: errs.slice(-20),
    });

    return new Response(JSON.stringify({ run_id: runId, sent, failed, skipped, total: totalAlvo, queued: totalAlvo, audit: finalAudit, reason: finalStatus, canal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("reengajamento-enqueue error:", msg);
    if (runId) {
      await updateRun({ status: "error", finished_at: new Date().toISOString(), motivo_parada: msg.slice(0, 500), erros: errs.slice(-20) });
      await supabase
        .from("reengajamento_dispatch_queue")
        .update({ status: "pending", locked_at: null, locked_by: null, error_text: `Erro da função: ${msg}`.slice(0, 500) } as any)
        .eq("run_id", runId)
        .eq("status", "processing")
        .eq("locked_by", workerId);
    }
    return new Response(JSON.stringify({ ok: false, run_id: runId, error: msg, message: msg, reason: "edge_function_error", recoverable: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
