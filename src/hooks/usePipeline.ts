import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export interface PipelineStage {
  id: string;
  nome: string;
  tipo: string;
  cor: string;
  ordem: number;
  pipeline_tipo: string;
}

export interface PipelineLead {
  id: string;
  nome: string;
  telefone: string | null;
  telefone2?: string | null;
  email: string | null;
  segmento_id: string | null;
  produto_id?: string | null;
  empreendimento: string | null;
  stage_id: string;
  stage_changed_at: string;
  ordem_no_stage: number;
  corretor_id: string | null;
  gerente_id: string | null;
  temperatura: string;
  modo_conducao?: string;
  complexidade_score?: number;
  oportunidade_score: number;
  escalation_level?: number;
  last_escalation_at?: string | null;
  distribuido_em?: string | null;
  aceito_em?: string | null;
  aceite_expira_em?: string | null;
  aceite_status: string | null;
  origem: string | null;
  origem_detalhe?: string | null;
  jetimob_lead_id?: string | null;
  observacoes?: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  motivo_descarte: string | null;
  valor_estimado: number | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  negocio_id: string | null;
  ultima_acao_at?: string | null;
  tags?: string[] | null;
  flag_status?: Record<string, string> | null;
  // Marketing attribution (loaded on demand)
  campanha?: string | null;
  campanha_id?: string | null;
  formulario?: string | null;
  conjunto_anuncio?: string | null;
  anuncio?: string | null;
  plataforma?: string | null;
}

