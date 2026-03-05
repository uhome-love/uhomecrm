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
      let query = supabase
        .from("oferta_ativa_leads")
        .select("*, oferta_ativa_listas!inner(nome)")
        .order("updated_at", { ascending: false })
        .limit(200);

      // Phone search is the primary identifier
      if (filters.telefone) {
        const normalized = normalizeTelefone(filters.telefone);
        if (normalized.length >= 4) {
          query = query.or(`telefone_normalizado.ilike.%${normalized}%,telefone.ilike.%${filters.telefone}%,telefone2.ilike.%${filters.telefone}%`);
        }
      }

      if (filters.nome) {
        query = query.ilike("nome", `%${filters.nome}%`);
      }

      if (filters.email) {
        query = query.ilike("email", `%${filters.email}%`);
      }

      if (filters.empreendimento) {
        query = query.ilike("empreendimento", `%${filters.empreendimento}%`);
      }

      if (filters.origem) {
        query = query.ilike("origem", `%${filters.origem}%`);
      }

      if (filters.status && filters.status !== "todos") {
        query = query.eq("status", filters.status);
      }

      if (filters.dataInicio) {
        query = query.gte("data_lead", filters.dataInicio);
      }
      if (filters.dataFim) {
        query = query.lte("data_lead", filters.dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map((d: any) => ({
        ...d,
        lista_nome: d.oferta_ativa_listas?.nome || "—",
      }));

      setResults(mapped);
      setTotalResults(mapped.length);
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

    // Fetch corretor names
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

    // Invalidate all OA queries
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
    fetchCorretores,
  };
}
