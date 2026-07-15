/**
 * receive-meta-lead — Public webhook for Meta Ads (Facebook/Instagram) lead forms.
 * Receives leads directly from Meta Ads webhooks or Make.com/Zapier integrations.
 * Applies dedup (phone), resolves empreendimento via property_code or
 * jetimob_campaign_map, and distributes through the roleta.
 *
 * Supports multiple payload formats:
 * 1. Flat JSON: { name, email, phone, campaign_id, ... }
 * 2. Make.com format: { data: { full_name, phone_number, campaign_id: ["2776"], property_code: ["32849-UH"] }, mappable_field_data: [{name, value}], adId, formId, adgroupId }
 * 3. Meta Ads native: { field_data: [{name, values: [...]}] }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { PostgrestError } from "https://esm.sh/@supabase/supabase-js@2";
import { distributeLeadDirect } from "../_shared/roleta-distribution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Anonimização para BLOCO 4a (error_detail em ops_events) ──
// Pseudonimização defense-in-depth. RLS de ops_events restringe leitura a role 'admin'
// (policy "Admins can read ops_events"), então pseudonímo fraco é aceitável.
async function sha256Short(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).slice(0, 4).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function anonPhone(phone: string): Promise<string> {
  if (!phone) return "";
  const head = phone.slice(0, 4);
  const tail = phone.slice(-4);
  return `${head}…${await sha256Short(tail)}`;
}
function anonEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "";
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

/** Extract a string from a value that may be string, array, or undefined */
function extractStr(val: any): string {
  if (typeof val === "string" && val.trim()) return val.trim();
  if (Array.isArray(val) && val.length > 0 && val[0]) return String(val[0]).trim();
  return "";
}

function normalizeTimelineText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isSameTimelineText(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeTimelineText(a);
  const nb = normalizeTimelineText(b);
  return !!na && !!nb && (na === nb || na.includes(nb) || nb.includes(na));
}

function addTimelineDetail(parts: string[], label: string, value: string | null | undefined, blocked: Array<string | null | undefined> = []) {
  const clean = (value || "").trim();
  if (!clean) return;
  if (blocked.some((b) => isSameTimelineText(clean, b))) return;
  if (parts.some((p) => isSameTimelineText(p.replace(/^.*?:\s*/, ""), clean))) return;
  parts.push(`${label}: ${clean}`);
}

function friendlyMetaSource(raw: string | null | undefined): string {
  const p = normalizeTimelineText(raw);
  if (!p || p.includes("meta") || p.includes("facebook") || p.includes("instagram") || p.includes("backfill")) return "Meta Ads";
  return "Meta Ads";
}