export interface PipelineSegmento {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export function usePipeline(pipelineTipo: string = "leads") {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [segmentos, setSegmentos] = useState<PipelineSegmento[]>([]);
  const [corretorNomes, setCorretorNomes] = useState<Record<string, string>>({});
  const [corretorAvatars, setCorretorAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard: suppress realtime events during local mutations to prevent flicker
  const localMutationRef = useRef(false);
  // Track last visible timestamp for tab-switch debounce
  const lastVisibleRef = useRef(Date.now());
  // Guard against concurrent loadLeads calls
  const loadingLeadsRef = useRef(false);

  const loadStages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, nome, tipo, cor, ordem, pipeline_tipo, ativo")
        .eq("ativo", true)
        .order("ordem");
      if (error) {
        console.error("Error loading stages:", error);
        return;
      }
      const filtered = (data || [] as any[]).filter((s: any) => s.pipeline_tipo === pipelineTipo);
      setStages(filtered.map((s: any) => ({
        id: s.id,
        nome: s.nome,
        tipo: s.tipo,
        cor: s.cor,
        ordem: s.ordem,
        pipeline_tipo: s.pipeline_tipo || pipelineTipo,
      })));
    } catch (err) {
      console.error("[usePipeline] loadStages crash:", err);
    }
  }, [pipelineTipo]);

  const loadSegmentos = useCallback(async () => {
    const { data, error } = await supabase
      .from("pipeline_segmentos")
      .select("id, nome, cor, ordem, ativo")
      .eq("ativo", true)
      .order("ordem");
    if (error) {
      console.error("Error loading segmentos:", error);
      return;
    }
    setSegmentos((data || []).map(s => ({
      id: s.id,
      nome: s.nome,
      cor: s.cor || "#3b82f6",
      ordem: s.ordem,
    })));
  }, []);

  const loadLeads = useCallback(async () => {
    if (!userId) return;
    if (loadingLeadsRef.current) return; // prevent concurrent loads
    loadingLeadsRef.current = true;
    try {

    const selectFields = "id, nome, telefone, email, segmento_id, empreendimento, stage_id, stage_changed_at, ordem_no_stage, corretor_id, gerente_id, temperatura, oportunidade_score, aceite_status, origem, origem_detalhe, observacoes, valor_estimado, created_at, updated_at, negocio_id, ultima_acao_at, data_proxima_acao, proxima_acao, motivo_descarte, tags, campanha, formulario, plataforma, imovel_codigo, imovel_url, flag_status";
    const pageSize = 1000;

    let teamUserIds: string[] = [];

    // Role-based visibility
    if (isAdmin) {
      // CEO/Admin: vê TODOS os leads sem filtro
    } else if (isGestor) {
      // Gerentes: leads do time
      const { data: teamMembers, error: teamError } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("gerente_id", userId);

      if (teamError) {
        console.error("Error loading team members:", teamError);
        return;
      }

      teamUserIds = (teamMembers || [])
        .map((m) => m.user_id)
        .filter(Boolean) as string[];

      if (teamUserIds.length === 0) {
        setLeads([]);
        return;
      }
    }

    // Load partnership lead IDs for corretores via canonical view
    let partnerLeadIds: string[] = [];
    if (!isAdmin && !isGestor) {
      const { data: partnerships } = await supabase
        .from("v_user_partner_leads")
        .select("pipeline_lead_id");
      partnerLeadIds = (partnerships || []).map((p: any) => p.pipeline_lead_id).filter(Boolean);
    }

    const allRows: PipelineLead[] = [];
    let from = 0;

    while (true) {
      let query = supabase
        .from("pipeline_leads")
        .select(selectFields)
        .eq("arquivado", false)
        .order("updated_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (isAdmin) {
        // CEO sees all leads - no filter
      } else if (isGestor) {
        query = query.in("corretor_id", teamUserIds);
      } else {
        // Corretores: own leads that are accepted, pendente, or aguardando_aceite (avoid invisible leads)
        query = query.eq("corretor_id", userId).in("aceite_status", ["aceito", "pendente", "aguardando_aceite"]);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading pipeline leads:", error);
        return;
      }

      const batch = ((data || []) as PipelineLead[]);
      allRows.push(...batch);

      if (batch.length < pageSize) break;
      from += pageSize;
    }

    // For corretores: also fetch partner leads that may belong to other corretores
    if (!isAdmin && !isGestor && partnerLeadIds.length > 0) {
      const existingIds = new Set(allRows.map(l => l.id));
      const missingIds = partnerLeadIds.filter(id => !existingIds.has(id));
      if (missingIds.length > 0) {
        const { data: partnerLeads } = await supabase
          .from("pipeline_leads")
          .select(selectFields)
          .in("id", missingIds);
        if (partnerLeads) allRows.push(...(partnerLeads as PipelineLead[]));
      }
    }

    // Deduplicate leads by id (in case of duplicate rows)
    const seenIds = new Set<string>();
    const leadsData = allRows.filter(l => {
      if (seenIds.has(l.id)) return false;
      seenIds.add(l.id);
      return true;
    });
    setLeads(leadsData);

    // Load corretor + gerente names (skip for corretores — they only see their own leads)
    if ((isGestor || isAdmin) && allRows.length > 0) {
      const allUserIds = [...new Set([
        ...leadsData.map(l => l.corretor_id).filter(Boolean),
        ...leadsData.map(l => l.gerente_id).filter(Boolean),
      ])] as string[];
      if (allUserIds.length > 0) {
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id, nome")
          .in("user_id", allUserIds);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome, avatar_url, avatar_gamificado_url")
          .in("user_id", allUserIds);
        const map: Record<string, string> = {};
        const avatarMap: Record<string, string> = {};
        members?.forEach(m => { if (m.user_id) map[m.user_id] = m.nome; });
        profiles?.forEach(p => {
          if (p.user_id && !map[p.user_id]) map[p.user_id] = p.nome;
          if (p.user_id) {
            const url = (p as any).avatar_gamificado_url || p.avatar_url;
            if (url) avatarMap[p.user_id] = url;
          }
        });
        setCorretorNomes(map);
        setCorretorAvatars(avatarMap);
      }
    }

    } catch (err) {
      console.error("[usePipeline] loadLeads crash:", err);
      toast.error("Erro ao carregar leads. Tente recarregar a página.");
    } finally {
      loadingLeadsRef.current = false;
    }
  }, [userId, isGestor, isAdmin]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    // Wait for role resolution before loading leads to avoid double-fetch
    if (roleLoading) return;

    setError(null);
    setLoading(prev => (stages.length === 0 && leads.length === 0 && segmentos.length === 0 ? true : prev));

    // Timeout guard: if load takes > 30s, stop and show error
    const timeout = setTimeout(() => {
      setLoading(false);
      setError("O carregamento demorou demais. Tente recarregar.");
    }, 30_000);

    Promise.all([loadStages(), loadSegmentos(), loadLeads()])
      .catch((err) => {
        console.error("[usePipeline] Init error:", err);
        setError(err?.message || "Erro ao carregar pipeline");
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => clearTimeout(timeout);
  }, [userId, roleLoading, loadStages, loadSegmentos, loadLeads]);

  // ─── Granular realtime: update only the changed lead in local state ───
  useEffect(() => {
    if (!userId) return;
    let batchTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingEvents: Array<{ eventType: string; new_record: any; old_record: any }> = [];

    const flushBatch = () => {
      batchTimer = null;
      if (pendingEvents.length === 0) return;
      const events = [...pendingEvents];
      pendingEvents.length = 0;

      setLeads(prev => {
        let next = [...prev];
        for (const evt of events) {
          if (evt.eventType === "DELETE") {
            const oldId = evt.old_record?.id;
            if (oldId) next = next.filter(l => l.id !== oldId);
          } else if (evt.eventType === "INSERT") {
            const row = evt.new_record as PipelineLead;
            if (row?.id && !next.some(l => l.id === row.id)) {
              next = [row, ...next];
            }
          } else if (evt.eventType === "UPDATE") {
            const row = evt.new_record as PipelineLead;
            if (!row?.id) continue;
            const idx = next.findIndex(l => l.id === row.id);
            if (idx >= 0) {
              // Merge: keep local fields not in payload, update the rest
              next[idx] = { ...next[idx], ...row };
            } else {
              // Lead appeared (e.g. reassigned to this user's team)
              next = [row, ...next];
            }
          }
        }
        return next;
      });
    };

    const channel = supabase
      .channel("pipeline-leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_leads" }, (payload) => {
        // Skip if we are in the middle of a local mutation (drag, modal edit, etc.)
        if (localMutationRef.current) return;

        pendingEvents.push({
          eventType: payload.eventType,
          new_record: payload.new,
          old_record: payload.old,
        });
        // Batch events arriving within 500ms window
        if (batchTimer) clearTimeout(batchTimer);
        batchTimer = setTimeout(flushBatch, 500);
      })
      .subscribe();

    return () => {
      if (batchTimer) clearTimeout(batchTimer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Ao voltar para a aba, mantemos o estado atual e evitamos reload automático do board.
  useEffect(() => {
    if (!userId) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        lastVisibleRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [userId]);

  const moveLead = useCallback(async (leadId: string, newStageId: string, observacao?: string) => {
    if (!user) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const oldStageId = lead.stage_id;
    const oldStageChangedAt = lead.stage_changed_at;
    if (oldStageId === newStageId) return;

    localMutationRef.current = true;

    // ─── Optimistic update (immediate UI response) ───
    const now = new Date().toISOString();
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, stage_id: newStageId, stage_changed_at: now }
        : l
    ));

    // ─── Persist to backend ───
    const updatePayload: Record<string, any> = {
      stage_id: newStageId,
      stage_changed_at: now,
      ultima_acao_at: now,
    };
    if (observacao && stages.find(s => s.id === newStageId)?.tipo === "descarte") {
      updatePayload.motivo_descarte = observacao;
    }

    const { error: stageError } = await supabase
      .from("pipeline_leads")
      .update(updatePayload)
      .eq("id", leadId);

    if (stageError) {
      console.error("Error moving lead (stage update):", stageError, { leadId, newStageId, userId: user.id });
      toast.error("Erro ao mover lead. Revertendo posição.", { duration: 3000 });
      // ─── Rollback: restore previous position ───
      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, stage_id: oldStageId, stage_changed_at: oldStageChangedAt } : l
      ));
      setTimeout(() => { localMutationRef.current = false; }, 500);
      return;
    }

    // Read current negocio_id for later use (non-blocking)
    const { data: currentLead } = await supabase
      .from("pipeline_leads")
      .select("negocio_id")
      .eq("id", leadId)
      .maybeSingle();
    const updatedRow = currentLead;

    // Insert history record
    await supabase.from("pipeline_historico").insert({
      pipeline_lead_id: leadId,
      stage_anterior_id: oldStageId,
      stage_novo_id: newStageId,
      movido_por: user.id,
      observacao: observacao || null,
    });

    const newStage = stages.find(s => s.id === newStageId);

    // ═══ AUTO-CREATE NEGÓCIO when moving to "Negócio Criado" (convertido) ═══
    const isConvertido = newStage && (newStage.tipo === "convertido" || newStage.nome.toLowerCase().includes("negócio criado"));
    console.log("[moveLead] Stage check:", { newStageTipo: newStage?.tipo, newStageNome: newStage?.nome, isConvertido });

    if (isConvertido) {
      try {
        // Check if negócio already exists for this lead
        const { data: existingNegocio, error: checkError } = await supabase
          .from("negocios")
          .select("id")
          .eq("pipeline_lead_id", leadId)
          .limit(1)
          .maybeSingle();

        console.log("[moveLead] Existing negocio check:", { existingNegocio, checkError });

        if (!existingNegocio) {
          // Resolve profiles.id from user_id for FK compatibility
          const corretorUserId = lead.corretor_id;
          const gerenteUserId = lead.gerente_id || user.id;

          const { data: profileRows, error: profileError } = await supabase
            .from("profiles")
            .select("id, user_id")
            .in("user_id", [corretorUserId, gerenteUserId].filter(Boolean) as string[]);

          console.log("[moveLead] Profile resolution:", { corretorUserId, gerenteUserId, profileRows, profileError });

          const profileMap = new Map((profileRows || []).map(p => [p.user_id, p.id]));
          const corretorProfileId = corretorUserId ? profileMap.get(corretorUserId) || null : null;
          const gerenteProfileId = profileMap.get(gerenteUserId) || null;

          const insertPayload = {
            nome_cliente: lead.nome,
            pipeline_lead_id: leadId,
            corretor_id: corretorProfileId,
            gerente_id: gerenteProfileId,
            empreendimento: lead.empreendimento || null,
            telefone: lead.telefone || null,
            fase: "novo_negocio",
            origem: "pipeline_convertido",
            vgv_estimado: lead.valor_estimado || null,
          };
          console.log("[moveLead] Inserting negocio:", insertPayload);

          const { data: negocio, error: negError } = await supabase
            .from("negocios")
            .insert(insertPayload)
            .select("id")
            .single();

          console.log("[moveLead] Negocio insert result:", { negocio, negError });

          if (negocio && !negError) {
            await supabase.from("pipeline_leads").update({
              negocio_id: negocio.id,
            } as any).eq("id", leadId);

            setLeads(prev => prev.map(l =>
              l.id === leadId ? { ...l, negocio_id: negocio.id } : l
            ));

            toast.success(`🎉 Negócio criado para ${lead.nome}!`, {
              description: "🎯 Envie a proposta em até 24h!",
              duration: 5000,
            });
          } else if (negError) {
            console.error("[moveLead] Erro ao criar negócio:", negError);
            toast.warning("Lead movido, mas houve erro ao criar negócio automaticamente.", { duration: 4000 });
          }
        } else {
          // Already has negócio, just link it
          if (!updatedRow?.negocio_id) {
            await supabase.from("pipeline_leads").update({
              negocio_id: existingNegocio.id,
            } as any).eq("id", leadId);
          }
        }
      } catch (negocioError) {
        console.error("[moveLead] Catch - Erro ao criar negócio:", negocioError);
        toast.warning("Lead movido com sucesso, mas erro ao criar negócio.", { duration: 4000 });
      }
    }

    if (newStage?.tipo === "descarte") {
      toast.info("Lead movido para Descarte.");
    }

    if (newStage?.tipo === "venda") {
      toast.success("🎉 Venda registrada! Parabéns!");
    }

    setTimeout(() => { localMutationRef.current = false; }, 2000);
  }, [user, leads, stages]);

  const addLead = useCallback(async (lead: Partial<PipelineLead>) => {
    if (!user) return null;
    // Get first stage (novo_lead)
    const firstStage = stages.find(s => s.tipo === "novo_lead");
    if (!firstStage) { toast.error("Estágio inicial não configurado"); return null; }

    // Auto-extract campaign from TikTok origem
    let empreendimento = lead.empreendimento || null;
    const origem = lead.origem || null;
    if (!empreendimento && origem) {
      const tikTokMatch = origem.match(/tik\s*tok(?:\s*ads)?\s*:\s*(.+)/i);
      if (tikTokMatch) {
        empreendimento = tikTokMatch[1].trim();
      }
    }

    // If corretor is adding, auto-assign to themselves and mark as accepted
    const isCorretorAdding = !isGestor && !isAdmin;
    const corretorId = isCorretorAdding ? user.id : (lead.corretor_id || null);

    const { data, error } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: lead.nome || "Novo Lead",
        telefone: lead.telefone || null,
        email: lead.email || null,
        segmento_id: lead.segmento_id || null,
        produto_id: lead.produto_id || null,
        empreendimento,
        stage_id: firstStage.id,
        corretor_id: corretorId,
        aceite_status: isCorretorAdding ? "aceito" : undefined,
        aceito_em: isCorretorAdding ? new Date().toISOString() : undefined,
        origem: origem || "Manual",
        origem_detalhe: lead.origem_detalhe || null,
        observacoes: lead.observacoes || null,
        valor_estimado: lead.valor_estimado || null,
        created_by: user.id,
        modulo_atual: "pipeline",
        temperatura: "morno",
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding lead:", error);
      toast.error("Erro ao adicionar lead: " + (error.message || error.code || "Erro desconhecido"));
      return null;
    }

    toast.success("Lead adicionado ao pipeline! ✅");
    await loadLeads();
    return data;
  }, [user, stages, loadLeads, isGestor, isAdmin]);

  const updateLead = useCallback(async (leadId: string, updates: Partial<PipelineLead>) => {
    if (!user) return;
    localMutationRef.current = true;
    // Always update ultima_acao_at when any action is taken
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("pipeline_leads")
      .update(payload as any)
      .eq("id", leadId);
    if (error) {
      console.error("Error updating lead:", error);
      toast.error("Erro ao atualizar lead");
      return;
    }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
    setTimeout(() => { localMutationRef.current = false; }, 2000);
  }, [user]);

  const deleteLead = useCallback(async (leadId: string) => {
    if (!user) return;
    localMutationRef.current = true;
    if (!isAdmin) {
      toast.error("Apenas o CEO pode excluir leads.");
      return;
    }
    const { error } = await supabase
      .from("pipeline_leads")
      .delete()
      .eq("id", leadId);
    if (error) {
      console.error("Error deleting lead:", error);
      toast.error("Erro ao apagar lead");
      return;
    }
    setLeads(prev => prev.filter(l => l.id !== leadId));
    toast.success("Lead removido do pipeline");
    setTimeout(() => { localMutationRef.current = false; }, 2000);
  }, [user, isAdmin]);

  const getLeadsByStage = useCallback((stageId: string) => {
    return leads.filter(l => l.stage_id === stageId);
  }, [leads]);

  return {
    stages,
    leads,
    segmentos,
    corretorNomes,
    corretorAvatars,
    loading,
    error,
    moveLead,
    addLead,
    updateLead,
    deleteLead,
    getLeadsByStage,
    reload: useCallback(async () => {
      setError(null);
      await Promise.all([loadStages(), loadSegmentos(), loadLeads()]);
    }, [loadStages, loadSegmentos, loadLeads]),
  };
}
