// =============================================================================
// usePresencaAgregada — histórico agregado de presenças por corretor.
// Wrapper da RPC public.get_presenca_agregada.
// =============================================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PresencaAgregadaRow {
  corretor_id: string;
  auth_user_id: string | null;
  nome: string | null;
  avatar_url: string | null;
  gerente_nome: string | null;
  manha: number;
  tarde: number;
  diurnas: number;
  noturnas: number;
  domingos: number;
  faltas: number;
  saidas: number;
  dias_ativos: number;
  total_presencas: number;
}

export function usePresencaAgregada(params: {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;
  gestorId?: string | null;
  corretorId?: string | null;
  enabled?: boolean;
}) {
  const { dataInicio, dataFim, gestorId, corretorId, enabled = true } = params;
  return useQuery({
    queryKey: ["presenca-agregada", dataInicio, dataFim, gestorId, corretorId],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<PresencaAgregadaRow[]> => {
      const { data, error } = await supabase.rpc("get_presenca_agregada", {
        _data_inicio: dataInicio,
        _data_fim: dataFim,
        _gestor_id: gestorId ?? null,
        _corretor_id: corretorId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as PresencaAgregadaRow[];
    },
  });
}
