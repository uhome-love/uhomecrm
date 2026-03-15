/**
 * useParcerias — React Query hooks for pipeline partnerships.
 *
 * - useParceriasMap(): loads the visual map (lead_id → parceiro_nome) used by Kanban badges
 * - useLeadParcerias(leadId): loads full partnership rows for a specific lead
 * - useCreateParceria(): mutation to register a new partnership
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ── Query keys ──
export const parceriaKeys = {
  all: ["parcerias"] as const,
  map: () => [...parceriaKeys.all, "map"] as const,
  lead: (leadId: string) => [...parceriaKeys.all, "lead", leadId] as const,
};

// ── 1) Global map used by Kanban board badges ──
export function useParceriasMap() {
  return useQuery({
    queryKey: parceriaKeys.map(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_pipeline_parcerias_visual")
        .select("pipeline_lead_id, parceiro_nome");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p) => {
        map[p.pipeline_lead_id] = p.parceiro_nome || "Parceiro";
      });
      return map;
    },
    staleTime: 60_000,
  });
}

// ── 2) Full partnership rows for a specific lead ──
export function useLeadParcerias(leadId: string | null) {
  return useQuery({
    queryKey: parceriaKeys.lead(leadId || ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_parcerias")
        .select("*")
        .eq("pipeline_lead_id", leadId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId,
  });
}

// ── 3) Create partnership mutation ──
interface CreateParceriaInput {
  leadId: string;
  corretorPrincipalId: string;
  corretorParceiroId: string;
  motivo?: string;
}

export function useCreateParceria() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateParceriaInput) => {
      const { error } = await supabase.from("pipeline_parcerias").insert({
        pipeline_lead_id: input.leadId,
        corretor_principal_id: input.corretorPrincipalId,
        corretor_parceiro_id: input.corretorParceiroId,
        divisao_principal: 50,
        divisao_parceiro: 50,
        motivo: input.motivo || null,
        criado_por: user?.id ?? "",
      });
      if (error) {
        if (error.code === "23505") throw new Error("duplicate");
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      toast.success("Parceria registrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: parceriaKeys.lead(variables.leadId) });
      queryClient.invalidateQueries({ queryKey: parceriaKeys.map() });
    },
    onError: (err: Error) => {
      if (err.message === "duplicate") {
        toast.error("Parceria já existe com este corretor");
      } else {
        toast.error("Erro ao criar parceria");
      }
    },
  });
}
