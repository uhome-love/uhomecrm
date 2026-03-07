import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Use service role for inserts (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check user has gestor or admin role
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    const userRoles = (roles || []).map(r => r.role);
    if (!userRoles.includes("admin") && !userRoles.includes("gestor")) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para sincronizar leads" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Jetimob API keys
    const JETIMOB_LEADS_URL_KEY = Deno.env.get("JETIMOB_LEADS_URL_KEY");
    const JETIMOB_LEADS_PRIVATE_KEY = Deno.env.get("JETIMOB_LEADS_PRIVATE_KEY");
    if (!JETIMOB_LEADS_URL_KEY || !JETIMOB_LEADS_PRIVATE_KEY) {
      throw new Error("JETIMOB_LEADS keys not configured");
    }

    const body = await req.json().catch(() => ({}));
    const { broker_id } = body;

    // Fetch leads from Jetimob API
    const url = `https://api.jetimob.com/leads/${JETIMOB_LEADS_URL_KEY}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Authorization-Key": JETIMOB_LEADS_PRIVATE_KEY },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Jetimob API error:", response.status, text);
      return new Response(
        JSON.stringify({ error: `Erro Jetimob: ${response.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let apiLeads = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];

    // Filter by broker if specified
    if (broker_id) {
      apiLeads = apiLeads.filter((lead: any) => {
        const responsavelId = lead.broker_id || lead.responsavel_id || lead.user_id;
        return String(responsavelId) === String(broker_id);
      });
    }

    if (apiLeads.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, skipped: 0, message: "Nenhum lead encontrado na API" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the "novo_lead" stage
    const { data: stageData } = await adminClient
      .from("pipeline_stages")
      .select("id")
      .eq("tipo", "novo_lead")
      .eq("ativo", true)
      .single();

    if (!stageData) {
      throw new Error("Estágio 'Novos Leads' não encontrado");
    }
    const novoLeadStageId = stageData.id;

    // Get existing jetimob_lead_ids to avoid duplicates
    const jetimobIds = apiLeads.map((l: any) => String(l.id)).filter(Boolean);
    const { data: existingLeads } = await adminClient
      .from("pipeline_leads")
      .select("jetimob_lead_id")
      .in("jetimob_lead_id", jetimobIds);
    
    const existingIds = new Set((existingLeads || []).map(l => l.jetimob_lead_id));

    // Insert new leads into pipeline_leads
    let synced = 0;
    let skipped = 0;

    for (const lead of apiLeads) {
      const jetimobId = String(lead.id);
      
      if (existingIds.has(jetimobId)) {
        skipped++;
        continue;
      }

      const nome = lead.full_name || lead.name || lead.nome || "Lead sem nome";
      const telefone = lead.phones?.[0] || lead.phone || lead.telefone || null;
      const email = lead.emails?.[0] || lead.email || null;
      const interesse = lead.message || lead.subject || null;
      const origem = lead.campaign_id ? `Campanha ${lead.campaign_id}` : "API Jetimob";
      const origemDetalhe = lead.source || lead.origin || null;
      const empreendimento = lead.property_name || lead.empreendimento || null;

      const { error: insertError } = await adminClient
        .from("pipeline_leads")
        .insert({
          nome,
          telefone,
          email,
          empreendimento,
          stage_id: novoLeadStageId,
          origem,
          origem_detalhe: origemDetalhe,
          jetimob_lead_id: jetimobId,
          observacoes: interesse,
          created_by: userId,
        });

      if (insertError) {
        console.error(`Error inserting lead ${jetimobId}:`, insertError);
        skipped++;
      } else {
        synced++;
      }
    }

    // Audit log
    await adminClient.from("audit_log").insert({
      user_id: userId,
      modulo: "pipeline",
      acao: "jetimob_sync",
      descricao: `Sincronizados ${synced} leads do Jetimob para o Pipeline. ${skipped} ignorados.`,
      origem: "jetimob-sync",
    });

    return new Response(
      JSON.stringify({ synced, skipped, total: apiLeads.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("jetimob-sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
