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

    const { action, jetimob_user_id, email, nome, senha, gerente_id, role, target_user_id } = await req.json();

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
      if (!email || !nome || !senha) {
        throw new Error("Dados incompletos: email, nome e senha são obrigatórios");
      }

      const assignedRole = role === "gestor" ? "gestor" : "corretor";

      // Create auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome },
      });

      if (createError) throw new Error(`Erro ao criar usuário: ${createError.message}`);

      // Update profile with jetimob_user_id (trigger auto-creates profile)
      await new Promise((r) => setTimeout(r, 500));

      const profileUpdate: Record<string, string> = { nome };
      if (jetimob_user_id) profileUpdate.jetimob_user_id = jetimob_user_id;

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("user_id", newUser.user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      // Remove default corretor role if assigning gestor
      if (assignedRole !== "corretor") {
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", newUser.user.id)
          .eq("role", "corretor");
      }

      // Assign role
      await supabase
        .from("user_roles")
        .upsert({ user_id: newUser.user.id, role: assignedRole }, { onConflict: "user_id,role" });

      // Link to manager's team (only for corretores)
      if (gerente_id && assignedRole === "corretor") {
        // Check if there's an existing team_member with same name to link
        const { data: existingMember } = await supabase
          .from("team_members")
          .select("id")
          .eq("gerente_id", gerente_id)
          .ilike("nome", nome.trim())
          .is("user_id", null)
          .maybeSingle();

        if (existingMember) {
          // Link existing manual entry to the new user
          await supabase
            .from("team_members")
            .update({ user_id: newUser.user.id, status: "ativo" })
            .eq("id", existingMember.id);
        } else {
          // Create new team member entry
          const { error: teamError } = await supabase
            .from("team_members")
            .insert({ gerente_id, nome, status: "ativo", user_id: newUser.user.id });
          if (teamError) {
            console.error("Team member insert error:", teamError);
          }
        }
      }

      const roleLabel = assignedRole === "gestor" ? "Gerente" : "Corretor";
      return new Response(JSON.stringify({ 
        success: true, 
        user_id: newUser.user.id,
        message: `${roleLabel} ${nome} criado com sucesso!` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_user") {
      if (!target_user_id) throw new Error("ID do usuário não informado");

      const updates: Record<string, any> = {};

      // Update profile fields
      const profileUpdates: Record<string, any> = {};
      if (nome !== undefined) profileUpdates.nome = nome;
      if (jetimob_user_id !== undefined) profileUpdates.jetimob_user_id = jetimob_user_id || null;
      if (email !== undefined) profileUpdates.email = email;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", target_user_id);
        if (profileErr) console.error("Profile update error:", profileErr);
      }

      // Update auth email if changed
      if (email) {
        const { error: emailErr } = await supabase.auth.admin.updateUserById(target_user_id, { email });
        if (emailErr) console.error("Email update error:", emailErr);
      }

      // Reset password if provided
      if (senha) {
        const { error: passErr } = await supabase.auth.admin.updateUserById(target_user_id, { password: senha });
        if (passErr) throw new Error(`Erro ao redefinir senha: ${passErr.message}`);
      }

      // Update team_member name if changed
      if (nome) {
        await supabase.from("team_members").update({ nome }).eq("user_id", target_user_id);
      }

      return new Response(JSON.stringify({ success: true, message: "Usuário atualizado com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      if (!target_user_id) throw new Error("ID do usuário não informado");
      if (target_user_id === caller.id) throw new Error("Você não pode excluir a si mesmo");

      // Delete all user data across the system before removing auth user
      const deletions = [
        supabase.from("lead_messages").delete().eq("user_id", target_user_id),
        supabase.from("lead_tasks").delete().eq("user_id", target_user_id),
        supabase.from("leads").delete().eq("user_id", target_user_id),
        supabase.from("saved_scripts").delete().eq("user_id", target_user_id),
        supabase.from("corretor_daily_goals").delete().eq("corretor_id", target_user_id),
        supabase.from("oferta_ativa_tentativas").delete().eq("corretor_id", target_user_id),
        supabase.from("oferta_ativa_leads").delete().eq("corretor_id", target_user_id),
        supabase.from("team_members").delete().eq("user_id", target_user_id),
        supabase.from("audit_log").delete().eq("user_id", target_user_id),
        supabase.from("marketing_entries").delete().eq("user_id", target_user_id),
        supabase.from("marketing_reports").delete().eq("user_id", target_user_id),
        supabase.from("corretor_reports").delete().eq("gerente_id", target_user_id),
        supabase.from("funnel_entries").delete().eq("gerente_id", target_user_id),
        supabase.from("pdn_entries").delete().eq("gerente_id", target_user_id),
        supabase.from("manager_checklist").delete().eq("gerente_id", target_user_id),
        supabase.from("ceo_metas_mensais").delete().eq("gerente_id", target_user_id),
      ];

      // Delete checkpoint_lines before checkpoints (FK dependency)
      const { data: userCheckpoints } = await supabase
        .from("checkpoints")
        .select("id")
        .eq("gerente_id", target_user_id);

      if (userCheckpoints && userCheckpoints.length > 0) {
        const checkpointIds = userCheckpoints.map((c: any) => c.id);
        await supabase.from("checkpoint_lines").delete().in("checkpoint_id", checkpointIds);
      }
      await supabase.from("checkpoints").delete().eq("gerente_id", target_user_id);

      // Run all other deletions in parallel
      const results = await Promise.allSettled(deletions);
      const errors = results.filter((r) => r.status === "rejected");
      if (errors.length > 0) {
        console.error("Some deletions failed:", errors);
      }

      // Also unlink oferta_ativa_leads where this user was attending
      await supabase
        .from("oferta_ativa_leads")
        .update({ em_atendimento_por: null, em_atendimento_ate: null })
        .eq("em_atendimento_por", target_user_id);

      // Remove profile and roles
      await supabase.from("user_roles").delete().eq("user_id", target_user_id);
      await supabase.from("profiles").delete().eq("user_id", target_user_id);

      // Finally delete auth user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(target_user_id);
      if (deleteError) throw new Error(`Erro ao excluir usuário: ${deleteError.message}`);

      return new Response(JSON.stringify({ success: true, message: "Usuário excluído com sucesso! Todos os dados foram removidos." }), {
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
