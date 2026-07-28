import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

interface MetaInsight {
  campaign_id: string;
  campaign_name: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  actions?: Array<{ action_type: string; value: string }>;
  publisher_platform?: string;
  platform_position?: string;
  date_start: string;
  date_stop: string;
}

async function fetchMetaCampaigns(accessToken: string, accountId: string): Promise<MetaCampaign[]> {
  const url = `${META_BASE}/${accountId}/campaigns?fields=id,name,status,objective&access_token=${accessToken}&limit=100`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Meta API error: ${JSON.stringify(err.error || err)}`);
  }
  const data = await res.json();
  return data.data || [];
}

async function fetchInsights(
  accessToken: string,
  accountId: string,
  since: string,
  until: string,
  level: "campaign" | "adset" | "ad",
  breakdowns?: string[],
): Promise<MetaInsight[]> {
  const baseFields = ["campaign_id", "campaign_name", "spend", "impressions", "clicks", "ctr", "cpc", "actions"];
  if (level !== "campaign") baseFields.push("adset_id", "adset_name");
  if (level === "ad") baseFields.push("ad_id", "ad_name");
  const fields = baseFields.join(",");

  const params = new URLSearchParams({
    fields,
    time_range: JSON.stringify({ since, until }),
    level,
    access_token: accessToken,
    limit: "500",
    time_increment: "1", // daily
  });
  if (breakdowns && breakdowns.length) params.set("breakdowns", breakdowns.join(","));

  const url = `${META_BASE}/${accountId}/insights?${params.toString()}`;
  const results: MetaInsight[] = [];
  let next: string | null = url;
  let safety = 0;
  while (next && safety < 20) {
    safety++;
    const res = await fetch(next);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Meta Insights (${level}) error: ${JSON.stringify(err.error || err)}`);
    }
    const data = await res.json();
    for (const row of data.data || []) results.push(row);
    next = data.paging?.next ?? null;
  }
  return results;
}

