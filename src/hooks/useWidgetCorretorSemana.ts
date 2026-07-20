// =============================================================================
// useWidgetCorretorSemana — dados motivacionais do corretor.
// Correlaciona presenças com leads recebidos e negócios fechados.
// =============================================================================
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PeriodoWidget = "semana" | "mes";

export interface WidgetCorretor {
  periodo: PeriodoWidget;
  presencas: number;
  presencas_meta?: number;
  leads_recebidos: number;
  negocios_fechados: number;
  vgv_fechado?: number;
  dias_com_presenca?: number;
  mensagem?: string;
  correlacao?: {
    leads_por_presenca?: number;
    negocios_por_presenca?: number;
  };
  [k: string]: any;
}

/**
 * Resolve profiles.id do usuário autenticado (cache leve em memória).
 */
export function useMyProfileId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile-id", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.id ?? null;
    },
  });
}

export function useWidgetCorretorSemana(
  corretorId: string | null | undefined,
  periodo: PeriodoWidget = "semana",
) {
  return useQuery({
    queryKey: ["widget-corretor", corretorId, periodo],
    enabled: !!corretorId,
    staleTime: 60_000,
    queryFn: async (): Promise<WidgetCorretor | null> => {
      const { data, error } = await supabase.rpc("get_widget_corretor_semana", {
        _corretor_id: corretorId!,
        _periodo: periodo,
      });
      if (error) throw error;
      if (!data || (data as any).error) return null;
      return data as WidgetCorretor;
    },
  });
}
