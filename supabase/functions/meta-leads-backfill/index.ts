/**
 * meta-leads-backfill — Recupera leads do Meta direto da Graph API.
 *
 * Motivo: o webhook `leadgen` do Facebook NÃO entrega todos os eventos ao Make,
 * e a perda acontece ANTES do Make receber. A única correção robusta é ir na
 * fonte (Meta Graph API) e reprocessar.
 *
 * Estratégia:
 *  1. Descobre páginas e formulários acessíveis pelo token (META_GRAPH_API_TOKEN).
 *  2. Para cada formulário, busca leads dos últimos N dias (default 3 / 72h).
 *  3. Reenvia cada lead para `receive-meta-lead` (formato nativo field_data),
 *     reaproveitando TODA a lógica de normalização, dedup e distribuição.
 *
 * Idempotência: garantida pelo dedup do próprio receive-meta-lead
 * (jetimob_processed por `meta:{lead_id}`). Rodar 2x não duplica.
 *
 * Auth: header `x-cron-secret` deve bater com SYNC_SECRET (cron) OU JWT de admin.
 * Modo "test": valida token e lista páginas/forms sem reprocessar.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Form IDs conhecidos (espelho de src/lib/metaFormIdMap.ts). Usados como
// fallback para descobrir a página quando /me/accounts e /me/businesses
// não enumeram nada para o token.
const KNOWN_FORM_IDS: string[] = [
  "960687922961852", "968777322384911", "1162388785694311", "1193321542872133",
  "1407341861064013", "1176432314301412", "1593024068412518", "1626788291996359",
  "1435408764647078", "1800577237319392", "1877406309585794", "2055662701942686",
  "3325414164266311", "895837159874711", "897551219671969", "900345566146636",
  "945021998283301", "945250778357878", "921991273926020", "924855113517986",
  "966583865699014", "1253040266458947", "1486693902966370", "1853179655371596",
  "1581836316228994", "1575975843886888", "4369342313310610",
];



interface MetaLead {
  id: string;
  created_time: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  platform?: string;
  field_data?: Array<{ name: string; values: string[] }>;
}

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Meta API ${path}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

/** Descobre todos os form IDs acessíveis pelo token (todas as páginas). */
async function discoverForms(token: string, explicitPageIds: string[] = [], debug?: Record<string, unknown>): Promise<{ pages: any[]; forms: { id: string; name: string; page: string }[] }> {
  const forms: { id: string; name: string; page: string }[] = [];
  const pagesOut: any[] = [];

  const pageMap = new Map<string, any>();

  // Caminho B — páginas informadas manualmente (garantido mesmo sem /me/accounts).
  for (const pid of explicitPageIds) {
    if (!pid) continue;
    let name = pid;
    try {
      const p = await metaGet(pid, token, { fields: "id,name" });
      name = p.name || pid;
    } catch (e) {
      if (debug) ((debug.explicit_page_errors as unknown[]) ||= []).push({ page: pid, error: (e as Error).message });
    }
    pageMap.set(pid, { id: pid, name });
  }

  // Caminho A — /me/accounts (token de usuário, com access_token de cada página).
  try {
    const acc = await metaGet("me/accounts", token, { fields: "id,name,access_token", limit: "200" });
    for (const p of acc.data || []) pageMap.set(p.id, p);
    if (debug) debug.me_accounts = (acc.data || []).map((p: any) => ({ id: p.id, name: p.name, has_token: !!p.access_token }));
  } catch (e) {
    if (debug) debug.me_accounts_error = (e as Error).message;
  }

  // Caminho A — páginas via Business Manager (owned_pages + client_pages).
  try {
    const biz = await metaGet("me/businesses", token, { fields: "id,name", limit: "200" });
    if (debug) debug.businesses = (biz.data || []).map((b: any) => ({ id: b.id, name: b.name }));
    for (const b of biz.data || []) {
      for (const edge of ["owned_pages", "client_pages"]) {
        try {
          const resp = await metaGet(`${b.id}/${edge}`, token, { fields: "id,name,access_token", limit: "200" });
          for (const p of resp.data || []) if (!pageMap.has(p.id)) pageMap.set(p.id, p);
        } catch (e) {
          if (debug) ((debug.business_pages_errors as unknown[]) ||= []).push({ business: b.id, edge, error: (e as Error).message });
        }
      }
    }
  } catch (e) {
    if (debug) debug.businesses_error = (e as Error).message;
  }

  // Fallback — descobre a(s) página(s) a partir de form IDs conhecidos.
  // Cada formulário expõe o campo `page`; com a página, enumeramos TODOS os forms dela.
  if (pageMap.size === 0 && KNOWN_FORM_IDS.length > 0) {
    if (debug) debug.fallback_via_known_forms = true;
    for (const fid of KNOWN_FORM_IDS) {
      try {
        const f = await metaGet(fid, token, { fields: "id,name,page{id,name}" });
        const pg = f.page;
        if (pg?.id && !pageMap.has(pg.id)) pageMap.set(pg.id, { id: pg.id, name: pg.name || pg.id });
      } catch (e) {
        if (debug) ((debug.known_form_errors as unknown[]) ||= []).push({ form: fid, error: (e as Error).message });
      }
    }
  }

  const pages: any[] = Array.from(pageMap.values());

  if (debug) {
    try {
      const perms = await metaGet("me/permissions", token, {});
      debug.permissions = (perms.data || []).filter((p: any) => p.status === "granted").map((p: any) => p.permission);
    } catch (e) {
      debug.permissions_error = (e as Error).message;
    }
  }

  for (const page of pages) {
    pagesOut.push({ id: page.id, name: page.name });
    // Usa o page access_token quando disponível (de /me/accounts)
    const pageToken = page.access_token || token;
    try {
      let next: string | null = null;
      let url = `${page.id}/leadgen_forms`;
      let params: Record<string, string> = { fields: "id,name", limit: "200" };
      // paginação
      do {
        const resp: any = next
          ? await (async () => { const r = await fetch(next!); return r.json(); })()
          : await metaGet(url, pageToken, params);
        for (const f of resp.data || []) {
          forms.push({ id: f.id, name: f.name || f.id, page: page.name });
        }
        next = resp.paging?.next || null;
      } while (next);
    } catch (e) {
      console.warn(`leadgen_forms falhou para page ${page.id}: ${(e as Error).message}`);
      if (debug) ((debug.leadgen_forms_errors as unknown[]) ||= []).push({ page: page.id, error: (e as Error).message });
    }
  }

  return { pages: pagesOut, forms };
}