function extractLeads(insight: MetaInsight): number {
  if (!insight.actions) return 0;
  const a = insight.actions.find(
    (x) => x.action_type === "lead" || x.action_type === "onsite_conversion.lead_grouped",
  );
  return a ? parseInt(a.value) || 0 : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get("CAPI_CRON_SECRET");
    const providedCron = req.headers.get("x-cron-secret");
    const isCron = !!(cronSecret && providedCron && providedCron === cronSecret);

    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let userId: string;
    let supabase = admin;

    if (isCron) {
      // Cron path: pick configured admin user for user_id ownership of rows
      const { data: cfg } = await admin
        .from("integration_settings")
        .select("value")
        .eq("key", "meta_ads_sync_user_id")
        .maybeSingle();
      if (!cfg?.value) {
        return new Response(JSON.stringify({ error: "meta_ads_sync_user_id not configured" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = cfg.value as string;
    } else {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "sync"; // "sync" | "test"

    const { data: settings } = await supabase
      .from("integration_settings")
      .select("key, value")
      .in("key", ["meta_ads_access_token", "meta_ads_account_id", "meta_ads_cpl_limit", "meta_ads_auto_sync"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });

    const accessToken = settingsMap.meta_ads_access_token;
    const accountId = settingsMap.meta_ads_account_id;

    if (!accessToken || !accountId) {
      return new Response(
        JSON.stringify({ error: "Meta Ads não configurado. Adicione o Access Token e Account ID nas configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "test") {
      try {
        const campaigns = await fetchMetaCampaigns(accessToken, accountId);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Conexão OK! ${campaigns.length} campanhas encontradas.`,
            campaigns_count: campaigns.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // SYNC MODE
    const now = new Date();
    const since = body.since || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const until = body.until || now.toISOString().split("T")[0];

    // Service role client already created above as `admin`

    // ─── 1. Campaign-level (legacy marketing_entries) ───
    const [campaigns, campaignInsights] = await Promise.all([
      fetchMetaCampaigns(accessToken, accountId),
      fetchInsights(accessToken, accountId, since, until, "campaign"),
    ]);

    const cplLimit = parseFloat(settingsMap.meta_ads_cpl_limit || "80");
    const alertCampaigns: string[] = [];

    const { data: existingEntries } = await supabase
      .from("marketing_entries")
      .select("campanha, periodo")
      .eq("canal", "meta_ads")
      .eq("user_id", userId);
    const existingKeys = new Set((existingEntries || []).map((e: any) => `${e.campanha}|${e.periodo}`));

    const newCampaignRows: any[] = [];
    for (const insight of campaignInsights) {
      const periodo = `${insight.date_start} a ${insight.date_stop}`;
      const key = `${insight.campaign_name}|${periodo}`;
      if (existingKeys.has(key)) continue;
      const spend = parseFloat(insight.spend) || 0;
      const leads = extractLeads(insight);
      const cpl = leads > 0 ? spend / leads : null;
      if (cpl !== null && cpl > cplLimit) alertCampaigns.push(insight.campaign_name);
      newCampaignRows.push({
        user_id: userId,
        canal: "meta_ads",
        campanha: insight.campaign_name,
        empreendimento: null,
        periodo,
        investimento: spend,
        impressoes: parseInt(insight.impressions) || 0,
        cliques: parseInt(insight.clicks) || 0,
        leads_gerados: leads,
        conversoes: 0,
        cpl,
        cpc: parseFloat(insight.cpc) || 0,
        ctr: parseFloat(insight.ctr) || 0,
        visitas: 0,
        propostas: 0,
        vendas: 0,
      });
    }

    let campaignInserted = 0;
    for (let i = 0; i < newCampaignRows.length; i += 50) {
      const batch = newCampaignRows.slice(i, i + 50);
      const { error } = await supabase.from("marketing_entries").insert(batch);
      if (!error) campaignInserted += batch.length;
      else console.error("campaign insert:", error);
    }

    // ─── 2. Adset-level (upsert em marketing_entries_adset) ───
    let adsetInserted = 0;
    try {
      const adsetInsights = await fetchInsights(accessToken, accountId, since, until, "adset");
      const adsetRows = adsetInsights.map((i) => {
        const spend = parseFloat(i.spend) || 0;
        const leads = extractLeads(i);
        return {
          user_id: userId,
          campaign_id: i.campaign_id,
          campaign_name: i.campaign_name,
          adset_id: i.adset_id!,
          adset_name: i.adset_name,
          date_start: i.date_start,
          date_stop: i.date_stop,
          spend,
          impressoes: parseInt(i.impressions) || 0,
          cliques: parseInt(i.clicks) || 0,
          leads,
          cpc: parseFloat(i.cpc) || 0,
          ctr: parseFloat(i.ctr) || 0,
          cpl: leads > 0 ? spend / leads : null,
        };
      });
      for (let i = 0; i < adsetRows.length; i += 100) {
        const batch = adsetRows.slice(i, i + 100);
        const { error } = await admin
          .from("marketing_entries_adset")
          .upsert(batch, { onConflict: "adset_id,date_start,date_stop" });
        if (!error) adsetInserted += batch.length;
        else console.error("adset upsert:", error);
      }
    } catch (e) {
      console.error("adset fetch error", e);
    }

    // ─── 3. Ad-level com breakdown publisher_platform + platform_position ───
    let adInserted = 0;
    try {
      const adInsights = await fetchInsights(
        accessToken,
        accountId,
        since,
        until,
        "ad",
        ["publisher_platform", "platform_position"],
      );
      const adRows = adInsights.map((i) => {
        const spend = parseFloat(i.spend) || 0;
        const leads = extractLeads(i);
        return {
          user_id: userId,
          campaign_id: i.campaign_id,
          campaign_name: i.campaign_name,
          adset_id: i.adset_id!,
          adset_name: i.adset_name,
          ad_id: i.ad_id!,
          ad_name: i.ad_name,
          publisher_platform: i.publisher_platform || null,
          platform_position: i.platform_position || null,
          ad_format: null,
          creative_type: null,
          date_start: i.date_start,
          date_stop: i.date_stop,
          spend,
          impressoes: parseInt(i.impressions) || 0,
          cliques: parseInt(i.clicks) || 0,
          leads,
          cpc: parseFloat(i.cpc) || 0,
          ctr: parseFloat(i.ctr) || 0,
          cpl: leads > 0 ? spend / leads : null,
        };
      });
      for (let i = 0; i < adRows.length; i += 100) {
        const batch = adRows.slice(i, i + 100);
        const { error } = await admin
          .from("marketing_entries_ad")
          .upsert(batch, { onConflict: "ad_id,date_start,date_stop,publisher_platform,platform_position" });
        if (!error) adInserted += batch.length;
        else console.error("ad upsert:", error);
      }
    } catch (e) {
      console.error("ad fetch error", e);
    }

    // Alerts CPL
    if (alertCampaigns.length > 0) {
      const { data: adminRoles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      if (adminRoles && adminRoles.length > 0) {
        const notifications = adminRoles.map((r: any) => ({
          user_id: r.user_id,
          titulo: "⚠️ CPL acima do limite",
          mensagem: `Campanhas com CPL acima de R$ ${cplLimit}: ${alertCampaigns.join(", ")}`,
          tipo: "marketing_alert",
          categoria: "marketing",
        }));
        await admin.from("notifications").insert(notifications);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_found: campaigns.length,
        insights_fetched: campaignInsights.length,
        new_entries_inserted: campaignInserted,
        skipped_existing: campaignInsights.length - newCampaignRows.length,
        adset_rows_upserted: adsetInserted,
        ad_rows_upserted: adInserted,
        alerts_sent: alertCampaigns.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("meta-ads-sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
