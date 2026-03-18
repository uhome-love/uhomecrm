/**
 * useLeadPropertyMatches — Fetches and manages auto-matched properties for a lead.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadPropertyMatch {
  id: string;
  lead_id: string;
  property_id: string;
  score: number;
  score_breakdown: Record<string, number>;
  status: string;
  notified: boolean;
  created_at: string;
  // joined from properties
  property?: {
    id: string;
    codigo: string;
    titulo: string;
    tipo: string;
    bairro: string;
    dormitorios: number;
    suites: number;
    vagas: number;
    area_privativa: number;
    valor_venda: number;
    empreendimento: string;
    fotos: string[];
    construtora: string;
  };
}

export function useLeadPropertyMatches(leadId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["lead-property-matches", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_property_matches")
        .select("*, property:properties(id, codigo, titulo, tipo, bairro, dormitorios, suites, vagas, area_privativa, valor_venda, empreendimento, fotos, construtora)")
        .eq("lead_id", leadId!)
        .order("score", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as LeadPropertyMatch[];
    },
    enabled: !!leadId,
    staleTime: 5 * 60_000,
  });

  const refreshMatches = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("lead-property-match", {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-property-matches", leadId] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ matchId, status }: { matchId: string; status: string }) => {
      const { error } = await supabase
        .from("lead_property_matches")
        .update({ status, updated_at: new Date().toISOString() } as any)
        .eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-property-matches", leadId] });
    },
  });

  return {
    matches: query.data || [],
    isLoading: query.isLoading,
    refreshMatches: refreshMatches.mutateAsync,
    isRefreshing: refreshMatches.isPending,
    updateMatchStatus: updateStatus.mutateAsync,
  };
}
