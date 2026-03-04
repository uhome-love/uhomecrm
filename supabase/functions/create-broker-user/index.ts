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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action, jetimob_user_id, email, nome, senha, gerente_id } = await req.json();

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY!);
    const { data: { user: caller } } = await anonClient.auth.getUser(token);
    if (!caller) throw new Error("Não autorizado");

    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();
    if (!roleCheck) throw new Error("Apenas administradores podem criar usuários");

    if (action === "lookup_broker") {
      // Search leads API for broker info
      const JETIMOB_LEADS_URL_KEY = Deno.env.get("JETIMOB_LEADS_URL_KEY");
      const JETIMOB_LEADS_PRIVATE_KEY = Deno.env.get("JETIMOB_LEADS_PRIVATE_KEY");
      if (!JETIMOB_LEADS_URL_KEY || !JETIMOB_LEADS_PRIVATE_KEY) {
        throw new Error("Chaves da API Jetimob não configuradas");
      }

      const response = await fetch(`https://api.jetimob.com/leads/${JETIMOB_LEADS_URL_KEY}`, {
        headers: { "Authorization-Key": JETIMOB_LEADS_PRIVATE_KEY },
      });

      if (!response.ok) throw new Error("Erro ao consultar API Jetimob");

      const data = await response.json();
      const results = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];

      // Find leads assigned to this broker to extract their name
      const brokerLead = results.find((l: any) => {
        const bId = String(l.broker_id || l.responsavel_id || l.user_id || "");
        return bId === String(jetimob_user_id);
      });

      const brokerName = brokerLead?.broker_name || null;
      const leadCount = results.filter((l: any) => {
        const bId = String(l.broker_id || l.responsavel_id || l.user_id || "");
        return bId === String(jetimob_user_id);
      }).length;

      return new Response(JSON.stringify({ broker_name: brokerName, lead_count: leadCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_user") {
      if (!email || !nome || !senha || !jetimob_user_id) {
        throw new Error("Dados incompletos: email, nome, senha e jetimob_user_id são obrigatórios");
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome },
      });

      if (createError) throw new Error(`Erro ao criar usuário: ${createError.message}`);

      // Update profile with jetimob_user_id (trigger auto-creates profile)
      // Small delay to ensure trigger has run
      await new Promise((r) => setTimeout(r, 500));

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ jetimob_user_id, nome })
        .eq("user_id", newUser.user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      // Assign corretor role (trigger should do this, but ensure)
      await supabase
        .from("user_roles")
        .upsert({ user_id: newUser.user.id, role: "corretor" }, { onConflict: "user_id,role" });

      // Link broker to manager's team
      if (gerente_id) {
        const { error: teamError } = await supabase
          .from("team_members")
          .insert({ gerente_id, nome, status: "ativo" });
        if (teamError) {
          console.error("Team member insert error:", teamError);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        user_id: newUser.user.id,
        message: `Usuário ${nome} criado e vinculado ao gerente com sucesso!` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-broker-user error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
