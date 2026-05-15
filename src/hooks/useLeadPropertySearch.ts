/**
 * useLeadPropertySearch — saves search history and property interactions
 * for a specific lead, using lead_property_searches and lead_property_interactions.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface LeadPropertySearchRecord {
  id: string;
  lead_id: string;
  corretor_id: string;
  query_text: string | null;
  filters: Record<string, any> | null;
  sort_by: string | null;
  result_codes: string[] | null;
  total_results: number | null;
  created_at: string | null;
}

export interface LeadPropertyInteraction {
  id: string;
  lead_id: string;
  corretor_id: string;
  property_code: string;
  acao: string; // 'favorito' | 'enviado' | 'descartado' | 'visualizado'
  canal_envio: string | null;
  feedback_lead: string | null;
  motivo_descarte: string | null;
  notas: string | null;
  created_at: string | null;
}

export function useLeadPropertySearch(leadId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Search history
  const searchHistory = useQuery({
    queryKey: ["lead-property-searches", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_property_searches")
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as LeadPropertySearchRecord[];
    },
    enabled: !!leadId,
    staleTime: 30_000,
  });

  // Interactions
  const interactions = useQuery({
    queryKey: ["lead-property-interactions", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_property_interactions")
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as LeadPropertyInteraction[];
    },
    enabled: !!leadId,
    staleTime: 30_000,
  });

  const saveSearch = useMutation({
    mutationFn: async (input: {
      query_text?: string;
      filters?: Record<string, any>;
      sort_by?: string;
      result_codes?: string[];
      total_results?: number;
    }) => {
      const { error } = await supabase.from("lead_property_searches").insert({
        lead_id: leadId!,
        corretor_id: user!.id,
        query_text: input.query_text || null,
        filters: input.filters || null,
        sort_by: input.sort_by || null,
        result_codes: input.result_codes || null,
        total_results: input.total_results || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-property-searches", leadId] });
    },
  });

  const trackInteraction = useMutation({
    mutationFn: async (input: {
      property_code: string;
      acao: string;
      canal_envio?: string;
      feedback_lead?: string;
      motivo_descarte?: string;
      notas?: string;
    }) => {
      const { error } = await supabase.from("lead_property_interactions").insert({
        lead_id: leadId!,
        corretor_id: user!.id,
        property_code: input.property_code,
        acao: input.acao,
        canal_envio: input.canal_envio || null,
        feedback_lead: input.feedback_lead || null,
        motivo_descarte: input.motivo_descarte || null,
        notas: input.notas || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-property-interactions", leadId] });
    },
  });

  // Derived sets for quick lookup
  const favoriteCodes = new Set(
    (interactions.data || []).filter(i => i.acao === "favorito").map(i => i.property_code)
  );
  const sentCodes = new Set(
    (interactions.data || []).filter(i => i.acao === "enviado").map(i => i.property_code)
  );
  const discardedCodes = new Set(
    (interactions.data || []).filter(i => i.acao === "descartado").map(i => i.property_code)
  );

  return {
    searchHistory: searchHistory.data || [],
    interactions: interactions.data || [],
    favoriteCodes,
    sentCodes,
    discardedCodes,
    saveSearch: saveSearch.mutateAsync,
    trackInteraction: trackInteraction.mutateAsync,
    isLoadingHistory: searchHistory.isLoading,
    isLoadingInteractions: interactions.isLoading,
  };
}
