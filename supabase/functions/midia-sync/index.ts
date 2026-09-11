// ============================================================
// UHOME MÍDIA · midia-sync
// Puxa da Marketing API do Meta a foto diária por anúncio (gasto,
// alcance, vídeo, conversões) e os criativos, e grava nas tabelas
// midia_snapshot_diario / midia_criativos.
//
// Chamada:
//   POST { mode: 'insights' | 'creatives' | 'all', since?, until?, days? }
//   - since/until (YYYY-MM-DD) ou days (N últimos dias, default 3)
//   - janelas maiores que 31 dias são quebradas em pedaços de 31
// Auth: header x-cron-secret == CAPI_CRON_SECRET  OU  Bearer JWT de admin.
// Token do Meta: RPC get_meta_ads_token_internal (Vault), mesma do meta-ads-sync.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const META_BASE = "https://graph.facebook.com/v21.0";
const CANAL = "meta";
const CHUNK_DAYS = 31;

// IDs das conversões personalizadas do CRM (dataset 1426170849536314)
const CONV_LEAD_QUALIFICADO = "1070344472057388";
const CONV_VISITA_MARCADA = "2314536792623491";

type Action = { action_type: string; value: string };
type Row = Record<string, unknown> & {
  date_start: string;
  ad_id: string;
  actions?: Action[];
  cost_per_action_type?: Action[];
  video_play_actions?: Action[];
  video_thruplay_watched_actions?: Action[];
  video_p25_watched_actions?: Action[];
  video_p50_watched_actions?: Action[];
  video_p75_watched_actions?: Action[];
  video_p100_watched_actions?: Action[];
  video_avg_time_watched_actions?: Action[];
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}
function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}
function actionValue(list: Action[] | undefined, ...types: string[]): number {
  if (!list) return 0;
  for (const t of types) {
    const a = list.find((x) => x.action_type === t);
    if (a) return num(a.value);
  }
  return 0;
}
function firstValue(list: Action[] | undefined): number {
  return list && list.length ? num(list[0].value) : 0;
}

// Pagina a Graph API. Se o Meta responder "reduce the amount of data"
// (code 1) ou "too much data" (code 17/613 são rate limit), reduz o
// `limit` pela metade e tenta de novo a partir da mesma página.
async function graphGetAll(baseUrl: string, maxPages = 80): Promise<unknown[]> {
  const out: unknown[] = [];
  const u = new URL(baseUrl);
  let limit = Number(u.searchParams.get("limit") || "100");
  let next: string | null = baseUrl;
  let pages = 0;
  while (next && pages < maxPages) {
    pages++;
    const res = await fetch(next);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.error?.code;
      const msg = String(data?.error?.message || "");
      const reduzir = code === 1 || /reduce the amount of data/i.test(msg);
      if (reduzir && limit > 10) {
        limit = Math.max(10, Math.floor(limit / 2));
        const nu = new URL(next);
        nu.searchParams.set("limit", String(limit));
        next = nu.toString();
        pages--; // não conta tentativa
        continue;
      }
      throw new Error(`Graph ${res.status}: ${JSON.stringify(data.error || data)}`);
    }
    for (const row of data.data || []) out.push(row);
    next = data.paging?.next ?? null;
  }
  return out;
}

const INSIGHT_FIELDS = [
  "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
  "objective", "optimization_goal",
  "spend", "impressions", "reach", "frequency", "clicks", "inline_link_clicks",
  "ctr", "cpc", "cpm",
  "actions", "cost_per_action_type",
  "video_play_actions", "video_thruplay_watched_actions",
  "video_p25_watched_actions", "video_p50_watched_actions",
  "video_p75_watched_actions", "video_p100_watched_actions",
  "video_avg_time_watched_actions",
].join(",");

