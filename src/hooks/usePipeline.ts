import { useState, useEffect, useCallback } from "react";
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
  telefone2: string | null;
  email: string | null;
  segmento_id: string | null;
  produto_id: string | null;
  empreendimento: string | null;
  stage_id: string;
  stage_changed_at: string;
  ordem_no_stage: number;
  corretor_id: string | null;
  gerente_id: string | null;
  temperatura: string;
  modo_conducao: string;
  complexidade_score: number;
  oportunidade_score: number;
  escalation_level: number;
  last_escalation_at: string | null;
  distribuido_em: string | null;
  aceito_em: string | null;
  aceite_expira_em: string | null;
  aceite_status: string | null;
  origem: string | null;
  origem_detalhe: string | null;
  jetimob_lead_id: string | null;
  observacoes: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  motivo_descarte: string | null;
  valor_estimado: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  negocio_id: string | null;
}

export interface PipelineSegmento {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export function usePipeline(pipelineTipo: string = "leads") {
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [segmentos, setSegmentos] = useState<PipelineSegmento[]>([]);
  const [corretorNomes, setCorretorNomes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadStages = useCallback(async () => {
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
    if (!user) return;

    const selectFields = "id, nome, telefone, telefone2, email, segmento_id, produto_id, empreendimento, stage_id, stage_changed_at, ordem_no_stage, corretor_id, gerente_id, temperatura, modo_conducao, complexidade_score, oportunidade_score, escalation_level, last_escalation_at, distribuido_em, aceito_em, aceite_expira_em, aceite_status, origem, origem_detalhe, observacoes, proxima_acao, data_proxima_acao, motivo_descarte, valor_estimado, created_at, updated_at, created_by, negocio_id";
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
        .eq("gerente_id", user.id);

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

    const allRows: PipelineLead[] = [];
    let from = 0;

    while (true) {
      let query = supabase
        .from("pipeline_leads")
        .select(selectFields)
        .order("updated_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (isAdmin) {
        // CEO sees all leads - no filter
      } else if (isGestor) {
        query = query.in("corretor_id", teamUserIds);
      } else {
        // Corretores: only their own ACCEPTED leads (pendente ones show on AceiteLeads page)
        query = query.eq("corretor_id", user.id).eq("aceite_status", "aceito");
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

    // Deduplicate leads by id (in case of duplicate rows)
    const seenIds = new Set<string>();
    const leadsData = allRows.filter(l => {
      if (seenIds.has(l.id)) return false;
      seenIds.add(l.id);
      return true;
    });
    setLeads(leadsData);

    // Load corretor + gerente names
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
        .select("user_id, nome")
        .in("user_id", allUserIds);
      const map: Record<string, string> = {};
      members?.forEach(m => { if (m.user_id) map[m.user_id] = m.nome; });
      // Profiles as fallback for gerentes who may not be in team_members
      profiles?.forEach(p => { if (p.user_id && !map[p.user_id]) map[p.user_id] = p.nome; });
      setCorretorNomes(map);
    }
  }, [user, isGestor, isAdmin]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([loadStages(), loadSegmentos(), loadLeads()])
      .finally(() => setLoading(false));
  }, [user, loadStages, loadSegmentos, loadLeads]);

  // Realtime subscription — debounced to avoid rapid reloads
  useEffect(() => {
    if (!user) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("pipeline-leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_leads" }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadLeads(), 1500);
      })
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, loadLeads]);

  // Auto-refresh when tab becomes visible (replaces manual cache clear)
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadLeads();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user, loadLeads]);

  const moveLead = useCallback(async (leadId: string, newStageId: string, observacao?: string) => {
    if (!user) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const oldStageId = lead.stage_id;
    if (oldStageId === newStageId) return;

    // Optimistic update
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, stage_id: newStageId, stage_changed_at: new Date().toISOString() }
        : l
    ));

    const { data: updatedRow, error } = await supabase
      .from("pipeline_leads")
      .update({
        stage_id: newStageId,
        stage_changed_at: new Date().toISOString(),
        motivo_descarte: observacao && stages.find(s => s.id === newStageId)?.tipo === "descarte" ? observacao : undefined,
      })
      .eq("id", leadId)
      .select("negocio_id")
      .single();

    if (error) {
      console.error("Error moving lead:", error);
      toast.error("Erro ao mover lead");
      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, stage_id: oldStageId } : l
      ));
      return;
    }

    // Insert history record
    await supabase.from("pipeline_historico").insert({
      pipeline_lead_id: leadId,
      stage_anterior_id: oldStageId,
      stage_novo_id: newStageId,
      movido_por: user.id,
      observacao: observacao || null,
    });

    const newStage = stages.find(s => s.id === newStageId);

    // ═══ AUTO-CREATE NEGÓCIO when moving to "Visita Realizada" ═══
    if (newStage && (newStage.tipo === "visita_realizada" || newStage.nome.toLowerCase().includes("visita realizada"))) {
      try {
        // Check if negócio already exists for this lead
        const { data: existingNegocio } = await supabase
          .from("negocios")
          .select("id")
          .eq("pipeline_lead_id", leadId)
          .limit(1)
          .maybeSingle();

        if (!existingNegocio) {
          // Resolve profiles.id from user_id for FK compatibility
          const corretorUserId = lead.corretor_id;
          const gerenteUserId = lead.gerente_id || user.id;

          const { data: profileRows } = await supabase
            .from("profiles")
            .select("id, user_id")
            .in("user_id", [corretorUserId, gerenteUserId].filter(Boolean) as string[]);

          const profileMap = new Map((profileRows || []).map(p => [p.user_id, p.id]));
          const corretorProfileId = corretorUserId ? profileMap.get(corretorUserId) || null : null;
          const gerenteProfileId = profileMap.get(gerenteUserId) || null;

          const { data: negocio, error: negError } = await supabase
            .from("negocios")
            .insert({
              nome_cliente: lead.nome,
              pipeline_lead_id: leadId,
              corretor_id: corretorProfileId,
              gerente_id: gerenteProfileId,
              empreendimento: lead.empreendimento || null,
              telefone: lead.telefone || null,
              fase: "proposta",
              origem: "visita_realizada",
              vgv_estimado: lead.valor_estimado || null,
            })
            .select("id")
            .single();

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
            console.error("Erro ao criar negócio (não bloqueia mudança de etapa):", negError);
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
        console.error("Erro ao criar negócio (não bloqueia mudança de etapa):", negocioError);
        toast.warning("Lead movido com sucesso, mas erro ao criar negócio.", { duration: 4000 });
      }
    }

    if (newStage?.tipo === "descarte") {
      toast.info("Lead movido para Descarte.");
    }

    if (newStage?.tipo === "venda") {
      toast.success("🎉 Venda registrada! Parabéns!");
    }
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
        origem: origem,
        origem_detalhe: lead.origem_detalhe || null,
        observacoes: lead.observacoes || null,
        valor_estimado: lead.valor_estimado || null,
        created_by: user.id,
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
    const { error } = await supabase
      .from("pipeline_leads")
      .update(updates as any)
      .eq("id", leadId);
    if (error) {
      console.error("Error updating lead:", error);
      toast.error("Erro ao atualizar lead");
      return;
    }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
  }, [user]);

  const deleteLead = useCallback(async (leadId: string) => {
    if (!user) return;
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
  }, [user, isAdmin]);

  const getLeadsByStage = useCallback((stageId: string) => {
    return leads.filter(l => l.stage_id === stageId);
  }, [leads]);

  return {
    stages,
    leads,
    segmentos,
    corretorNomes,
    loading,
    moveLead,
    addLead,
    updateLead,
    deleteLead,
    getLeadsByStage,
    reload: loadLeads,
  };
}
