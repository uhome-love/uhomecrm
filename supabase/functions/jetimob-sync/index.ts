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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Support both cron (no JWT) and manual (JWT) calls
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      // Check if this is the anon key (cron call) or a real JWT
      if (token !== supabaseAnonKey) {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
        if (!claimsError && claimsData?.claims) {
          userId = claimsData.claims.sub as string;
          // Verify role
          const adminClient = createClient(supabaseUrl, serviceRoleKey);
          const { data: roles } = await adminClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          const userRoles = (roles || []).map(r => r.role);
          if (!userRoles.includes("admin") && !userRoles.includes("gestor")) {
            return new Response(
              JSON.stringify({ error: "Sem permissão" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // Use service role for all DB operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { broker_id } = body;

    // Get Jetimob API keys
    const JETIMOB_LEADS_URL_KEY = Deno.env.get("JETIMOB_LEADS_URL_KEY");
    const JETIMOB_LEADS_PRIVATE_KEY = Deno.env.get("JETIMOB_LEADS_PRIVATE_KEY");
    if (!JETIMOB_LEADS_URL_KEY || !JETIMOB_LEADS_PRIVATE_KEY) {
      throw new Error("JETIMOB_LEADS keys not configured");
    }

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

    if (broker_id) {
      apiLeads = apiLeads.filter((lead: any) => {
        const responsavelId = lead.broker_id || lead.responsavel_id || lead.user_id;
        return String(responsavelId) === String(broker_id);
      });
    }

    if (apiLeads.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, skipped: 0, message: "Nenhum lead encontrado" }),
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
      const telefone2 = lead.phones?.[1] || null;
      const email = lead.emails?.[0] || lead.email || null;
      const observacoes = lead.message || lead.subject || null;
      
      // Extract campaign name from message field
      // Pattern: "Lead Gerado do Formulário de/do/da/dos <CAMPAIGN NAME>"
      let campanhaNome: string | null = null;
      const msg = lead.message || "";
      const formularioMatch = msg.match(/[Ff]ormul[aá]rio\s+(?:de|do|da|dos|das)\s+(.+)/i);
      if (formularioMatch?.[1]) {
        campanhaNome = formularioMatch[1].trim();
      }
      
      const origem = campanhaNome || msg || "API Jetimob";
      const origemDetalhe = lead.source || lead.origin || lead.utm_source || null;
      const empreendimento = campanhaNome || lead.property_name || lead.property?.name || lead.empreendimento || null;
      const brokerName = lead.broker_name || lead.broker?.name || null;

      // Try to find corretor_id from broker_name in team_members
      let corretorId: string | null = null;
      if (brokerName) {
        const { data: member } = await adminClient
          .from("team_members")
          .select("user_id")
          .ilike("nome", `%${brokerName.split(" ")[0]}%`)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle();
        if (member?.user_id) corretorId = member.user_id;
      }

      const { error: insertError } = await adminClient
        .from("pipeline_leads")
        .insert({
          nome,
          telefone,
          telefone2,
          email,
          empreendimento,
          stage_id: novoLeadStageId,
          origem,
          origem_detalhe: origemDetalhe,
          jetimob_lead_id: jetimobId,
          observacoes,
          corretor_id: corretorId,
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
      user_id: userId || "00000000-0000-0000-0000-000000000000",
      modulo: "pipeline",
      acao: "jetimob_sync",
      descricao: `Sincronizados ${synced} leads do Jetimob para o Pipeline. ${skipped} ignorados.`,
      origem: userId ? "manual" : "cron",
    });

    console.log(`Jetimob sync complete: ${synced} synced, ${skipped} skipped`);

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