async function syncInsights(
  admin: ReturnType<typeof createClient>,
  token: string,
  account: string,
  since: string,
  until: string,
): Promise<{ rows: number; chunks: number }> {
  let total = 0;
  let chunks = 0;
  let cursor = since;
  while (cursor <= until) {
    const end = addDays(cursor, CHUNK_DAYS - 1) < until ? addDays(cursor, CHUNK_DAYS - 1) : until;
    chunks++;
    const params = new URLSearchParams({
      fields: INSIGHT_FIELDS,
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since: cursor, until: end }),
      limit: "200",
      access_token: token,
    });
    const rows = (await graphGetAll(`${META_BASE}/${account}/insights?${params}`)) as Row[];
    const payload = rows.map((r) => ({
      canal: CANAL,
      dia: r.date_start,
      ad_id: r.ad_id,
      adset_id: r.adset_id ?? null,
      campaign_id: r.campaign_id ?? null,
      ad_name: r.ad_name ?? null,
      adset_name: r.adset_name ?? null,
      campaign_name: r.campaign_name ?? null,
      objective: r.objective ?? null,
      optimization_goal: r.optimization_goal ?? null,
      spend: num(r.spend),
      impressions: num(r.impressions),
      reach: num(r.reach),
      frequency: num(r.frequency) || null,
      clicks: num(r.clicks),
      link_clicks: num(r.inline_link_clicks),
      ctr: num(r.ctr) || null,
      cpc: num(r.cpc) || null,
      cpm: num(r.cpm) || null,
      leads_meta: actionValue(r.actions, "lead", "onsite_conversion.lead_grouped"),
      lead_qualificado_meta: actionValue(r.actions, `offsite_conversion.custom.${CONV_LEAD_QUALIFICADO}`),
      visita_marcada_meta: actionValue(r.actions, `offsite_conversion.custom.${CONV_VISITA_MARCADA}`),
      video_plays: firstValue(r.video_play_actions),
      video_3s: actionValue(r.actions, "video_view"),
      thruplays: firstValue(r.video_thruplay_watched_actions),
      video_p25: firstValue(r.video_p25_watched_actions),
      video_p50: firstValue(r.video_p50_watched_actions),
      video_p75: firstValue(r.video_p75_watched_actions),
      video_p100: firstValue(r.video_p100_watched_actions),
      video_avg_time: firstValue(r.video_avg_time_watched_actions) || null,
      actions: r.actions ?? null,
      cost_per_action: r.cost_per_action_type ?? null,
      sincronizado_em: new Date().toISOString(),
    }));
    for (let i = 0; i < payload.length; i += 500) {
      const batch = payload.slice(i, i + 500);
      const { error } = await admin
        .from("midia_snapshot_diario")
        .upsert(batch, { onConflict: "canal,dia,ad_id" });
      if (error) throw new Error(`upsert snapshot: ${error.message}`);
      total += batch.length;
    }
    cursor = addDays(end, 1);
  }
  return { rows: total, chunks };
}

// asset_feed_spec fica de fora de propósito: é pesado e derruba a chamada
// ("Please reduce the amount of data"). object_story_spec já traz o essencial.
const AD_FIELDS =
  "id,name,status,effective_status,adset_id,campaign_id,created_time,updated_time," +
  "adset{name},campaign{name}," +
  "creative{id,object_type,thumbnail_url,image_url,image_hash,video_id,title,body," +
  "call_to_action_type,object_story_spec,effective_object_story_id}";

function tipoCriativo(c: Record<string, any> | undefined): string {
  if (!c) return "outro";
  const ot = String(c.object_type || "").toUpperCase();
  const spec = c.object_story_spec || {};
  const afs = c.asset_feed_spec || {};
  if (c.video_id || spec.video_data || (afs.videos && afs.videos.length)) return "video";
  if (spec.link_data?.child_attachments?.length || ot === "CAROUSEL") return "carrossel";
  if (c.image_hash || c.image_url || spec.photo_data || spec.link_data?.picture || (afs.images && afs.images.length)) return "imagem";
  if (ot === "VIDEO") return "video";
  if (ot === "PHOTO" || ot === "SHARE") return "imagem";
  return "outro";
}

function extractForm(c: Record<string, any> | undefined): string | null {
  const spec = c?.object_story_spec || {};
  const cta = spec.link_data?.call_to_action || spec.video_data?.call_to_action || null;
  const lead = cta?.value?.lead_gen_form_id;
  return lead ? String(lead) : null;
}

