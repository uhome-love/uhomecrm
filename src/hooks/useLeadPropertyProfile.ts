/**
 * useLeadPropertyProfile — CRUD for the lead_property_profiles table.
 * One profile per lead (upsert on lead_id unique).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface LeadPropertyProfile {
  id: string;
  lead_id: string;
  objetivo: string[] | null;
  valor_min: number | null;
  valor_ideal: number | null;
  valor_max: number | null;
  bairros: string[] | null;
  regioes: string[] | null;
  tipos: string[] | null;
  dormitorios_min: number | null;
  suites_min: number | null;
  vagas_min: number | null;
  area_min: number | null;
  area_max: number | null;
  itens_obrigatorios: string[] | null;
  itens_desejaveis: string[] | null;
  rejeicoes: string[] | null;
  momento_compra: string | null;
  urgencia: string | null;
  aceita_financiamento: boolean | null;
  possui_imovel_troca: boolean | null;
  renda_familiar: number | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type LeadPropertyProfileInput = Omit<LeadPropertyProfile, "id" | "created_at" | "updated_at" | "created_by">;

export function useLeadPropertyProfile(leadId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["lead-property-profile", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_property_profiles")
        .select("*")
        .eq("lead_id", leadId!)
        .maybeSingle();
      if (error) throw error;
      return data as LeadPropertyProfile | null;
    },
    enabled: !!leadId,
    staleTime: 60_000,
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<LeadPropertyProfileInput>) => {
      const payload = {
        ...input,
        lead_id: leadId!,
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("lead_property_profiles")
        .upsert(payload, { onConflict: "lead_id" })
        .select()
        .single();
      if (error) throw error;
      return data as LeadPropertyProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-property-profile", leadId] });
    },
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    upsertProfile: upsert.mutateAsync,
    isSaving: upsert.isPending,
  };
}