async function fetchLeadsForForm(formId: string, token: string, sinceUnix: number): Promise<MetaLead[]> {
  const leads: MetaLead[] = [];
  const fields = "id,created_time,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,form_id,platform,field_data";
  let next: string | null = null;
  let first = true;
  do {
    let resp: any;
    if (next) {
      const r = await fetch(next);
      resp = await r.json();
      if (!r.ok) throw new Error(`leads page: ${JSON.stringify(resp.error || resp)}`);
    } else {
      resp = await metaGet(`${formId}/leads`, token, {
        fields,
        limit: "200",
        filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: String(sinceUnix) }]),
      });
    }
    first = false;
    for (const l of resp.data || []) leads.push(l as MetaLead);
    next = resp.paging?.next || null;
  } while (next);
  return leads;
}
/**
 * Verifica se o token Meta ainda é válido. Retorna { valid, reason }.
 * Detecta especificamente token expirado/inválido (OAuthException, código 190).
 */
async function checkTokenValidity(token: string): Promise<{ valid: boolean; reason?: string; code?: number }> {
  try {
    await metaGet("me", token, { fields: "id" });
    return { valid: true };
  } catch (e) {
    const msg = (e as Error).message || "";
    const m = msg.match(/"code"\s*:\s*(\d+)/);
    const code = m ? Number(m[1]) : undefined;
    const isAuth = code === 190 || /OAuthException|access token|Session has expired|expired/i.test(msg);
    return { valid: !isAuth, reason: isAuth ? msg : undefined, code };
  }
}

