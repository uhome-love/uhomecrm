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
    staleTime: 120_000,
  });
}

// ── 1b) Map: corretor (any id format) → Set<lead_id> onde ele é PARCEIRO ──
// Usado pela visão CEO/Gerente para que, ao filtrar por um corretor,
// também sejam exibidos os leads em que ele participa como parceiro
// (não apenas os que ele é corretor principal). Isso alinha as contagens
// CEO ↔ visão do próprio corretor.
export function usePartnerLeadsByCorretor() {
  return useQuery({
    queryKey: [...parceriaKeys.all, "byCorretor"],
    queryFn: async () => {
      const { data: parcerias, error } = await supabase
        .from("pipeline_parcerias")
        .select("pipeline_lead_id, corretor_parceiro_id")
        .eq("status", "ativa");
      if (error) throw error;

      const parceiroIds = [...new Set((parcerias || []).map(p => p.corretor_parceiro_id).filter(Boolean))] as string[];
      const idEquivalence: Record<string, string[]> = {};
      if (parceiroIds.length > 0) {
        // Uma query só com .or() em vez de 2 round-trips.
        const inList = parceiroIds.map((id) => `"${id}"`).join(",");
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id")
          .or(`user_id.in.(${inList}),id.in.(${inList})`);
        for (const p of profiles || []) {
          const ids = [p.id, p.user_id].filter(Boolean) as string[];
          for (const id of ids) {
            idEquivalence[id] = ids;
          }
        }
      }

      const map: Record<string, Set<string>> = {};
      for (const row of parcerias || []) {
        const equivalents = idEquivalence[row.corretor_parceiro_id] || [row.corretor_parceiro_id];
        for (const id of equivalents) {
          if (!map[id]) map[id] = new Set();
          map[id].add(row.pipeline_lead_id);
        }
      }
      return map;
    },
    staleTime: 120_000,
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