async function syncCreatives(
  admin: ReturnType<typeof createClient>,
  token: string,
  account: string,
): Promise<{ rows: number }> {
  const params = new URLSearchParams({ fields: AD_FIELDS, limit: "50", access_token: token });
  const ads = (await graphGetAll(`${META_BASE}/${account}/ads?${params}`, 200)) as Record<string, any>[];
  const payload = ads.map((a) => {
    const c = a.creative || {};
    const spec = c.object_story_spec || {};
    const link = spec.link_data?.link || spec.video_data?.call_to_action?.value?.link || null;
    return {
      canal: CANAL,
      ad_id: String(a.id),
      creative_id: c.id ? String(c.id) : null,
      campaign_id: a.campaign_id ?? null,
      adset_id: a.adset_id ?? null,
      ad_name: a.name ?? null,
      campaign_name: a.campaign?.name ?? null,
      adset_name: a.adset?.name ?? null,
      ad_status: a.status ?? null,
      effective_status: a.effective_status ?? null,
      tipo: tipoCriativo(c),
      thumbnail_url: c.thumbnail_url ?? null,
      image_url: c.image_url ?? spec.link_data?.picture ?? null,
      image_hash: c.image_hash ?? spec.link_data?.image_hash ?? null,
      video_id: c.video_id ?? spec.video_data?.video_id ?? null,
      titulo: c.title ?? spec.link_data?.name ?? spec.video_data?.title ?? null,
      corpo: c.body ?? spec.link_data?.message ?? spec.video_data?.message ?? null,
      cta: c.call_to_action_type ?? null,
      link_url: link,
      form_id: extractForm(c),
      criado_em: a.created_time ?? null,
      atualizado_em: a.updated_time ?? null,
      raw: { creative: c },
      sincronizado_em: new Date().toISOString(),
      // familia / gancho / formato / tags / classificado_* ficam intocados no upsert
    };
  });
  let total = 0;
  for (let i = 0; i < payload.length; i += 200) {
    const batch = payload.slice(i, i + 200);
    const { error } = await admin
      .from("midia_criativos")
      .upsert(batch, { onConflict: "canal,ad_id" });
    if (error) throw new Error(`upsert criativos: ${error.message}`);
    total += batch.length;
  }
  return { rows: total };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---- auth: cron secret OU admin logado
  const cronSecret = Deno.env.get("CAPI_CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  let authorized = !!(cronSecret && provided && provided === cronSecret);
  if (!authorized) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      const uid = claims?.claims?.sub as string | undefined;
      if (uid) {
        const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
        authorized = !!isAdmin;
      }
    }
  }
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const mode: string = body.mode || "all";
  const days: number = Math.max(1, Math.min(400, Number(body.days) || 3));
  const today = fmt(new Date());
  const until: string = body.until || today;
  const since: string = body.since || addDays(until, -(days - 1));

  const { data: run } = await admin
    .from("midia_sync_runs")
    .insert({ funcao: "midia-sync", modo: mode, since, until })
    .select("id")
    .single();
  const runId = run?.id;

  try {
    const { data: token } = await admin.rpc("get_meta_ads_token_internal");
    const { data: acc } = await admin
      .from("integration_settings")
      .select("value")
      .eq("key", "meta_ads_account_id")
      .maybeSingle();
    const account = acc?.value as string | undefined;
    if (!token || !account) throw new Error("Meta Ads não configurado (token ou conta ausente).");

    const detalhe: Record<string, unknown> = { since, until };
    let linhas = 0;
    if (mode === "insights" || mode === "all") {
      const r = await syncInsights(admin, token as string, account, since, until);
      detalhe.insights = r;
      linhas += r.rows;
    }
    if (mode === "creatives" || mode === "all") {
      const r = await syncCreatives(admin, token as string, account);
      detalhe.creatives = r;
      linhas += r.rows;
    }
    if (runId) {
      await admin.from("midia_sync_runs").update({
        terminado_em: new Date().toISOString(), ok: true, linhas, detalhe,
      }).eq("id", runId);
    }
    return json({ success: true, mode, since, until, linhas, detalhe });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("midia-sync error:", msg);
    if (runId) {
      await admin.from("midia_sync_runs").update({
        terminado_em: new Date().toISOString(), ok: false, erro: msg,
      }).eq("id", runId);
    }
    return json({ success: false, error: msg }, 500);
  }
});
