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
      absorb_team_to, lead_destination,
    } = body;

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL_2 = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const anonClient = createClient(SUPABASE_URL_2, SUPABASE_ANON_KEY!);
    const { data: { user: caller } } = await anonClient.auth.getUser(token);
    if (!caller) throw new Error("Não autorizado");
    const callerUser = caller;

    async function logAudit(acao: string, targetId: string | null, antes: any, depois: any) {
      try {
        await supabase.from("audit_log").insert({
          user_id: callerUser.id,
          modulo: "usuarios",
          acao,
          chave_unica: targetId,
          antes: antes ?? null,
          depois: depois ?? null,
          origem: "central_usuarios",
          descricao: `${acao} target=${targetId || "-"} by=${callerUser.email || callerUser.id}`,
        });
      } catch (_) { /* best-effort */ }
    }


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
      if (userId === callerUser.id) throw new Error("Você não pode executar esta ação sobre si mesmo");
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

    // Helper: descartar a carteira fria do corretor e repassar os leads avançados
    // (Em Negociação / Contrato / Ganho / com negócio) ao gerente dele.
    async function descartarCarteira(fromUserId: string, gerenteDestino: string | null) {
      const nowIso = new Date().toISOString();

      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, tipo")
        .eq("pipeline_tipo", "leads");
      const descarteStage = (stages || []).find((s: any) => s.tipo === "descarte");
      if (!descarteStage) throw new Error("Etapa de Descarte não encontrada.");
      // Etapas que SEMPRE seguem para o gerente (lead com trabalho relevante feito)
      const avancados = new Set(
        (stages || []).filter((s: any) =>
          ["proposta", "contrato_gerado", "venda", "documentacao", "visita", "pos_visita", "aquecimento"].includes(s.tipo),
        ).map((s: any) => s.id),
      );
      // Qualificação só vai ao gerente se houve toque humano nos últimos 30 dias
      const qualificacaoIds = new Set(
        (stages || []).filter((s: any) => s.tipo === "qualificacao").map((s: any) => s.id),
      );
      const intocaveis = new Set(
        (stages || []).filter((s: any) => ["descarte", "caiu"].includes(s.tipo)).map((s: any) => s.id),
      );

      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("id, stage_id, negocio_id, ultimo_toque_at")
        .eq("corretor_id", fromUserId);

      const limite30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const frios: string[] = [];
      const quentes: string[] = [];
      const friosStage: Record<string, string> = {};
      (leads || []).forEach((l: any) => {
        if (intocaveis.has(l.stage_id)) return;
        const toqueRecente = l.ultimo_toque_at && new Date(l.ultimo_toque_at).getTime() >= limite30d;
        if (l.negocio_id || avancados.has(l.stage_id) || (qualificacaoIds.has(l.stage_id) && toqueRecente)) {
          quentes.push(l.id);
        } else {
          frios.push(l.id);
          friosStage[l.id] = l.stage_id;
        }
      });

      const chunk = (arr: string[], n = 200) => {
        const out: string[][] = [];
        for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
        return out;
      };

      // 1) Leads frios → Descarte (reengajável)
      for (const part of chunk(frios)) {
        await supabase.from("pipeline_leads").update({
          stage_id: descarteStage.id,
          tipo_descarte: "reengajavel",
          motivo_descarte: "Descartado: Corretor desligado",
          motivo_descarte_code: "outro",
          stage_changed_at: nowIso,
          updated_at: nowIso,
        }).in("id", part);
      }

      // 1b) Histórico da movimentação (guarda a etapa anterior → permite rollback)
      for (const part of chunk(frios)) {
        try {
          await supabase.from("pipeline_historico").insert(
            part.map((id) => ({
              pipeline_lead_id: id,
              stage_anterior_id: friosStage[id] || null,
              stage_novo_id: descarteStage.id,
              observacao: "Descartado automaticamente: corretor desligado",
            })),
          );
        } catch (e) { console.error("Falha ao gravar histórico do descarte:", e); }
      }

      // 2) Tarefas pendentes dos leads descartados → canceladas
      let tarefasCanceladas = 0;
      for (const part of chunk(frios)) {
        const { count } = await supabase
          .from("pipeline_tarefas")
          .update({ status: "cancelada", updated_at: nowIso }, { count: "exact" })
          .in("pipeline_lead_id", part)
          .neq("status", "concluida")
          .neq("status", "cancelada");
        tarefasCanceladas += count || 0;
      }

      // 3) Leads avançados + negócios/tarefas/visitas → gerente
      if (gerenteDestino && quentes.length > 0) {
        for (const part of chunk(quentes)) {
          await supabase.from("pipeline_leads")
            .update({ corretor_id: gerenteDestino, updated_at: nowIso })
            .in("id", part);
        }
        for (const part of chunk(quentes)) {
          await supabase.from("pipeline_tarefas")
            .update({ responsavel_id: gerenteDestino, updated_at: nowIso })
            .in("pipeline_lead_id", part)
            .neq("status", "concluida");
        }
      }
      if (gerenteDestino) {
        await reassignData(fromUserId, gerenteDestino, { leads: false, negocios: true, tarefas: true });
      }

      // 4) Notificar o gerente
      if (gerenteDestino && quentes.length > 0) {
        try {
          await supabase.rpc("criar_notificacao", {
            p_user_id: gerenteDestino,
            p_tipo: "info",
            p_categoria: "sistema",
            p_titulo: "Leads recebidos por saída de corretor",
            p_mensagem: `Você recebeu ${quentes.length} lead(s) em etapa avançada e os negócios em aberto de um corretor desligado. ${frios.length} lead(s) frios foram enviados para Descarte.`,
            p_dados: { origem: "saida_corretor", leads_recebidos: quentes.length, leads_descartados: frios.length },
            p_agrupamento_key: `saida_corretor:${fromUserId}`,
          });
        } catch (e) { console.error("Falha ao notificar gerente:", e); }
      }

      return { descartados: frios.length, repassados: quentes.length, tarefas_canceladas: tarefasCanceladas };
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
      await logAudit("create_user", newUser.user.id, null, { nome, email, role: assignedRole, gerente_id: effectiveGerenteId });
      return new Response(JSON.stringify({
        success: true, user_id: newUser.user.id, team_link_error: teamLinkError, message,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── UPDATE USER ─────────────────────────────────────────────────────────
    if (action === "update_user") {
      if (!target_user_id) throw new Error("ID do usuário não informado");
      await assertCanManage(target_user_id);

      const normalizedNome = typeof nome === "string" ? nome.trim() : nome;
      const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email;
      if (normalizedNome !== undefined && (!normalizedNome || normalizedNome.length > 120)) {
        return new Response(JSON.stringify({ success: false, error: "Informe um nome válido de até 120 caracteres." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (normalizedEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return new Response(JSON.stringify({ success: false, error: "Informe um e-mail válido." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (senha !== undefined && (typeof senha !== "string" || senha.length < 8 || senha.length > 128)) {
        return new Response(JSON.stringify({ success: false, error: "A nova senha deve ter entre 8 e 128 caracteres." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const profileUpdates: Record<string, any> = {};
      if (normalizedNome !== undefined) profileUpdates.nome = normalizedNome;
      if (jetimob_user_id !== undefined) profileUpdates.jetimob_user_id = jetimob_user_id || null;
      if (normalizedEmail !== undefined) profileUpdates.email = normalizedEmail;
      if (telefone !== undefined) profileUpdates.telefone = telefone || null;
      if (cpf !== undefined) profileUpdates.cpf = cpf || null;
      if (creci !== undefined) profileUpdates.creci = creci || null;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileErr } = await supabase
          .from("profiles").update(profileUpdates).eq("user_id", target_user_id);
        if (profileErr) {
          console.error("Profile update error:", profileErr);
          return new Response(JSON.stringify({ success: false, error: `Não foi possível salvar os dados do perfil: ${profileErr.message}` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const warnings: string[] = [];
      if (normalizedEmail) {
        const { error: emailErr } = await supabase.auth.admin.updateUserById(target_user_id, { email: normalizedEmail });
        if (emailErr) {
          console.error("Email update error:", emailErr);
          warnings.push(`Os dados do perfil foram salvos, mas o e-mail de acesso não foi alterado: ${emailErr.message}`);
        }
      }
      if (senha) {
        const { error: passErr } = await supabase.auth.admin.updateUserById(target_user_id, { password: senha });
        if (passErr) {
          const rawMessage = passErr.message || "Erro desconhecido";
          const normalizedMessage = rawMessage.toLowerCase();
          const weakPassword = normalizedMessage.includes("weak") || normalizedMessage.includes("easy to guess") || normalizedMessage.includes("pwned");
          const passwordMessage = weakPassword
            ? "Essa senha é muito comum e foi recusada por segurança. Use uma senha maior, com letras, números e símbolos."
            : `A senha não foi alterada: ${rawMessage}`;
          warnings.push(`Dados salvos, mas a senha não foi alterada: ${passwordMessage}`);
        }
      }
      if (normalizedNome) {
        const { error: teamErr } = await supabase.from("team_members").update({ nome: normalizedNome }).eq("user_id", target_user_id);
        if (teamErr) {
          console.error("Team member update error:", teamErr);
          warnings.push(`O perfil foi salvo, mas o nome na equipe não foi sincronizado: ${teamErr.message}`);
        }
      }

      await logAudit("update_user", target_user_id, null, { ...profileUpdates, senha_reset: !!senha });



      return new Response(JSON.stringify({
        success: true,
        message: warnings.length > 0 ? "Usuário atualizado com ressalvas." : "Usuário atualizado com sucesso!",
        warnings,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INACTIVATE USER ─────────────────────────────────────────────────────
    if (action === "inactivate_user") {
      if (!target_user_id) throw new Error("ID do usuário não informado");
      await assertCanManage(target_user_id);
      if (target_user_id === caller.id) throw new Error("Você não pode inativar a si mesmo");

      // Check if target is a gerente (has team_members under them)
      const { count: teamCount } = await supabase
        .from("team_members").select("id", { count: "exact", head: true })
        .eq("gerente_id", target_user_id);
      if ((teamCount || 0) > 0) {
        if (!isAdmin && !isDiretora) {
          throw new Error("Apenas CEO/Diretora podem inativar um gerente");
        }
        if (!absorb_team_to) {
          throw new Error("Este usuário é gerente. Informe outro gerente para absorver o time (absorb_team_to).");
        }
        await supabase.from("team_members")
          .update({ gerente_id: absorb_team_to })
          .eq("gerente_id", target_user_id);
      }

      let descarteResumo: any = null;
      if (lead_destination === "descarte") {
        const gerenteDestino = reassign_to || (await gerenteOf(target_user_id));
        if (!gerenteDestino) {
          throw new Error("Este corretor não tem gerente definido. Informe um destino para os leads avançados e negócios.");
        }
        descarteResumo = await descartarCarteira(target_user_id, gerenteDestino);
      } else if (reassign_to) {
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

      await logAudit("inactivate_user", target_user_id, { ativo: true }, { ativo: false, reassign_to, absorb_team_to, lead_destination, descarte: descarteResumo });

      return new Response(JSON.stringify({
        success: true,
        message: descarteResumo
          ? `Usuário inativado. ${descarteResumo.descartados} lead(s) para Descarte, ${descarteResumo.repassados} lead(s) avançados ao gerente, ${descarteResumo.tarefas_canceladas} tarefa(s) cancelada(s).`
          : "Usuário inativado e dados repassados.",
      }), {
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

      await logAudit("reactivate_user", target_user_id, { ativo: false }, { ativo: true });

      return new Response(JSON.stringify({ success: true, message: "Usuário reativado com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE USER (with reassignment) ─────────────────────────────────────
    if (action === "delete_user") {
      if (!target_user_id) throw new Error("ID do usuário não informado");
      if (target_user_id === caller.id) throw new Error("Você não pode excluir a si mesmo");
      // Só CEO/Diretora podem excluir definitivamente
      if (!isAdmin && !isDiretora) {
        throw new Error("Apenas CEO/Diretora podem excluir usuários definitivamente. Use inativar.");
      }
      await assertCanManage(target_user_id);
      const modoDescarte = lead_destination === "descarte";
      const gerenteDoAlvo = modoDescarte ? (reassign_to || (await gerenteOf(target_user_id))) : null;
      if (!modoDescarte && !reassign_to) throw new Error("Informe para quem repassar os dados antes de excluir");
      if (modoDescarte && !gerenteDoAlvo) {
        throw new Error("Este corretor não tem gerente definido. Informe um destino para os leads avançados e negócios.");
      }

      // Se target é gerente, exigir absorb_team_to
      const { count: teamCount } = await supabase
        .from("team_members").select("id", { count: "exact", head: true })
        .eq("gerente_id", target_user_id);
      if ((teamCount || 0) > 0) {
        if (!absorb_team_to) {
          throw new Error("Este usuário é gerente. Informe outro gerente para absorver o time (absorb_team_to).");
        }
        await supabase.from("team_members")
          .update({ gerente_id: absorb_team_to })
          .eq("gerente_id", target_user_id);
      }

      // Validate destination is within caller's scope
      if (!isAdmin && reassign_to) {
        const destG = await gerenteOf(reassign_to);
        if (!destG || !managedGerentes.includes(destG)) {
          throw new Error("O corretor destino não pertence à sua equipe");
        }
      }

      let descarteResumo: any = null;
      if (modoDescarte) {
        descarteResumo = await descartarCarteira(target_user_id, gerenteDoAlvo!);
      } else {
        // Repassar dados operacionais ao corretor destino
        await reassignData(target_user_id, reassign_to, {
          leads: reassign_leads !== false,
          negocios: reassign_negocios !== false,
          tarefas: reassign_tarefas !== false,
        });
      }

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

      // Referências históricas ao profile (FK sem cascade) — soltar antes de apagar o perfil
      if (profileId) {
        const hist = await Promise.allSettled([
          supabase.from("oferta_ativa_fila").update({ ultimo_corretor_id: null }).eq("ultimo_corretor_id", profileId),
          supabase.from("oferta_ativa_fila").update({ locked_by: null }).eq("locked_by", profileId),
          supabase.from("oferta_ativa_fila").update({ claimed_by: null }).eq("claimed_by", profileId),
          supabase.from("roleta_distribuicoes").update({ corretor_id: null }).eq("corretor_id", profileId),
          supabase.from("roleta_fila").delete().eq("corretor_id", profileId),
          supabase.from("roleta_credenciamentos").delete().eq("aprovado_por", profileId),
          supabase.from("roleta_presencas").update({ validado_por: null }).eq("validado_por", profileId),
          supabase.from("oferta_ativa_participantes").update({ gerente_id: null }).eq("gerente_id", profileId),
        ]);
        const histErr = hist.filter((r) => r.status === "rejected");
        if (histErr.length > 0) console.error("Historical unlink failed:", histErr);
      }

      await supabase.from("user_roles").delete().eq("user_id", target_user_id);
      const { error: profileDelError } = await supabase.from("profiles").delete().eq("user_id", target_user_id);
      if (profileDelError) {
        throw new Error(
          `Não foi possível excluir o perfil (registros vinculados impedem): ${profileDelError.message}`
        );
      }

      const { error: deleteError } = await supabase.auth.admin.deleteUser(target_user_id);
      if (deleteError) throw new Error(`Erro ao excluir usuário: ${deleteError.message}`);


      await logAudit("delete_user", target_user_id, null, { reassign_to, absorb_team_to, lead_destination, descarte: descarteResumo });

      return new Response(JSON.stringify({
        success: true,
        message: descarteResumo
          ? `Usuário excluído. ${descarteResumo.descartados} lead(s) para Descarte, ${descarteResumo.repassados} lead(s) avançados ao gerente, ${descarteResumo.tarefas_canceladas} tarefa(s) cancelada(s).`
          : "Usuário excluído. Leads, negócios e tarefas foram repassados ao corretor escolhido.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SET ROLE (CEO/Diretora only) ────────────────────────────────────────
    if (action === "set_role") {
      if (!isAdmin && !isDiretora) throw new Error("Apenas CEO/Diretora podem alterar perfil de acesso");
      if (!target_user_id) throw new Error("ID do usuário não informado");
      if (target_user_id === caller.id) throw new Error("Você não pode alterar o próprio perfil");
      const validRoles = ["corretor", "gestor", "backoffice", "rh", "diretor", "admin"];
      if (!validRoles.includes(role)) throw new Error("Perfil inválido");
      if ((role === "admin" || role === "diretor") && !isAdmin) {
        throw new Error("Apenas CEO pode designar CEO ou Diretor");
      }
      // Fetch previous role for audit
      const { data: prevRoles } = await supabase.from("user_roles").select("role").eq("user_id", target_user_id);
      const prevList = (prevRoles || []).map((r: any) => r.role);

      await supabase.from("user_roles").delete().eq("user_id", target_user_id);
      await supabase.from("user_roles").insert({ user_id: target_user_id, role });

      if (role === "corretor") {
        if (!gerente_id) throw new Error("Informe o gerente para o corretor");
        const { data: profile } = await supabase.from("profiles").select("nome").eq("user_id", target_user_id).maybeSingle();
        const { data: gProfile } = await supabase.from("profiles").select("nome").eq("user_id", gerente_id).maybeSingle();
        const equipeNome = gProfile?.nome ? String(gProfile.nome).trim().split(/\s+/)[0] : null;
        const { data: existing } = await supabase.from("team_members").select("id").eq("user_id", target_user_id).maybeSingle();
        if (existing) {
          await supabase.from("team_members")
            .update({ gerente_id, equipe: equipeNome, status: "ativo" })
            .eq("id", existing.id);
        } else {
          await supabase.from("team_members").insert({
            gerente_id, nome: profile?.nome || "Corretor",
            user_id: target_user_id, equipe: equipeNome, status: "ativo",
          });
        }
      } else {
        // non-corretor roles: remove from team_members as member
        await supabase.from("team_members").delete().eq("user_id", target_user_id);
      }

      await logAudit("set_role", target_user_id, { roles: prevList }, { role, gerente_id });
      return new Response(JSON.stringify({ success: true, message: "Perfil atualizado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MOVE TO TEAM ────────────────────────────────────────────────────────
    if (action === "move_to_team") {
      if (!target_user_id) throw new Error("ID do usuário não informado");
      if (!gerente_id) throw new Error("Novo gerente não informado");
      await assertCanManage(target_user_id);
      // gerente must be valid
      const { data: gRoles } = await supabase.from("user_roles").select("role").eq("user_id", gerente_id);
      if (!(gRoles || []).some((r: any) => r.role === "gestor")) {
        throw new Error("Destino não é gerente");
      }
      // Non-admin can only move within their scope
      if (!isAdmin && !managedGerentes.includes(gerente_id)) {
        throw new Error("Você só pode mover para gerentes da sua diretoria");
      }
      const { data: gProfile } = await supabase.from("profiles").select("nome").eq("user_id", gerente_id).maybeSingle();
      const equipeNome = gProfile?.nome ? String(gProfile.nome).trim().split(/\s+/)[0] : null;
      const { data: existing } = await supabase.from("team_members").select("id").eq("user_id", target_user_id).maybeSingle();
      if (existing) {
        await supabase.from("team_members")
          .update({ gerente_id, equipe: equipeNome })
          .eq("id", existing.id);
      } else {
        const { data: prof } = await supabase.from("profiles").select("nome").eq("user_id", target_user_id).maybeSingle();
        await supabase.from("team_members").insert({
          gerente_id, user_id: target_user_id, nome: prof?.nome || "Corretor",
          equipe: equipeNome, status: "ativo",
        });
      }
      await logAudit("move_to_team", target_user_id, null, { new_gerente_id: gerente_id });
      return new Response(JSON.stringify({ success: true, message: "Corretor movido para o novo gerente." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST USERS (with last_sign_in) ──────────────────────────────────────
    if (action === "list_users") {
      // Return list of users with last_sign_in_at from auth admin
      const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const map: Record<string, string | null> = {};
      (authList?.users || []).forEach((u: any) => { map[u.id] = u.last_sign_in_at || null; });
      return new Response(JSON.stringify({ success: true, last_sign_in: map }), {
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