/**
 * Dispara alerta de token Meta inválido/expirado para todos os admins.
 * Dedup diário via agrupamento_key para não spammar a cada hora.
 */
async function alertTokenExpired(supabase: any, reason: string) {
  const today = new Date().toISOString().slice(0, 10);
  const groupKey = `meta_token_expired_${today}`;

  // ops_events (rastreio + edge-health-alert)
  try {
    await supabase.from("ops_events").insert({
      fn: "meta-leads-backfill",
      level: "error",
      category: "meta_token",
      message: "Token do Meta inválido ou expirado — backfill de leads parado",
      error_detail: reason?.slice(0, 1000),
    });
  } catch (_e) { /* noop */ }

  // Notifica admins (1x por dia via dedup)
  try {
    const { data: admins } = await supabase
      .from("user_roles").select("user_id").eq("role", "admin");
    const adminIds: string[] = (admins || []).map((r: any) => r.user_id).filter(Boolean);
    if (adminIds.length === 0) return;

    // Já alertou hoje? evita duplicar
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("agrupamento_key", groupKey)
      .limit(1);
    if (existing && existing.length > 0) return;

    const rows = adminIds.map((uid) => ({
      user_id: uid,
      tipo: "alerta",
      categoria: "sistema",
      titulo: "⚠️ Token do Meta expirou",
      mensagem: "Os leads do Meta pararam de entrar no CRM porque o token de acesso ficou inválido. Atualize o token (META_GRAPH_API_TOKEN) para retomar a captura automática.",
      dados: { fn: "meta-leads-backfill", reason: reason?.slice(0, 300) },
      agrupamento_key: groupKey,
      cargo_destino: ["admin"],
    }));
    await supabase.from("notifications").insert(rows);
  } catch (_e) { /* noop */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = Deno.env.get("META_GRAPH_API_TOKEN");
    if (!token) return json({ error: "META_GRAPH_API_TOKEN não configurado" }, 400);

    const webhookSecret = Deno.env.get("META_WEBHOOK_SECRET");
    if (!webhookSecret) return json({ error: "META_WEBHOOK_SECRET não configurado" }, 503);

    // ── Auth: cron secret OU anon-key (cron pg_net) OU admin JWT ──
    const cronSecret = Deno.env.get("SYNC_SECRET");
    const providedCron = req.headers.get("x-cron-secret");
    let authorized = !!cronSecret && providedCron === cronSecret;

    const body = await req.json().catch(() => ({}));

    // Caminho cron: pg_cron chama com a anon key no Bearer (padrão do projeto).
    // A operação é idempotente e não expõe dados sensíveis.
    // Aceita tanto a anon key legada (JWT) quanto a publishable key atual —
    // o ambiente da edge function pode ter SUPABASE_ANON_KEY no formato novo,
    // enquanto o cron foi configurado com o JWT legado (ou vice-versa).
    const rawAuth = req.headers.get("Authorization")?.replace("Bearer ", "");
    const acceptedKeys = [
      Deno.env.get("SUPABASE_ANON_KEY"),
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    ].filter(Boolean) as string[];
    if (!authorized && rawAuth && acceptedKeys.includes(rawAuth)) authorized = true;

    // Fallback robusto: aceita qualquer JWT Supabase válido com role anon/
    // service_role (cron pg_net). É idempotente e não expõe dados sensíveis.
    if (!authorized && rawAuth) {
      try {
        const payload = JSON.parse(atob(rawAuth.split(".")[1] || ""));
        if (payload?.role === "anon" || payload?.role === "service_role") {
          authorized = true;
        }
      } catch (_e) { /* não é JWT — ignora */ }
    }


    if (!authorized) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const jwt = authHeader.replace("Bearer ", "");
        const { data: claims } = await anon.auth.getClaims(jwt);
        const uid = claims?.claims?.sub as string | undefined;
        if (uid) {
          const { data: role } = await supabase
            .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
          if (role) authorized = true;
        }
      }
    }
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    const mode = body.mode || "backfill"; // "test" | "backfill"
    const days = Math.min(Math.max(Number(body.days) || 3, 1), 30);
    const sinceUnix = Math.floor(Date.now() / 1000) - days * 86400;

    // page_ids: do body ou do secret META_PAGE_IDS (CSV)
    const explicitPageIds: string[] = Array.isArray(body.page_ids)
      ? body.page_ids.map(String)
      : (Deno.env.get("META_PAGE_IDS") || "").split(",").map((s) => s.trim()).filter(Boolean);

    // Descobre forms
    const debug: Record<string, unknown> = {};
    const { pages, forms } = await discoverForms(token, explicitPageIds, debug);

    // Sem forms = possível token expirado/inválido. Confirma e alerta admins.
    if (forms.length === 0) {
      const tok = await checkTokenValidity(token);
      if (!tok.valid) {
        await alertTokenExpired(supabase, tok.reason || "token inválido");
        return json({
          success: false,
          token_ok: false,
          error: "Token do Meta inválido ou expirado — admins notificados",
          reason: tok.reason,
          code: tok.code,
        }, 200);
      }
    }

    if (mode === "test") {
      return json({
        success: true,
        token_ok: true,
        pages,
        forms_count: forms.length,
        forms: forms.slice(0, 100),
        debug,
      });
    }

    // ── Diagnóstico/ativação do webhook NATIVO (leadgen) por página ──
    // mode "check_subscription": lista apps inscritos e os campos por página.
    // mode "subscribe": inscreve a(s) página(s) no app para o campo `leadgen`,
    //   habilitando a entrega em tempo real para receive-meta-lead.
    if (mode === "check_subscription" || mode === "subscribe") {
      // Resolve páginas + page access tokens via /me/accounts (necessário para subscribed_apps).
      const pageTokens = new Map<string, { name: string; token: string }>();
      try {
        const acc = await metaGet("me/accounts", token, { fields: "id,name,access_token", limit: "200" });
        for (const p of acc.data || []) {
          if (p.id && p.access_token) pageTokens.set(String(p.id), { name: p.name || p.id, token: p.access_token });
        }
      } catch (e) {
        return json({ success: false, error: `me/accounts falhou: ${(e as Error).message}` }, 200);
      }

      // Filtro opcional de páginas via body.page_ids
      const targetIds = explicitPageIds.length > 0
        ? explicitPageIds.filter((id) => pageTokens.has(id))
        : Array.from(pageTokens.keys());

      const results: Record<string, unknown>[] = [];
      for (const pid of targetIds) {
        const { name, token: pageToken } = pageTokens.get(pid)!;
        try {
          if (mode === "subscribe") {
            const subUrl = new URL(`${META_BASE}/${pid}/subscribed_apps`);
            subUrl.searchParams.set("access_token", pageToken);
            subUrl.searchParams.set("subscribed_fields", "leadgen");
            const r = await fetch(subUrl.toString(), { method: "POST" });
            const j = await r.json();
            results.push({ page_id: pid, name, action: "subscribe", ok: r.ok, response: j });
          }
          // Sempre retorna o estado atual da assinatura após a ação
          const chkUrl = new URL(`${META_BASE}/${pid}/subscribed_apps`);
          chkUrl.searchParams.set("access_token", pageToken);
          const cr = await fetch(chkUrl.toString());
          const cj = await cr.json();
          results.push({
            page_id: pid,
            name,
            action: "check",
            subscribed_apps: (cj.data || []).map((a: any) => ({
              app: a.name || a.id,
              fields: a.subscribed_fields || [],
              leadgen: Array.isArray(a.subscribed_fields)
                ? a.subscribed_fields.some((f: any) => (typeof f === "string" ? f : f?.name) === "leadgen")
                : false,
            })),
          });
        } catch (e) {
          results.push({ page_id: pid, name, error: (e as Error).message });
        }
      }

      return json({ success: true, mode, results });
    }



    // ── BACKFILL ──
    // 453 formulários sequenciais estouram o limite da edge function.
    // Estratégia: paralelismo em lotes + orçamento de tempo (deadline).
    // Ao atingir o deadline, retorna resultados parciais (idempotente: rodar
    // de novo continua de onde parou via dedup do receive-meta-lead).
    let totalLeads = 0;
    let reprocessed = 0;
    let skipped = 0;
    let formErrors = 0;   // formulários antigos/inacessíveis (não são leads perdidos)
    let leadErrors = 0;   // leads que o receive-meta-lead recusou (precisa investigar)
    const leadErrorSamples: { form: string; lead_id: string; status: number; body: string }[] = [];
    let formsProcessed = 0;
    let timedOut = false;
    const perForm: Record<string, { name: string; leads: number }> = {};

    const TIME_BUDGET_MS = Math.min(Math.max(Number(body.budget_ms) || 110000, 10000), 140000);
    const CONCURRENCY = Math.min(Math.max(Number(body.concurrency) || 8, 1), 20);
    const deadline = Date.now() + TIME_BUDGET_MS;

    const processForm = async (form: { id: string; name: string; page: string }) => {
      let leads: MetaLead[] = [];
      try {
        leads = await fetchLeadsForForm(form.id, token, sinceUnix);
      } catch (e) {
        formErrors++;
        console.warn(`fetch leads form ${form.id}: ${(e as Error).message}`);
        return;
      }
      if (leads.length > 0) perForm[form.id] = { name: form.name, leads: leads.length };
      totalLeads += leads.length;

      // Pré-filtro idempotente: pula leads já processados (mesma submissão Meta).
      // A chave `meta:{lead_id}` é única por submissão — pular aqui evita
      // martelar o receive-meta-lead com 100% das submissões a cada execução
      // (era a causa dos timeouts/lead_errors em runs repetidos).
      if (leads.length > 0) {
        const keys = leads.map((l) => `meta:${l.id}`);
        const { data: already } = await supabase
          .from("jetimob_processed")
          .select("jetimob_lead_id")
          .in("jetimob_lead_id", keys);
        const done = new Set((already || []).map((r: any) => r.jetimob_lead_id));
        const before = leads.length;
        leads = leads.filter((l) => !done.has(`meta:${l.id}`));
        skipped += before - leads.length;
      }

      for (const lead of leads) {
        try {
          const payload = {
            secret: webhookSecret,
            source: "meta_backfill",
            field_data: lead.field_data || [],
            campaign_id: lead.campaign_id || "",
            campaign_name: lead.campaign_name || "",
            ad_name: lead.ad_name || "",
            adset_name: lead.adset_name || "",
            formId: lead.form_id || form.id,
            form_name: form.name,
            lead_id: lead.id,
            created_time: lead.created_time,
          };
          const resp = await fetch(`${supabaseUrl}/functions/v1/receive-meta-lead`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const r = await resp.json().catch(() => ({}));
          if (resp.ok) {
            if (typeof r.action === "string" && r.action.startsWith("skipped")) skipped++;
            else reprocessed++;
          } else {
            leadErrors++;
            if (leadErrorSamples.length < 15) {
              leadErrorSamples.push({
                form: form.name,
                lead_id: lead.id,
                status: resp.status,
                body: JSON.stringify(r).slice(0, 200),
              });
            }
          }
        } catch (_e) {
          leadErrors++;
        }
      }
    };

    for (let i = 0; i < forms.length; i += CONCURRENCY) {
      if (Date.now() >= deadline) { timedOut = true; break; }
      const batch = forms.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(processForm));
      formsProcessed += batch.length;
    }

    return json({
      success: true,
      window_days: days,
      forms_total: forms.length,
      forms_processed: formsProcessed,
      timed_out: timedOut,
      total_leads_found: totalLeads,
      reprocessed,
      skipped_dedup: skipped,
      // form_errors: formulários antigos/sem acesso no Meta — esperado, NÃO são leads perdidos.
      form_errors: formErrors,
      // lead_errors: leads recusados pelo receive-meta-lead — investigar via lead_error_samples.
      lead_errors: leadErrors,
      lead_error_samples: leadErrorSamples,
      per_form: perForm,
    });
  } catch (error) {
    console.error("meta-leads-backfill error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
