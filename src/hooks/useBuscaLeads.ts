import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { normalizeTelefone } from "@/hooks/useOfertaAtiva";

export interface BuscaFilters {
  telefone?: string;
  nome?: string;
  email?: string;
  empreendimento?: string;
  origem?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export type BuscaSource = "oferta_ativa" | "pipeline";

export interface BuscaLead {
  id: string;
  nome: string;
  telefone: string | null;
  telefone2: string | null;
  email: string | null;
  telefone_normalizado: string | null;
  empreendimento: string | null;
  campanha: string | null;
  origem: string | null;
  data_lead: string | null;
  status: string;
  motivo_descarte: string | null;
  corretor_id: string | null;
  lista_id: string;
  em_atendimento_por: string | null;
  em_atendimento_ate: string | null;
  tentativas_count: number;
  ultima_tentativa: string | null;
  cadastrado_jetimob: boolean;
  created_at: string;
  updated_at: string;
  observacoes: string | null;
  // joined
  lista_nome?: string;
  // origem da busca (qual tabela)
  source: BuscaSource;
  // pipeline-specific
  stage_id?: string | null;
  stage_nome?: string | null;
  corretor_nome?: string | null;
}

export interface LeadTentativa {
  id: string;
  corretor_id: string;
  canal: string;
  resultado: string;
  feedback: string;
  pontos: number;
  created_at: string;
  corretor_nome?: string;
}

export function useBuscaLeads() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [results, setResults] = useState<BuscaLead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  const buscar = useCallback(async (filters: BuscaFilters) => {
    if (!user) return;
    setIsSearching(true);
    try {
      // ───────────────────────────────────────────────
      // 1) Busca em Oferta Ativa
      // ───────────────────────────────────────────────
      let oaQuery = supabase
        .from("oferta_ativa_leads")
        .select("*, oferta_ativa_listas!inner(nome)")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (filters.telefone) {
        const normalized = normalizeTelefone(filters.telefone);
        if (normalized.length >= 4) {
          oaQuery = oaQuery.or(`telefone_normalizado.ilike.%${normalized}%,telefone.ilike.%${filters.telefone}%,telefone2.ilike.%${filters.telefone}%`);
        }
      }
      if (filters.nome) oaQuery = oaQuery.ilike("nome", `%${filters.nome}%`);
      if (filters.email) oaQuery = oaQuery.ilike("email", `%${filters.email}%`);
      if (filters.empreendimento) oaQuery = oaQuery.ilike("empreendimento", `%${filters.empreendimento}%`);
      if (filters.origem) oaQuery = oaQuery.ilike("origem", `%${filters.origem}%`);
      if (filters.status && filters.status !== "todos" && filters.status !== "pipeline") {
        oaQuery = oaQuery.eq("status", filters.status);
      }
      if (filters.dataInicio) oaQuery = oaQuery.gte("data_lead", filters.dataInicio);
      if (filters.dataFim) oaQuery = oaQuery.lte("data_lead", filters.dataFim);

      // ───────────────────────────────────────────────
      // 2) Busca em Pipeline de Leads
      // ───────────────────────────────────────────────
      let plQuery = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, email, empreendimento, origem, stage_id, corretor_id, created_at, updated_at, observacoes, arquivado")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (filters.telefone) {
        const normalized = normalizeTelefone(filters.telefone);
        if (normalized.length >= 4) {
          plQuery = plQuery.or(`telefone.ilike.%${normalized}%,telefone.ilike.%${filters.telefone}%`);
        }
      }
      if (filters.nome) plQuery = plQuery.ilike("nome", `%${filters.nome}%`);
      if (filters.email) plQuery = plQuery.ilike("email", `%${filters.email}%`);
      if (filters.empreendimento) plQuery = plQuery.ilike("empreendimento", `%${filters.empreendimento}%`);
      if (filters.origem) plQuery = plQuery.ilike("origem", `%${filters.origem}%`);
      if (filters.dataInicio) plQuery = plQuery.gte("created_at", filters.dataInicio);
      if (filters.dataFim) plQuery = plQuery.lte("created_at", filters.dataFim);

      // Skip OA if filtering only pipeline
      const skipOA = filters.status === "pipeline";
      const skipPL = filters.status && filters.status !== "todos" && filters.status !== "pipeline";

      const [oaRes, plRes] = await Promise.all([
        skipOA ? Promise.resolve({ data: [], error: null }) : oaQuery,
        skipPL ? Promise.resolve({ data: [], error: null }) : plQuery,
      ]);

      if (oaRes.error) throw oaRes.error;
      if (plRes.error) throw plRes.error;

      const oaData = (oaRes.data || []) as any[];
      const plData = (plRes.data || []) as any[];

      // Resolve stages and corretores for pipeline rows
      const stageIds = [...new Set(plData.map(p => p.stage_id).filter(Boolean))];
      const corretorIds = [...new Set(plData.map(p => p.corretor_id).filter(Boolean))];

      const [stagesRes, profilesRes] = await Promise.all([
        stageIds.length
          ? supabase.from("pipeline_stages").select("id, nome").in("id", stageIds)
          : Promise.resolve({ data: [] as any[] }),
        corretorIds.length
          ? supabase.from("profiles").select("user_id, nome").in("user_id", corretorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const stageMap: Record<string, string> = {};
      (stagesRes.data || []).forEach((s: any) => { stageMap[s.id] = s.nome; });
      const corretorMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => { corretorMap[p.user_id] = p.nome; });

      // Map OA results
      const oaMapped: BuscaLead[] = oaData.map((d: any) => ({
        ...d,
        lista_nome: d.oferta_ativa_listas?.nome || "—",
        source: "oferta_ativa" as BuscaSource,
      }));

      // Map Pipeline results
      const plMapped: BuscaLead[] = plData.map((d: any) => ({
        id: d.id,
        nome: d.nome,
        telefone: d.telefone,
        telefone2: null,
        email: d.email,
        telefone_normalizado: null,
        empreendimento: d.empreendimento,
        campanha: null,
        origem: d.origem,
        data_lead: d.created_at,
        status: d.arquivado ? "arquivado" : "no_pipeline",
        motivo_descarte: null,
        corretor_id: d.corretor_id,
        lista_id: "",
        em_atendimento_por: null,
        em_atendimento_ate: null,
        tentativas_count: 0,
        ultima_tentativa: null,
        cadastrado_jetimob: false,
        created_at: d.created_at,
        updated_at: d.updated_at,
        observacoes: d.observacoes,
        lista_nome: "Pipeline CRM",
        source: "pipeline" as BuscaSource,
        stage_id: d.stage_id,
        stage_nome: d.stage_id ? stageMap[d.stage_id] || "—" : "—",
        corretor_nome: d.corretor_id ? corretorMap[d.corretor_id] || "Sem corretor" : "Sem corretor",
      }));

      // Combine and sort by updated_at desc
      const combined = [...oaMapped, ...plMapped].sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setResults(combined);
      setTotalResults(combined.length);
    } catch (err) {
      console.error("Busca error:", err);
      toast.error("Erro ao buscar leads");
    } finally {
      setIsSearching(false);
    }
  }, [user]);

  const fetchTentativas = useCallback(async (leadId: string): Promise<LeadTentativa[]> => {
    const { data, error } = await supabase
      .from("oferta_ativa_tentativas")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }

    const corretorIds = [...new Set((data || []).map(t => t.corretor_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome")
      .in("user_id", corretorIds);

    const nameMap: Record<string, string> = {};
    (profiles || []).forEach(p => { nameMap[p.user_id] = p.nome; });

    return (data || []).map(t => ({
      ...t,
      corretor_nome: nameMap[t.corretor_id] || t.corretor_id.slice(0, 8),
    }));
  }, []);

  const executarAcao = useCallback(async (
    leadId: string,
    acao: string,
    corretorId?: string | null,
    motivo?: string
  ) => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("higienizar_lead", {
      p_lead_id: leadId,
      p_acao: acao,
      p_corretor_id: corretorId || null,
      p_motivo: motivo || null,
      p_admin_id: user.id,
    });

    if (error) {
      console.error("Ação error:", error);
      toast.error("Erro ao executar ação");
      return false;
    }

    const result = data as any;
    if (!result?.success) {
      toast.error(result?.reason || "Erro desconhecido");
      return false;
    }

    queryClient.invalidateQueries({ queryKey: ["oa-fila"] });
    queryClient.invalidateQueries({ queryKey: ["oa-leads"] });
    queryClient.invalidateQueries({ queryKey: ["oa-stats"] });
    queryClient.invalidateQueries({ queryKey: ["oa-ranking"] });
    queryClient.invalidateQueries({ queryKey: ["oa-aproveitados"] });

    const msgs: Record<string, string> = {
      aproveitado: "✅ Lead marcado como aproveitado!",
      descartado: "🗑️ Lead removido da lista",
      transferir: "🔄 Lead transferido com sucesso",
      bloquear: "🔒 Lead bloqueado para Oferta Ativa",
      desbloquear: "🔓 Lead desbloqueado",
      quebrar_reserva: "⚡ Reserva quebrada com sucesso",
    };
    toast.success(msgs[acao] || "Ação executada");
    return true;
  }, [user, queryClient]);

  // Repassar lead já existente no pipeline para outro corretor
  const repassarPipelineLead = useCallback(async (
    leadId: string,
    novoCorretorId: string,
    motivo?: string
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, tipo")
        .eq("pipeline_tipo", "leads")
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      const novoLeadStage = stages?.find(s => s.tipo === "novo_lead");

      const updates: Record<string, any> = {
        corretor_id: novoCorretorId,
        aceite_status: "aceito",
        aceito_em: new Date().toISOString(),
        aceite_expira_em: null,
        arquivado: false,
        updated_at: new Date().toISOString(),
      };
      if (novoLeadStage) {
        updates.stage_id = novoLeadStage.id;
        updates.stage_changed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("pipeline_leads")
        .update(updates)
        .eq("id", leadId);

      if (error) {
        console.error("Repasse error:", error);
        toast.error("Erro ao repassar lead");
        return false;
      }

      // Log no histórico e anotações
      await Promise.all([
        supabase.from("pipeline_historico").insert({
          pipeline_lead_id: leadId,
          stage_anterior_id: null,
          stage_novo_id: novoLeadStage?.id || stages?.[0]?.id,
          movido_por: user.id,
          observacao: `Lead repassado via Busca${motivo ? ` — motivo: ${motivo}` : ""}`,
        }),
        supabase.from("pipeline_anotacoes").insert({
          pipeline_lead_id: leadId,
          conteudo: `🔄 Lead repassado via Busca${motivo ? ` — Motivo: ${motivo}` : ""}`,
          autor_id: user.id,
          autor_nome: "Sistema",
        }),
      ]);

      toast.success("Lead repassado com sucesso");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Erro ao repassar lead");
      return false;
    }
  }, [user]);

  const fetchCorretores = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, nome, cargo")
      .order("nome");
    return (data || []).filter(p => p.user_id);
  }, []);

  return {
    results,
    isSearching,
    totalResults,
    buscar,
    fetchTentativas,
    executarAcao,
    repassarPipelineLead,
    fetchCorretores,
  };
}
