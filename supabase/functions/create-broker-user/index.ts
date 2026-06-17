import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BAN_FOREVER = "876000h"; // ~100 years

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      action, jetimob_user_id, email, nome, senha, gerente_id, role,
      target_user_id, reassign_to, telefone, cpf, creci,
      reassign_leads, reassign_negocios, reassign_tarefas,
    } = body;

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY!);
    const { data: { user: caller } } = await anonClient.auth.getUser(token);
    if (!caller) throw new Error("Não autorizado");

    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const callerRoleList = (callerRoles || []).map((r: any) => r.role);
    const isAdmin = callerRoleList.includes("admin");
    const isGestor = callerRoleList.includes("gestor");

    if (!isAdmin && !isGestor) throw new Error("Apenas administradores e gerentes podem gerenciar usuários");

    // Resolve director status + the set of gerentes the caller can manage
    const { data: dirRows } = await supabase
      .from("diretoria_equipes")
      .select("gerente_auth_id")
      .eq("diretor_auth_id", caller.id);
    const isDiretora = !!(dirRows && dirRows.length > 0);
    const managedGerentes: string[] = isDiretora
      ? (dirRows || []).map((r: any) => r.gerente_auth_id)
      : [caller.id];

    // Helper: which gerente owns a given user (via team_members)
    async function gerenteOf(userId: string): Promise<string | null> {
      const { data } = await supabase
        .from("team_members")
        .select("gerente_id")
        .eq("user_id", userId)
        .maybeSingle();
      return data?.gerente_id || null;
    }

    // Helper: can the caller manage this target user?
    async function assertCanManage(userId: string) {
      if (isAdmin) return;
      if (userId === caller.id) throw new Error("Você não pode executar esta ação sobre si mesmo");
      const g = await gerenteOf(userId);
      if (!g || !managedGerentes.includes(g)) {
        throw new Error("Este usuário não pertence à sua equipe");
      }
    }

    // Helper: resolve profile id from auth user id
    async function profileIdOf(userId: string): Promise<string | null> {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      return data?.id || null;
    }

    // Helper: reassign operational data from one corretor to another
    async function reassignData(
      fromUserId: string,
      toUserId: string,
      opts: { leads?: boolean; negocios?: boolean; tarefas?: boolean },
    ) {
      const fromProfileId = await profileIdOf(fromUserId);
      const toProfileId = await profileIdOf(toUserId);
      const tasks: Promise<any>[] = [];

      if (opts.leads) {
        // pipeline_leads.corretor_id -> auth user id
        tasks.push(
          supabase.from("pipeline_leads")
            .update({ corretor_id: toUserId })
            .eq("corretor_id", fromUserId) as any,
        );
        // oferta_ativa_leads.corretor_id -> auth user id
        tasks.push(
          supabase.from("oferta_ativa_leads")
            .update({ corretor_id: toUserId })
            .eq("corretor_id", fromUserId) as any,
        );
      }

      if (opts.negocios) {
        // negocios.corretor_id -> profiles.id ; auth_user_id -> auth user id
        if (fromProfileId && toProfileId) {
          tasks.push(
            supabase.from("negocios")
              .update({ corretor_id: toProfileId, auth_user_id: toUserId })
              .eq("corretor_id", fromProfileId) as any,
          );
        }
        tasks.push(
          supabase.from("negocios")
            .update({ auth_user_id: toUserId })
            .eq("auth_user_id", fromUserId) as any,
        );
      }

      if (opts.tarefas) {
        // pipeline_tarefas.responsavel_id -> auth user id
        tasks.push(
          supabase.from("pipeline_tarefas")
            .update({ responsavel_id: toUserId })
            .eq("responsavel_id", fromUserId) as any,
        );
        // tarefas.responsavel_id -> profiles.id
        if (fromProfileId && toProfileId) {
          tasks.push(
            supabase.from("tarefas")
              .update({ responsavel_id: toProfileId })
              .eq("responsavel_id", fromProfileId) as any,
          );
        }
        // visitas.corretor_id -> auth user id
        tasks.push(
          supabase.from("visitas")
            .update({ corretor_id: toUserId })
            .eq("corretor_id", fromUserId) as any,
        );
      }

      const results = await Promise.allSettled(tasks);
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) console.error("Some reassignments failed:", failed);
    }

    // ── LOOKUP BROKER (admin only) ──────────────────────────────────────────
    if (action === "lookup_broker") {
      if (!isAdmin) throw new Error("Apenas administradores podem consultar corretores Jetimob");
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

    // ── CREATE USER ─────────────────────────────────────────────────────────
    if (action === "create_user") {
      if (!email || !nome || !senha) {
        throw new Error("Dados incompletos: email, nome e senha são obrigatórios");
      }

      const validRoles = ["corretor", "gestor", "backoffice", "rh"];
      // Only admins can assign non-corretor roles
      const assignedRole = !isAdmin ? "corretor" : (validRoles.includes(role) ? role : "corretor");
      // Gestor/diretora creating a corretor: auto-assign to a managed team
      let effectiveGerenteId = gerente_id;
      if (!isAdmin && assignedRole === "corretor") {
        if (gerente_id && managedGerentes.includes(gerente_id)) {
          effectiveGerenteId = gerente_id;
        } else {
          effectiveGerenteId = caller.id;
        }
      }

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome },
      });

      if (createError) {
        const createErrorMessage = createError.message || "Erro desconhecido ao criar usuário";
        if (createErrorMessage.toLowerCase().includes("already been registered")) {
          return new Response(JSON.stringify({
            success: false,
            error: "Este e-mail já está cadastrado. Edite o usuário existente.",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw new Error(`Erro ao criar usuário: ${createErrorMessage}`);
      }

      await new Promise((r) => setTimeout(r, 500));

      const profileUpdate: Record<string, any> = { nome };
      if (jetimob_user_id) profileUpdate.jetimob_user_id = jetimob_user_id;
      if (telefone !== undefined) profileUpdate.telefone = telefone || null;
      if (cpf !== undefined) profileUpdate.cpf = cpf || null;
      if (creci !== undefined) profileUpdate.creci = creci || null;

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("user_id", newUser.user.id);
      if (profileError) console.error("Profile update error:", profileError);

      if (assignedRole !== "corretor") {
        await supabase.from("user_roles").delete()
          .eq("user_id", newUser.user.id).eq("role", "corretor");
      }
      await supabase.from("user_roles")
        .upsert({ user_id: newUser.user.id, role: assignedRole }, { onConflict: "user_id,role" });

      let teamLinkError: string | null = null;
      if (effectiveGerenteId && assignedRole === "corretor") {
        let equipeNome: string | null = null;
        try {
          const { data: gerenteProfile } = await supabase
            .from("profiles").select("nome").eq("user_id", effectiveGerenteId).maybeSingle();
          if (gerenteProfile?.nome) {
            equipeNome = String(gerenteProfile.nome).trim().split(/\s+/)[0] || null;
          }
        } catch (e) { console.error("Failed to resolve manager name:", e); }

        const { data: existingMember } = await supabase
          .from("team_members").select("id")
          .eq("gerente_id", effectiveGerenteId)
          .ilike("nome", nome.trim()).is("user_id", null).maybeSingle();

        if (existingMember) {
          const { error: updateErr } = await supabase.from("team_members")
            .update({ user_id: newUser.user.id, status: "ativo", equipe: equipeNome })
            .eq("id", existingMember.id);
          if (updateErr) { console.error(updateErr); teamLinkError = updateErr.message; }
        } else {
          const { error: teamError } = await supabase.from("team_members").insert({
            gerente_id: effectiveGerenteId, nome, status: "ativo",
            user_id: newUser.user.id, equipe: equipeNome,
          });
          if (teamError) { console.error(teamError); teamLinkError = teamError.message; }
        }
      }

      const roleLabel = assignedRole === "gestor" ? "Gerente" : assignedRole === "backoffice" ? "Backoffice" : assignedRole === "rh" ? "RH" : "Corretor";
      const baseMessage = `${roleLabel} ${nome} criado com sucesso!`;
      const message = teamLinkError
        ? `${baseMessage} (Atenção: vínculo com a equipe falhou — ${teamLinkError}. Vincule manualmente.)`
        : baseMessage;
      return new Response(JSON.stringify({
        success: true, user_id: newUser.user.id, team_link_error: teamLinkError, message,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── UPDATE USER ─────────────────────────────────────────────────────────
    if (action === "update_user") {
      if (!target_user_id) throw new Error("ID do usuário não informado");
      await assertCanManage(target_user_id);

      const profileUpdates: Record<string, any> = {};
      if (nome !== undefined) profileUpdates.nome = nome;
      if (jetimob_user_id !== undefined) profileUpdates.jetimob_user_id = jetimob_user_id || null;
      if (email !== undefined) profileUpdates.email = email;
      if (telefone !== undefined) profileUpdates.telefone = telefone || null;
      if (cpf !== undefined) profileUpdates.cpf = cpf || null;
      if (creci !== undefined) profileUpdates.creci = creci || null;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileErr } = await supabase
          .from("profiles").update(profileUpdates).eq("user_id", target_user_id);
        if (profileErr) console.error("Profile update error:", profileErr);
      }

      if (email) {
        const { error: emailErr } = await supabase.auth.admin.updateUserById(target_user_id, { email });
        if (emailErr) console.error("Email update error:", emailErr);
      }
      if (senha) {
        const { error: passErr } = await supabase.auth.admin.updateUserById(target_user_id, { password: senha });
        if (passErr) throw new Error(`Erro ao redefinir senha: ${passErr.message}`);
      }
      if (nome) {
        await supabase.from("team_members").update({ nome }).eq("user_id", target_user_id);
      }

      return new Response(JSON.stringify({ success: true, message: "Usuário atualizado com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INACTIVATE USER ─────────────────────────────────────────────────────
    if (action === "inactivate_user") {
      if (!target_user_id) throw new Error("ID do usuário não informado");
      await assertCanManage(target_user_id);
      if (target_user_id === caller.id) throw new Error("Você não pode inativar a si mesmo");

      if (reassign_to) {
        await assertCanManage(reassign_to).catch(() => {
          if (!isAdmin) throw new Error("O corretor destino não pertence à sua equipe");
        });
        await reassignData(target_user_id, reassign_to, {
          leads: reassign_leads !== false,
          negocios: reassign_negocios !== false,
          tarefas: reassign_tarefas !== false,
        });
      }

      // Block login
      const { error: banErr } = await supabase.auth.admin.updateUserById(target_user_id, { ban_duration: BAN_FOREVER } as any);
      if (banErr) console.error("Ban error:", banErr);

      await supabase.from("profiles").update({ ativo: false }).eq("user_id", target_user_id);
      await supabase.from("team_members").update({ status: "inativo" }).eq("user_id", target_user_id);

      return new Response(JSON.stringify({ success: true, message: "Usuário inativado e dados repassados." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── REACTIVATE USER ─────────────────────────────────────────────────────
    if (action === "reactivate_user") {
      if (!target_user_id) throw new Error("ID do usuário não informado");
      await assertCanManage(target_user_id);

      const { error: banErr } = await supabase.auth.admin.updateUserById(target_user_id, { ban_duration: "none" } as any);
      if (banErr) console.error("Unban error:", banErr);

      await supabase.from("profiles").update({ ativo: true }).eq("user_id", target_user_id);
      await supabase.from("team_members").update({ status: "ativo" }).eq("user_id", target_user_id);

      return new Response(JSON.stringify({ success: true, message: "Usuário reativado com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE USER (with reassignment) ─────────────────────────────────────
    if (action === "delete_user") {
      if (!target_user_id) throw new Error("ID do usuário não informado");
      if (target_user_id === caller.id) throw new Error("Você não pode excluir a si mesmo");
      await assertCanManage(target_user_id);
      if (!reassign_to) throw new Error("Informe para quem repassar os dados antes de excluir");

      // Validate destination is within caller's scope
      if (!isAdmin) {
        const destG = await gerenteOf(reassign_to);
        if (!destG || !managedGerentes.includes(destG)) {
          throw new Error("O corretor destino não pertence à sua equipe");
        }
      }

      // Repassar dados operacionais ao corretor destino
      await reassignData(target_user_id, reassign_to, {
        leads: reassign_leads !== false,
        negocios: reassign_negocios !== false,
        tarefas: reassign_tarefas !== false,
      });

      const profileId = await profileIdOf(target_user_id);

      // Liberar atendimentos em aberto
      await supabase.from("oferta_ativa_leads")
        .update({ em_atendimento_por: null, em_atendimento_ate: null })
        .eq("em_atendimento_por", target_user_id);

      // Remover dados pessoais sem dono (não repassáveis)
      const personalDeletions = [
        supabase.from("lead_messages").delete().eq("user_id", target_user_id),
        supabase.from("lead_tasks").delete().eq("user_id", target_user_id),
        supabase.from("saved_scripts").delete().eq("user_id", target_user_id),
        supabase.from("corretor_daily_goals").delete().eq("corretor_id", target_user_id),
        supabase.from("oferta_ativa_tentativas").delete().eq("corretor_id", target_user_id),
        supabase.from("team_members").delete().eq("user_id", target_user_id),
        supabase.from("audit_log").delete().eq("user_id", target_user_id),
        supabase.from("corretor_disponibilidade").delete().eq("user_id", target_user_id),
        supabase.from("corretor_conquistas").delete().eq("user_id", target_user_id),
        supabase.from("corretor_onboarding").delete().eq("user_id", target_user_id),
        supabase.from("homi_conversations").delete().eq("user_id", target_user_id),
        supabase.from("homi_briefing_diario").delete().eq("user_id", target_user_id),
        supabase.from("backoffice_tasks").delete().eq("user_id", target_user_id),
        supabase.from("coaching_sessions").delete().eq("corretor_id", target_user_id),
      ];
      if (profileId) {
        personalDeletions.push(
          supabase.from("checkpoint_diario").delete().eq("corretor_id", profileId),
          supabase.from("academia_progresso").delete().eq("corretor_id", profileId),
          supabase.from("academia_certificados").delete().eq("corretor_id", profileId),
          supabase.from("lead_progressao").delete().eq("corretor_id", profileId),
          supabase.from("roleta_credenciamentos").delete().eq("corretor_id", profileId),
        );
      }

      // checkpoint_lines/checkpoints onde o usuário era gerente
      const { data: userCheckpoints } = await supabase
        .from("checkpoints").select("id").eq("gerente_id", target_user_id);
      if (userCheckpoints && userCheckpoints.length > 0) {
        const ids = userCheckpoints.map((c: any) => c.id);
        await supabase.from("checkpoint_lines").delete().in("checkpoint_id", ids);
      }
      await supabase.from("checkpoints").delete().eq("gerente_id", target_user_id);

      const results = await Promise.allSettled(personalDeletions);
      const errors = results.filter((r) => r.status === "rejected");
      if (errors.length > 0) console.error("Some deletions failed:", errors);

      await supabase.from("user_roles").delete().eq("user_id", target_user_id);
      await supabase.from("profiles").delete().eq("user_id", target_user_id);

      const { error: deleteError } = await supabase.auth.admin.deleteUser(target_user_id);
      if (deleteError) throw new Error(`Erro ao excluir usuário: ${deleteError.message}`);

      return new Response(JSON.stringify({
        success: true,
        message: "Usuário excluído. Leads, negócios e tarefas foram repassados ao corretor escolhido.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
