/**
 * useLeadImoveisEvents — fetches lead_imovel_events for a given lead.
 * Used in the pipeline lead modal timeline.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadImovelEvent {
  id: string;
  lead_id: string;
  corretor_id: string;
  event_type: string;
  imovel_codigo: string | null;
  vitrine_id: string | null;
  search_query: string | null;
  payload: Record<string, any>;
  created_at: string;
}

export function useLeadImoveisEvents(leadId: string | undefined) {
  return useQuery({
    queryKey: ["lead-imovel-events", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_imovel_events" as any)
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as LeadImovelEvent[];
    },
    enabled: !!leadId,
    staleTime: 30_000,
  });
}
