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
async function discoverForms(token: string): Promise<{ pages: any[]; forms: { id: string; name: string; page: string }[] }> {
  const forms: { id: string; name: string; page: string }[] = [];
  const pagesOut: any[] = [];

  // Tenta /me/accounts (user token). Se falhar, trata token como page token.
  let pages: any[] = [];
  try {
    const acc = await metaGet("me/accounts", token, { fields: "id,name", limit: "200" });
    pages = acc.data || [];
  } catch (_e) {
    // pode ser um page token — pega /me
    try {
      const me = await metaGet("me", token, { fields: "id,name" });
      if (me.id) pages = [me];
    } catch (_e2) {
      pages = [];
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

    // ── Auth: cron secret OU admin JWT ──
    const cronSecret = Deno.env.get("SYNC_SECRET");
    const providedCron = req.headers.get("x-cron-secret");
    let authorized = !!cronSecret && providedCron === cronSecret;

    const body = await req.json().catch(() => ({}));

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

    // Descobre forms
    const { pages, forms } = await discoverForms(token);

    if (mode === "test") {
      return json({
        success: true,
        token_ok: true,
        pages,
        forms_count: forms.length,
        forms: forms.slice(0, 100),
      });
    }

    // ── BACKFILL ──
    let totalLeads = 0;
    let reprocessed = 0;
    let skipped = 0;
    let errors = 0;
    const perForm: Record<string, { name: string; leads: number }> = {};

    for (const form of forms) {
      let leads: MetaLead[] = [];
      try {
        leads = await fetchLeadsForForm(form.id, token, sinceUnix);
      } catch (e) {
        errors++;
        console.warn(`fetch leads form ${form.id}: ${(e as Error).message}`);
        continue;
      }
      perForm[form.id] = { name: form.name, leads: leads.length };
      totalLeads += leads.length;

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
            errors++;
          }
        } catch (_e) {
          errors++;
        }
      }
    }

    return json({
      success: true,
      window_days: days,
      forms_count: forms.length,
      total_leads_found: totalLeads,
      reprocessed,
      skipped_dedup: skipped,
      errors,
      per_form: perForm,
    });
  } catch (error) {
    console.error("meta-leads-backfill error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