function normalizeLower(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

function isLikelyTestLead(name: string, email: string, message: string): boolean {
  const combined = `${normalizeLower(name)} ${normalizeLower(email)} ${normalizeLower(message)}`;

  // Meta/Make test payload markers
  if (combined.includes("<test lead:")) return true;
  if (combined.includes("dummy data")) return true;
  if (combined.includes("test@meta")) return true;

  // Common test-only names/emails
  const testTokens = [" lead teste ", " teste make ", " qa ", " sandbox "];
  return testTokens.some((token) => combined.includes(token));
}

// ── Native Meta Leadgen webhook support ──
const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/** Verify Meta's X-Hub-Signature-256 header (HMAC-SHA256 of raw body with app secret). */
async function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader) return false;
  const expected = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time-ish compare
  if (computed.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Fetch a single lead's full data from the Graph API by leadgen_id. */
async function fetchMetaLead(leadgenId: string, token: string): Promise<any> {
  const fields = "id,created_time,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,form_id,platform,field_data";
  const url = `${META_BASE}/${leadgenId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(`graph leadgen fetch: ${JSON.stringify(j.error || j)}`);
  return j;
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Native Meta webhook verification (GET hub.challenge) ──
  if (req.method === "GET") {
    const u = new URL(req.url);
    const mode = u.searchParams.get("hub.mode");
    const token = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("META_WEBHOOK_SECRET");
    if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }


  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

  const L = {
    info: (msg: string, ctx?: Record<string, unknown>) => console.info(JSON.stringify({ fn: "receive-meta-lead", level: "info", msg, traceId, ctx, ts: new Date().toISOString() })),
    warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(JSON.stringify({ fn: "receive-meta-lead", level: "warn", msg, traceId, ctx, ts: new Date().toISOString() })),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => console.error(JSON.stringify({ fn: "receive-meta-lead", level: "error", msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() })),
  };

  const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
    supabase.from("ops_events").insert({ fn: "receive-meta-lead", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
  };

  try {
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Native Meta Leadgen webhook (object=page, entry[].changes[].value.leadgen_id) ──
    if (body && body.object === "page" && Array.isArray(body.entry)) {
      const appSecret = Deno.env.get("META_APP_SECRET");
      const graphToken = Deno.env.get("META_GRAPH_API_TOKEN");
      const selfSecret = Deno.env.get("META_WEBHOOK_SECRET");

      if (!appSecret) {
        L.error("META_APP_SECRET not configured — cannot verify native webhook signature");
        logOps("error", "integration", "meta_native_webhook_no_app_secret", {});
        return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sigOk = await verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret);
      if (!sigOk) {
        L.warn("Native webhook signature invalid");
        logOps("warn", "integration", "meta_native_webhook_bad_signature", {});
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!graphToken || !selfSecret) {
        L.error("Missing META_GRAPH_API_TOKEN or META_WEBHOOK_SECRET for native processing");
        return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Collect all leadgen_ids in the payload
      const leadgenIds: string[] = [];
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          if (change.field === "leadgen" && change.value?.leadgen_id) {
            leadgenIds.push(String(change.value.leadgen_id));
          }
        }
      }
      L.info("Native Meta webhook received", { count: leadgenIds.length });

      // Process each lead: fetch full data + forward to standard processing flow
      const results = await Promise.allSettled(leadgenIds.map(async (lid) => {
        const lead = await fetchMetaLead(lid, graphToken);
        const forwardBody = {
          secret: selfSecret,
          source: "meta_native",
          platform: lead.platform || "meta_ads",
          lead_id: lead.id,
          field_data: lead.field_data || [],
          campaign_id: lead.campaign_id,
          campaign_name: lead.campaign_name,
          adset_name: lead.adset_name,
          ad_name: lead.ad_name,
          formId: lead.form_id,
          form_name: lead.form_name,
        };
        const resp = await fetch(`${supabaseUrl}/functions/v1/receive-meta-lead`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-webhook-secret": selfSecret, "x-trace-id": traceId },
          body: JSON.stringify(forwardBody),
        });
        if (!resp.ok) throw new Error(`forward failed ${resp.status}: ${await resp.text()}`);
        return lid;
      }));

      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;
      if (failed > 0) {
        L.error("Native webhook: some leads failed", { ok, failed });
        logOps("error", "integration", "meta_native_webhook_partial", { ok, failed },
          results.filter((r) => r.status === "rejected").map((r: any) => String(r.reason)).join(" | "));
      } else {
        logOps("info", "integration", "meta_native_webhook_ok", { ok });
      }
      // Always 200 to Meta to avoid webhook disabling/retries storms
      return new Response(JSON.stringify({ success: true, processed: ok, failed }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    L.info("Raw body received", { source: body.source || body.platform, hasData: !!body.data });

    // ── Auth: simple secret (required) ──
    const webhookSecret = Deno.env.get("META_WEBHOOK_SECRET");
    if (!webhookSecret) {
      L.warn("META_WEBHOOK_SECRET not configured — rejecting request");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const provided = body.secret || req.headers.get("x-webhook-secret") || "";
    if (provided !== webhookSecret) {
      L.warn("Auth failed", { source: body.source });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse fields from top-level body ──
    const v = (...keys: string[]): string => {
      for (const k of keys) {
        const r = extractStr(body[k]);
        if (r) return r;
      }
      return "";
    };

    let name = v("name", "full_name", "nome", "Nome", "NOME");
    let email = v("email", "Email", "EMAIL");
    let phone = v("phone", "phone_number", "telefone", "Telefone", "cel", "celular", "whatsapp");
    let campaignId = v("campaign_id", "campaignId");
    let campaignName = v("campaign_name", "campaignName", "campanha");
    let message = v("message", "mensagem", "observacao");
    let platform = v("platform", "source", "origem") || "meta_ads";
    // Detect Jetimob site leads: message pattern or explicit source
    const isJetimobSite = (() => {
      const p = platform.toLowerCase();
      if (p.includes("jetimob") || p.includes("site_uhome") || p.includes("uhome.com") || p === "site") return true;
      const msg = (message || "").toLowerCase();
      if (msg.includes("site uhome") || msg.includes("uhome.com.br") || msg.includes("site uhome negócios")) return true;
      return false;
    })();

    let formName = v("form_name", "formName", "formulario");
    let adName = v("ad_name", "adName", "adId");
    let adsetName = v("adset_name", "adsetName", "adgroupId");
    let propertyCode = v("property_code", "propertyCode", "codigo_imovel");
    const metaFormId = v("formId");
    let externalLeadId = v("lead_id", "leadId", "meta_lead_id", "leadgen_id", "id");

    // Extract property code from "imovel_referencia" field (e.g. "18273-BT - Venda")
    let imovelReferencia = v("imovel_referencia", "imovel_ref", "property_ref");
    if (!imovelReferencia && body.data && typeof body.data === "object") {
      imovelReferencia = extractStr(body.data.imovel_referencia) || extractStr(body.data.imovel_ref);
    }
    if (imovelReferencia && !propertyCode) {
      propertyCode = imovelReferencia.split(/\s*-\s*(?:Venda|Locação|Aluguel)/i)[0].trim() || imovelReferencia;
    }

    // ── Make.com format: data object with mixed string/array values ──
    if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
      const d = body.data;
      if (!name) name = extractStr(d.full_name) || extractStr(d.name) || extractStr(d.nome);
      if (!phone) phone = extractStr(d.phone_number) || extractStr(d.phone) || extractStr(d.telefone) || extractStr(d.celular) || extractStr(d.whatsapp);
      if (!email) email = extractStr(d.email);
      if (!campaignId) campaignId = extractStr(d.campaign_id);
      if (!message) message = extractStr(d.message) || extractStr(d.mensagem);
      if (!propertyCode) propertyCode = extractStr(d.property_code) || extractStr(d.codigo_imovel);
      if (!externalLeadId) externalLeadId = extractStr(d.lead_id) || extractStr(d.leadgen_id) || extractStr(d.id);
    }

    // ── Make.com mappable_field_data: [{name, value}] ──
    if (body.mappable_field_data && Array.isArray(body.mappable_field_data)) {
      for (const field of body.mappable_field_data) {
        const val = extractStr(field.value) || extractStr(field.values);
        if (!val) continue;
        const fn = (field.name || "").toLowerCase();
        if (!name && (fn === "full_name" || fn === "nome" || fn === "name")) name = val;
        else if (!email && fn.includes("email")) email = val;
        else if (!phone && (fn.includes("phone") || fn.includes("telefone") || fn.includes("celular") || fn.includes("whatsapp"))) phone = val;
        else if (!campaignId && fn === "campaign_id") campaignId = val;
        else if (!message && fn === "message") message = val;
        else if (!propertyCode && (fn === "property_code" || fn === "codigo_imovel")) propertyCode = val;
        else if (!externalLeadId && (fn === "lead_id" || fn === "leadgen_id" || fn === "meta_lead_id")) externalLeadId = val;
      }
    }

    // ── Meta Ads native format: field_data [{name, values: [...]}] ──
    if (body.field_data && Array.isArray(body.field_data)) {
      for (const field of body.field_data) {
        const val = Array.isArray(field.values) ? field.values[0] : field.values;
        if (!val) continue;
        const fn = (field.name || "").toLowerCase();
        if (!name && (fn.includes("full_name") || fn.includes("nome") || fn === "name")) name = val;
        else if (!email && fn.includes("email")) email = val;
        else if (!phone && (fn.includes("phone") || fn.includes("telefone") || fn.includes("cel") || fn.includes("whatsapp"))) phone = val;
      }
      if (!campaignId) campaignId = extractStr(body.campaign_id);
      if (!campaignName) campaignName = extractStr(body.campaign_name);
      if (!formName) formName = extractStr(body.form_name);
      if (!externalLeadId) externalLeadId = extractStr(body.lead_id) || extractStr(body.leadgen_id) || extractStr(body.id);
    }

    // ── Map known Meta form IDs to human-readable names ──
    const META_FORM_ID_MAP: Record<string, string> = {
      "960687922961852": "Seen Três Figueiras (Imagem)",
      "968777322384911": "Seen Três Figueiras (Imagem)",
      "1162388785694311": "Casa Bastian (Imagem)",
      "1193321542872133": "Shift (Video Gabriel)",
      "1407341861064013": "Open Bosque (Video Lucas)",
      "1176432314301412": "Open Bosque (Video Gabrielle)",
      "1593024068412518": "Melnick Day Alto Padrão (Video Gabrielle)",
      "1626788291996359": "Lake Eyre (Imagem)",
      "1435408764647078": "Lake Eyre (Video)",
      "1800577237319392": "Shift (Imagem)",
      "1877406309585794": "Melnick Day Médio Padrão (Video Bruno)",
      "2055662701942686": "Lake Eyre (Video Lucas)",
      "3325414164266311": "Casa Tua",
      "895837159874711": "Melnick Day Compactos (Video Gabriel)",
      "897551219671969": "Las Casas (Imagem)",
      "900345566146636": "High Garden Iguatemi",
      "945021998283301": "High Garden Iguatemi (Imagem)",
      "945250778357878": "Casa Bastian (Video)",
      "921991273926020": "Orygem (Vídeo Gabrielle)",
      "924855113517986": "Las Casas (Video Gabrielle)",
      "966583865699014": "Orygem (Vídeo Lucas)",
      "1253040266458947": "Casa Tua",
      // Mapeamento por NOME de formulário (Meta envia form_name) → empreendimento limpo
      "Uhome - Ápice - Bairro Las Casas": "Ápice Las Casas",
      "Uhome - Lake Baycal": "Lake Baikal",
      "Uhome - Lake Baikal": "Lake Baikal",
      "Uhome - Lake Baical": "Lake Baikal",
      "Uhome - Flow - (Video 1D)": "Flow",
      "Uhome - Flow - (Video 2D)": "Flow",
      "Uhome - Flow - (Studio)": "Flow",
      "Uhome - Flow - (Video Studio)": "Flow",
    };

    // Resolve form name from ID map, then fallback to raw ID
    if (!formName && metaFormId) {
      formName = META_FORM_ID_MAP[metaFormId] || metaFormId;
    }
    if (formName && META_FORM_ID_MAP[formName]) {
      formName = META_FORM_ID_MAP[formName];
    }

    const telefone = normalizePhone(phone);
    const isTestLead = isLikelyTestLead(name, email, message);

    // ── Resolve empreendimento (need to declare before logging) ──
    let empreendimento: string | null = null;
    let segmentoFromMap: string | null = null;

    // Priority 1: property_code → empreendimento_overrides or jetimob lookup
    if (propertyCode) {
      const cleanCode = propertyCode.replace(/-UH$/i, "").trim();
      const codeWithSuffix = cleanCode.includes("-") ? cleanCode : `${cleanCode}-UH`;
      const { data: overrideRow } = await supabase
        .from("empreendimento_overrides")
        .select("nome")
        .or(`codigo.eq.${codeWithSuffix},codigo.eq.${cleanCode}`)
        .limit(1)
        .maybeSingle();
      if (overrideRow) {
        empreendimento = overrideRow.nome;
      }

      if (!empreendimento) {
        const { data: rcByCode } = await supabase
          .from("roleta_campanhas")
          .select("empreendimento, segmento_id")
          .ilike("empreendimento", `%${cleanCode}%`)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (rcByCode) empreendimento = rcByCode.empreendimento;
      }
    }

    // Priority 2: campaign_id → jetimob_campaign_map
    if (!empreendimento && campaignId) {
      const { data: mapRow } = await supabase
        .from("jetimob_campaign_map")
        .select("empreendimento, segmento")
        .eq("campaign_id", String(campaignId))
        .maybeSingle();

      if (mapRow) {
        empreendimento = mapRow.empreendimento;
        if (!segmentoFromMap) segmentoFromMap = mapRow.segmento;
      }
    }

    // Priority 3: Extract from message
    if (!empreendimento && message) {
      const msgMatch = message.match(/Formul[aá]rio\s+de\s+(.+?)(?:\s*\(|$)/i);
      if (msgMatch) {
        const extracted = msgMatch[1].trim();
        const { data: rcMsg } = await supabase
          .from("roleta_campanhas")
          .select("empreendimento")
          .ilike("empreendimento", `%${extracted}%`)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (rcMsg) empreendimento = rcMsg.empreendimento;
        else empreendimento = extracted;
      }
    }

    // Priority 4: campaign_name or form_name
    if (!empreendimento && campaignName) empreendimento = campaignName;
    if (!empreendimento && formName) empreendimento = formName;
    if (!empreendimento) empreendimento = "Avulso - Meta Ads";

    // Normalize: strip suffixes like " (Imagem)", " (Video ...)", " - Uhome", " - Venda"
    if (empreendimento) {
      empreendimento = empreendimento
        .replace(/\s*\((?:Imagem|Video|Vídeo)[^)]*\)/gi, "")
        .replace(/\s*-\s*(Uhome|Venda|Locação|Locacao)$/i, "")
        .trim();
    }

    // Canonicaliza variações de "Lake Baikal" (Baikal/Baical/Baycal, com/sem prefixo "Uhome - ")
    // Garante roteamento correto para o segmento S4 - Alto Padrão via roleta_campanhas.
    if (empreendimento && /\bba[iy][kc]a?l\b/i.test(empreendimento)) {
      empreendimento = "Lake Baikal";
    }

    // Canonicaliza formulários "Uhome - Flow - (Video 1D/2D/Studio)" → "Flow".
    // Após remover o sufixo de mídia sobra "Uhome - flow -", que não casa com a
    // campanha "Flow" (S4 - MCMV) na roleta_campanhas. Força o nome canônico.
    if (empreendimento && /\bflow\b/i.test(empreendimento)) {
      empreendimento = "Flow";
    }


    L.info("Parsed", { name, telefone, campaignId, propertyCode, empreendimento, externalLeadId, isTestLead });

    // ── Atribuição direta por campanha específica (não passa pela roleta) ──
    // Campanha "Uhome – Casa Menino Deus (CP)" é exclusiva do Bruno Schuler.
    // Match tolerante a acentos, hífens e caixa via normalizeTimelineText (colapsa
    // não-alfanuméricos em espaço). Ex.: "Uhome – Casa Menino Deus (CP)" → "uhome casa menino deus cp".
    const BRUNO_SCHULER_AUTH_ID = "fb61ecda-5c4b-49d7-bda7-ccf9b589da07";
    const CAMPANHA_DIRETA_BRUNO_CANON = "uhome casa menino deus cp";
    const canonFormOrCampaign = (s: string | null | undefined) =>
      normalizeTimelineText((s || "").replace(/[^0-9a-zA-ZÀ-ÿ]+/g, " "));
    const atribuicaoDiretaBruno =
      canonFormOrCampaign(formName) === CAMPANHA_DIRETA_BRUNO_CANON ||
      canonFormOrCampaign(campaignName) === CAMPANHA_DIRETA_BRUNO_CANON;
    if (atribuicaoDiretaBruno) {
      L.info("Campanha de atribuição direta detectada (Bruno Schuler)", { formName, campaignName });
    }

    if (isTestLead) {
      L.info("Ignored test payload", { name, email, externalLeadId });
      return new Response(
        JSON.stringify({ success: true, action: "ignored_test_payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!telefone) {
      L.warn("Missing phone", { name, email, campaignId, formName });
      return new Response(
        JSON.stringify({ success: true, action: "ignored_missing_phone", reason: "telefone obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Dedup: check external lead id + phone (ALL leads, including pending distribution) ──
    const dedupRegistryId = externalLeadId ? `meta:${externalLeadId}` : `meta-phone:${telefone}`;

    if (externalLeadId) {
      const { data: existingExternal, error: existingExternalError } = await supabase
        .from("jetimob_processed")
        .select("jetimob_lead_id")
        .eq("jetimob_lead_id", `meta:${externalLeadId}`)
        .maybeSingle();

      if (existingExternalError) {
        L.warn("Dedup check warn (external)", { externalLeadId }, existingExternalError);
      }

      if (existingExternal) {
        L.info("Dedup: external id already processed", { externalLeadId });
        // BLOCO 4b: logar dedup permanente por external_id em ops_events
        logOps("info", "business", "lead_dedup_skipped_permanent", {
          reason: "external_id_em_jetimob_processed",
          external_lead_id: externalLeadId,
        });
        return new Response(
          JSON.stringify({ success: true, action: "skipped_external_id_dedup" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check jetimob_processed too (permanent dedup registry by phone)
    const { data: alreadyProcessed, error: alreadyProcessedError } = await supabase
      .from("jetimob_processed")
      .select("jetimob_lead_id, telefone")
      .eq("telefone", telefone)
      .limit(1)
      .maybeSingle();

    if (alreadyProcessedError) {
      L.warn("Dedup check warn (phone)", { telefone }, alreadyProcessedError);
    }

    const { data: existing } = await supabase
      .from("pipeline_leads")
      .select("id, corretor_id, nome, empreendimento, aceite_status, stage_id, arquivado, meta_lead_id")
      .eq("telefone", telefone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // If lead exists but is still pending distribution (no corretor), just skip silently
      if (!existing.corretor_id) {
        L.info("Dedup: pending distribution", { telefone, leadId: existing.id });
        // BLOCO 4b: dedup por lead já pendente de distribuição
        logOps("info", "business", "lead_dedup_skipped_pending", {
          reason: "lead_existente_aceite_status_pendente_distribuicao",
          lead_id: existing.id,
          telefone_anon: await anonPhone(telefone),
        });
        return new Response(
          JSON.stringify({ success: true, action: "skipped_duplicate_pending", lead_id: existing.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Lead has a corretor — reactivate with notification
      const todayStamp = new Date().toISOString().slice(0, 10);
      const interestLabel = empreendimento || existing.empreendimento || "mesmo imóvel";

      // Determine if lead needs to be moved out of Descarte/archived
      const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";
      const SEM_CONTATO_STAGE_ID = "2fcba9be-1188-4a54-9452-394beefdc330";
      const isDiscarded = existing.stage_id === DESCARTE_STAGE_ID || existing.arquivado === true;

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        observacoes: `[NOVO INTERESSE ${todayStamp}] ${interestLabel} (Meta Ads direto)${message ? ` — "${message}"` : ""}`,
      };
      if (isDiscarded) {
        updatePayload.stage_id = SEM_CONTATO_STAGE_ID;
        updatePayload.stage_changed_at = new Date().toISOString();
        updatePayload.arquivado = false;
        updatePayload.motivo_descarte = null;
      }

      // CAPI: enriquece meta_lead_id retroativamente se ainda não gravado (nunca sobrescreve, 1↔1)
      if (externalLeadId && !existing.meta_lead_id) {
        const { data: outroLead } = await supabase
          .from("pipeline_leads")
          .select("id")
          .eq("meta_lead_id", externalLeadId)
          .neq("id", existing.id)
          .maybeSingle();
        if (!outroLead) {
          updatePayload.meta_lead_id = externalLeadId;
        } else {
          logOps("warn", "system", "meta_lead_id_ja_em_outro_lead", {
            externalLeadId, este_lead: existing.id, outro_lead: outroLead.id, contexto: "reactivate_phone",
          });
        }
      }

      await supabase.from("pipeline_leads").update(updatePayload).eq("id", existing.id);

      await Promise.all([
        supabase.from("notifications").insert({
          user_id: existing.corretor_id,
          tipo: "lead",
          categoria: "lead_retorno",
          titulo: `🔄 Lead reativado! ${existing.nome || name}`,
          mensagem: `${existing.nome || name} demonstrou novo interesse em ${interestLabel} (Meta Ads direto).`,
          dados: { pipeline_lead_id: existing.id, lead_nome: existing.nome || name, novo_empreendimento: interestLabel },
          agrupamento_key: `lead_retorno_${existing.id}_${todayStamp}`,
        }),
        supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: existing.id,
          tipo: "entrada",
          titulo: `🔄 Novo interesse via Meta Ads`,
          descricao: `Lead demonstrou novo interesse em ${interestLabel} (Meta Ads).${message ? `\nMensagem: "${message}"` : ""}`,
          data: todayStamp,
          prioridade: "alta",
          status: "completed",
          created_by: existing.corretor_id,
        }),
      ]);

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: existing.corretor_id,
            title: "🔄 Lead reativado!",
            body: `${existing.nome || name} — ${interestLabel}`,
            url: `/pipeline-leads?lead=${existing.id}`,
          }),
        });
      } catch (e) { L.warn("Push error", { leadId: existing.id }, e); }

      L.info("Reactivated existing lead", { telefone, leadId: existing.id, corretor: existing.corretor_id });

      // Registra a chave de dedup para que o backfill NÃO reprocesse/renotifique este lead
      try {
        await supabase
          .from("jetimob_processed")
          .upsert({ jetimob_lead_id: dedupRegistryId, telefone }, { onConflict: "jetimob_lead_id" });
      } catch (e) { L.warn("Dedup registry upsert warn (reactivation/phone)", { dedupRegistryId }, e); }

      // BLOCO 4b: lead descartado/arquivado reativado por novo touch
      logOps("info", "business", "lead_dedup_reactivated", {
        reason: isDiscarded ? "lead_descartado_reativado_para_sem_contato" : "lead_ativo_recebeu_novo_interesse",
        lead_id: existing.id,
        corretor_id: existing.corretor_id,
        was_discarded: isDiscarded,
        telefone_anon: await anonPhone(telefone),
      });
      return new Response(
        JSON.stringify({ success: true, action: "reactivated", lead_id: existing.id, trace_id: traceId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also skip if phone was ever processed before (permanent dedup)
    if (alreadyProcessed) {
      L.info("Dedup: permanent registry", { telefone });
      // BLOCO 4b: dedup permanente — telefone já em jetimob_processed sem lead ativo
      logOps("info", "business", "lead_dedup_skipped_permanent", {
        reason: "telefone_em_jetimob_processed_sem_lead_ativo",
        telefone_anon: await anonPhone(telefone),
      });
      return new Response(
        JSON.stringify({ success: true, action: "skipped_permanent_dedup" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve segmento ──
    let segmentoId: string | null = null;
    if (segmentoFromMap) {
      const { data: seg } = await supabase
        .from("pipeline_segmentos")
        .select("id")
        .ilike("nome", segmentoFromMap)
        .limit(1)
        .maybeSingle();
      if (seg) segmentoId = seg.id;
    }
    if (!segmentoId && empreendimento) {
      const { data: rc } = await supabase
        .from("roleta_campanhas")
        .select("segmento_id")
        .ilike("empreendimento", `%${empreendimento}%`)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (rc?.segmento_id) {
        const { data: rs } = await supabase
          .from("roleta_segmentos")
          .select("id, nome")
          .eq("id", rc.segmento_id)
          .maybeSingle();
        if (rs) {
          const { data: ps } = await supabase
            .from("pipeline_segmentos")
            .select("id")
            .ilike("nome", rs.nome)
            .limit(1)
            .maybeSingle();
          if (ps) segmentoId = ps.id;
        }
      }
    }

    // ── Get novo_lead stage ──
    const { data: stageData } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("tipo", "novo_lead")
      .eq("ativo", true)
      .limit(1)
      .single();

    if (!stageData) {
      return new Response(
        JSON.stringify({ error: "Estágio novo_lead não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build observacoes with full context
    const obsLines: string[] = [];
    if (message) obsLines.push(message);
    if (propertyCode) obsLines.push(`Cód. Imóvel: ${propertyCode}`);
    const obsText = obsLines.length > 0 ? obsLines.join(" | ") : null;

    // ── Atribuição direta: resolve gerente do Bruno via team_members ──
    let corretorDiretoId: string | null = null;
    let gerenteDiretoId: string | null = null;
    if (atribuicaoDiretaBruno) {
      corretorDiretoId = BRUNO_SCHULER_AUTH_ID;
      const { data: tm } = await supabase
        .from("team_members")
        .select("gerente_id")
        .eq("user_id", BRUNO_SCHULER_AUTH_ID)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();
      // Se o Bruno é o próprio gestor (sem gerente acima), referencia ele mesmo.
      gerenteDiretoId = tm?.gerente_id || BRUNO_SCHULER_AUTH_ID;
    }

    // ── Register in permanent dedup BEFORE insert (prevents race condition) ──
    const { error: registryError } = await supabase
      .from("jetimob_processed")
      .upsert(
        { jetimob_lead_id: dedupRegistryId, telefone },
        { onConflict: "jetimob_lead_id" }
      );

    if (registryError) {
      // If it's a unique violation, another request already processed this lead
      if (registryError.code === "23505") {
        L.info("Dedup: race condition caught by registry", { dedupRegistryId, telefone });
        // BLOCO 4b: race condition entre 2 webhooks simultâneos detectada pelo UNIQUE em jetimob_processed
        logOps("info", "business", "lead_dedup_skipped_permanent", {
          reason: "race_condition_registry_unique_violation",
          dedup_registry_id: dedupRegistryId,
          telefone_anon: await anonPhone(telefone),
        });
        return new Response(
          JSON.stringify({ success: true, action: "skipped_race_dedup" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      L.warn("Registry upsert warn", { dedupRegistryId }, registryError);
    }

    // ── Insert lead ──
    const { data: insertedLead, error: insertError } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: name || (isJetimobSite ? "Lead Site Uhome" : "Lead Meta Ads"),
        telefone,
        email: email || null,
        empreendimento,
        segmento_id: segmentoId,
        stage_id: stageData.id,
        origem: isJetimobSite ? "site_uhome" : (platform || "Meta Ads"),
        origem_detalhe: campaignName || formName || null,
        campanha: campaignName || (message ? message.slice(0, 100) : null),
        campanha_id: campaignId || null,
        conjunto_anuncio: adsetName || null,
        anuncio: adName || null,
        formulario: formName || null,
        plataforma: platform || null,
        observacoes: obsText,
        corretor_id: atribuicaoDiretaBruno ? corretorDiretoId : null,
        gerente_id: atribuicaoDiretaBruno ? gerenteDiretoId : undefined,
        aceite_status: atribuicaoDiretaBruno ? "aceito" : "pendente_distribuicao",
        distribuido_em: atribuicaoDiretaBruno ? new Date().toISOString() : undefined,
        prioridade_lead: message && message.length > 10 ? "alta" : "media",
      })
      .select("id")
      .single();

    if (insertError) {
      // ── Resiliência: violação de UNIQUE (ex: e-mail já ativo / telefone) NÃO é erro real.
      // Tratamos como duplicidade idempotente e retornamos 200 para o Make não desativar o cenário.
      if ((insertError as PostgrestError).code === "23505") {
        L.info("Insert duplicate (unique violation) — treated as dedup", { telefone, email: anonEmail(email) });

        // O lead já existe (colidiu por e-mail ou telefone). Localiza o registro
        // existente — provavelmente casou por E-MAIL (telefone diferente, por isso
        // o check inicial por telefone não pegou). Se tiver corretor, reativa:
        // atualiza o lead, registra no histórico e notifica o corretor.
        let dup: { id: string; corretor_id: string | null; nome: string | null; empreendimento: string | null; stage_id: string | null; arquivado: boolean | null } | null = null;
        if (email) {
          const { data } = await supabase
            .from("pipeline_leads")
            .select("id, corretor_id, nome, empreendimento, stage_id, arquivado")
            .eq("email", email)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          dup = data;
        }
        if (!dup) {
          const { data } = await supabase
            .from("pipeline_leads")
            .select("id, corretor_id, nome, empreendimento, stage_id, arquivado")
            .eq("telefone", telefone)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          dup = data;
        }

        if (dup && dup.corretor_id) {
          const todayStamp = new Date().toISOString().slice(0, 10);
          const interestLabel = empreendimento || dup.empreendimento || "mesmo imóvel";
          const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";
          const SEM_CONTATO_STAGE_ID = "2fcba9be-1188-4a54-9452-394beefdc330";
          const isDiscarded = dup.stage_id === DESCARTE_STAGE_ID || dup.arquivado === true;

          const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
            observacoes: `[NOVO INTERESSE ${todayStamp}] ${interestLabel} (Meta Ads direto)${message ? ` — "${message}"` : ""}`,
          };
          if (isDiscarded) {
            updatePayload.stage_id = SEM_CONTATO_STAGE_ID;
            updatePayload.stage_changed_at = new Date().toISOString();
            updatePayload.arquivado = false;
            updatePayload.motivo_descarte = null;
          }

          await supabase.from("pipeline_leads").update(updatePayload).eq("id", dup.id);

          await Promise.all([
            supabase.from("notifications").insert({
              user_id: dup.corretor_id,
              tipo: "lead",
              categoria: "lead_retorno",
              titulo: `🔄 Lead reativado! ${dup.nome || name}`,
              mensagem: `${dup.nome || name} demonstrou novo interesse em ${interestLabel} (Meta Ads direto).`,
              dados: { pipeline_lead_id: dup.id, lead_nome: dup.nome || name, novo_empreendimento: interestLabel },
              agrupamento_key: `lead_retorno_${dup.id}_${todayStamp}`,
            }),
            supabase.from("pipeline_atividades").insert({
              pipeline_lead_id: dup.id,
              tipo: "entrada",
              titulo: `🔄 Novo interesse via Meta Ads`,
              descricao: `Lead demonstrou novo interesse em ${interestLabel} (Meta Ads).${message ? `\nMensagem: "${message}"` : ""}`,
              data: todayStamp,
              prioridade: "alta",
              status: "completed",
              created_by: dup.corretor_id,
            }),
          ]);

          try {
            await fetch(`${supabaseUrl}/functions/v1/send-push`, {
              method: "POST",
              headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: dup.corretor_id,
                title: "🔄 Lead reativado!",
                body: `${dup.nome || name} — ${interestLabel}`,
                url: `/pipeline-leads?lead=${dup.id}`,
              }),
            });
          } catch (e) { L.warn("Push error", { leadId: dup.id }, e); }

          L.info("Reactivated existing lead (email/phone unique match)", { leadId: dup.id, corretor: dup.corretor_id });

          // Registra a chave de dedup para que o backfill NÃO reprocesse/renotifique este lead
          try {
            await supabase
              .from("jetimob_processed")
              .upsert({ jetimob_lead_id: dedupRegistryId, telefone }, { onConflict: "jetimob_lead_id" });
          } catch (e) { L.warn("Dedup registry upsert warn (reactivation/email)", { dedupRegistryId }, e); }

          logOps("info", "business", "lead_dedup_reactivated", {
            reason: isDiscarded ? "lead_descartado_reativado_para_sem_contato" : "lead_ativo_recebeu_novo_interesse_via_email_match",
            lead_id: dup.id,
            corretor_id: dup.corretor_id,
            was_discarded: isDiscarded,
            telefone_anon: await anonPhone(telefone),
            email_anon: anonEmail(email),
          });
          return new Response(
            JSON.stringify({ success: true, action: "reactivated", lead_id: dup.id, trace_id: traceId }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Sem corretor ou sem lead localizado — apenas registra dedup idempotente.
        logOps("info", "business", "lead_dedup_skipped_unique_violation", {
          reason: "insert_unique_violation_email_ou_telefone",
          telefone_anon: await anonPhone(telefone),
          email_anon: anonEmail(email),
          empreendimento,
          lead_id: dup?.id || null,
        });
        return new Response(
          JSON.stringify({ success: true, action: "skipped_unique_violation", lead_id: dup?.id || null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // BLOCO 4a: captura error_detail estruturado (message/code/details/hint) + payload anonimizado.
      // Tipagem nativa via PostgrestError, sem cast `as unknown`.
      const errAny = insertError as PostgrestError;
      const errorDetailObj = {
        message: errAny.message ?? null,
        code: errAny.code ?? null,
        details: errAny.details ?? null,
        hint: errAny.hint ?? null,
        payload_anon: {
          name: name ? `${name.slice(0, 2)}***` : null,
          telefone_anon: await anonPhone(telefone),
          email_anon: anonEmail(email),
          empreendimento,
          campaign_id: campaignId || null,
        },
      };
      L.error("Lead insert failed", { name, telefone, empreendimento }, insertError);
      logOps("error", "system", "Lead insert failed", { name, telefone, empreendimento }, JSON.stringify(errorDetailObj));
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    L.info("Lead created", { leadId: insertedLead.id, name, empreendimento, campaignId, propertyCode });
    logOps("info", "business", "Lead created via Meta Ads", { lead_id: insertedLead.id, name, empreendimento, campaign_id: campaignId });

    // ── Register entry activity with concise, broker-friendly text ──
    const plataformaLabel = isJetimobSite ? "Site Uhome" : friendlyMetaSource(platform);
    const entryPrimary = empreendimento || (!/^\d{10,}$/.test(formName || "") ? formName : "") || campaignName || "";
    const entradaParts: string[] = [];
    addTimelineDetail(entradaParts, "Campanha", campaignName, [entryPrimary, formName]);
    addTimelineDetail(entradaParts, "Cód. imóvel", propertyCode, [entryPrimary]);
    // Prioriza a mensagem do formulário (identifica o criativo) sobre o ad_name técnico
    const GENERIC_FORM_MESSAGES = [
      "lead gerado do formulário", "lead gerado do formulario",
      "lead gerado do anúncio", "lead gerado do anuncio", "lead gerado",
    ];
    const isGenericMessage = (m: string) => GENERIC_FORM_MESSAGES.includes(normalizeTimelineText(m));
    const anuncioValue = (message && !isGenericMessage(message)) ? message : adName;
    addTimelineDetail(entradaParts, "Anúncio", anuncioValue, [entryPrimary, campaignName, formName]);

    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: insertedLead.id,
      tipo: "entrada",
      titulo: `Lead gerado via ${plataformaLabel}${entryPrimary ? ` — ${entryPrimary}` : ""}`,
      descricao: entradaParts.length ? entradaParts.join(" • ") : null,
      status: "concluida",
      created_by: "00000000-0000-0000-0000-000000000000",
    }).then(r => { if (r.error) L.warn("Entry activity insert failed", {}, r.error); });

    // ── Atribuição direta (campanha exclusiva do Bruno) — NÃO passa pela roleta ──
    let distribution: { success: boolean; reason?: string; error?: string } = { success: true, reason: "atribuicao_direta" };
    if (atribuicaoDiretaBruno) {
      const interestLabel = empreendimento || "Casa Menino Deus";
      const todayStamp = new Date().toISOString().slice(0, 10);
      await Promise.all([
        supabase.from("notifications").insert({
          user_id: corretorDiretoId,
          tipo: "lead",
          categoria: "lead_novo",
          titulo: `🎯 Novo lead exclusivo! ${name}`,
          mensagem: `${name} chegou pela campanha ${interestLabel} e foi atribuído direto a você.`,
          dados: { pipeline_lead_id: insertedLead.id, lead_nome: name, empreendimento: interestLabel },
          agrupamento_key: `lead_novo_${insertedLead.id}_${todayStamp}`,
        }),
        supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: insertedLead.id,
          tipo: "entrada",
          titulo: `🎯 Atribuição direta (campanha exclusiva)`,
          descricao: `Lead atribuído diretamente sem passar pela roleta — campanha ${interestLabel}.`,
          status: "concluida",
          created_by: "00000000-0000-0000-0000-000000000000",
        }),
      ]);
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: corretorDiretoId,
            title: "🎯 Novo lead exclusivo!",
            body: `${name} — ${interestLabel}`,
            url: `/pipeline-leads?lead=${insertedLead.id}`,
          }),
        });
      } catch (e) { L.warn("Push error (atribuição direta)", { leadId: insertedLead.id }, e); }
      logOps("info", "business", "lead_atribuido_direto_campanha", {
        lead_id: insertedLead.id,
        corretor_id: corretorDiretoId,
        campanha: formName || campaignName,
        empreendimento,
      });
      L.info("Lead atribuído direto ao Bruno (sem roleta)", { leadId: insertedLead.id, corretor: corretorDiretoId });
    } else {
      // ── Auto-distribute via roleta (with retry) ──
      distribution = await distributeLeadDirect(supabaseUrl, serviceKey, insertedLead.id, traceId, L);
      if (!distribution.success) {
        // BLOCO 3: feature flag META_FALLBACK_FILA_CEO (default true / ausente = true / "false" desativa).
        // Quando o fallback Fila CEO está ativo, lead órfão NÃO é erro — é estado canônico
        // (pipeline_leads.aceite_status='pendente_distribuicao' AND corretor_id IS NULL) coberto
        // pelo cron lead-escalation. Reclassificamos para info/business para parar falso-positivo
        // no painel de erros. Se o flag for explicitamente "false", volta a logar como error/integration.
        const fallbackFilaCeo = (Deno.env.get("META_FALLBACK_FILA_CEO") ?? "true").toLowerCase() !== "false";
        if (fallbackFilaCeo) {
          logOps("info", "business", "queued_fila_ceo", {
            lead_id: insertedLead.id,
            name,
            empreendimento,
            reason: distribution.reason || null,
            detail: distribution.error || null,
          });
        } else {
          logOps("error", "integration", "Distribution failed after retries — lead orphaned", {
            lead_id: insertedLead.id,
            name,
            empreendimento,
            reason: distribution.reason || null,
            detail: distribution.error || null,
          });
        }
      }
    }

    // ── Audit ──
    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      modulo: "pipeline",
      acao: "meta_ads_webhook",
      descricao: `Lead direto Meta Ads: ${name} — ${empreendimento} (campaign_id: ${campaignId}, property_code: ${propertyCode})`,
      origem: "webhook",
      request_id: traceId,
    }).then(r => { if (r.error) L.warn("Audit insert failed", {}, r.error); });

    return new Response(
      JSON.stringify({ success: true, lead_id: insertedLead.id, empreendimento, propertyCode, distributed: distribution.success, distribution, trace_id: traceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    L.error("Unhandled exception", {}, err);
    logOps("error", "system", "Unhandled exception", {}, err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
