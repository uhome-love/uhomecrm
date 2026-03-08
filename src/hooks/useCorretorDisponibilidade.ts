import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type DisponibilidadeStatus = "offline" | "na_empresa" | "em_pausa" | "em_visita";

export const SEGMENTOS_OFICIAIS = [
  { nome: "MCMV / até R$500k", badge: "S1 · MCMV", cor: "#16A34A", empreendimentos: ["Open Bosque"] },
  { nome: "Médio-Alto Padrão", badge: "S2 · Médio-Alto", cor: "#2563EB", empreendimentos: ["Orygem", "Las Casas", "Casa Tua"] },
  { nome: "Altíssimo Padrão", badge: "S3 · Alto Padrão", cor: "#7C3AED", empreendimentos: ["Lake Eyre"] },
  { nome: "Investimento", badge: "S4 · Investimento", cor: "#B45309", empreendimentos: ["Casa Bastian", "Shift"] },
] as const;

export type SegmentoOficial = (typeof SEGMENTOS_OFICIAIS)[number]["nome"];

export interface Disponibilidade {
  id: string;
  user_id: string;
  status: DisponibilidadeStatus;
  segmentos: string[];
  na_roleta: boolean;
  entrada_em: string | null;
  saida_em: string | null;
  leads_recebidos_turno: number;
  updated_at: string;
}

export function useCorretorDisponibilidade() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["corretor-disponibilidade", user?.id];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corretor_disponibilidade")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Disponibilidade | null;
    },
    enabled: !!user,
    staleTime: 10_000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<Disponibilidade>) => {
      if (!user) throw new Error("Not authenticated");

      const existing = data;
      if (existing) {
        const { error } = await supabase
          .from("corretor_disponibilidade")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("corretor_disponibilidade")
          .insert({ user_id: user.id, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const setStatus = useCallback(
    async (status: DisponibilidadeStatus, segmentos?: string[]) => {
      const isActive = status === "na_empresa";
      const updates: Partial<Disponibilidade> = {
        status,
        na_roleta: isActive && (segmentos || data?.segmentos || []).length > 0,
        ...(isActive
          ? { entrada_em: new Date().toISOString(), saida_em: null }
          : { saida_em: new Date().toISOString(), na_roleta: false }),
        ...(segmentos !== undefined ? { segmentos } : {}),
      };

      // Reset leads count when entering
      if (isActive) {
        updates.leads_recebidos_turno = 0;
      }

      await upsertMutation.mutateAsync(updates);
    },
    [data, upsertMutation]
  );

  const setSegmentos = useCallback(
    async (segmentos: string[]) => {
      if (segmentos.length > 2) {
        toast.error("Você pode selecionar no máximo 2 segmentos.");
        return;
      }
      const na_roleta = data?.status === "na_empresa" && segmentos.length > 0;
      await upsertMutation.mutateAsync({ segmentos, na_roleta });
    },
    [data, upsertMutation]
  );

  return {
    disponibilidade: data,
    loading: isLoading,
    setStatus,
    setSegmentos,
    saving: upsertMutation.isPending,
  };
}

// Hook for managers to see all corretors' availability
export function useDisponibilidadeGerencial() {
  const { data, isLoading } = useQuery({
    queryKey: ["disponibilidade-gerencial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corretor_disponibilidade")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Disponibilidade[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return { corretores: data || [], loading: isLoading };
}
