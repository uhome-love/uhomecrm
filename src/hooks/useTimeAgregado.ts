/**
 * useTimeAgregado — agregado 1 linha por corretor do time do gestor.
 *
 * Backed pela RPC `get_time_agregado(p_gestor_id uuid)` (SECURITY DEFINER,
 * acesso restrito ao próprio gestor ou admin).
 *
 * Métricas por corretor:
 *  - total_leads / sem_tarefa / atrasados / em_dia / para_hoje
 *  - sem_contato_5d (usado pelos alertas do Modo Time)
 *  - negocios + vgv_pipeline (COALESCE(vgv_final, vgv_estimado))
 *  - conversao_pct (assinados últimos 90d / leads recebidos últimos 90d)
 *  - alerta_principal: texto pronto (atrasados ≥5 > sem_contato_5d ≥5 > sem_tarefa ≥10)
 *
 * Dívida conhecida (Fase 2.1): `segmento_principal` retorna NULL —
 * `profiles` não tem campo de segmento e inferir via `roleta_credenciamentos`
 * varia por dia/janela. Será tratado em fase futura se necessário.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TimeAgregadoRow {
  corretor_id: string;
  nome: string;
  avatar_url: string | null;
  segmento_principal: string | null;
  total_leads: number;
  total_recebidos: number;
  sem_tarefa: number;
  atrasados: number;
  em_dia: number;
  para_hoje: number;
  sem_contato_5d: number;
  negocios: number;
  vgv_pipeline: number;
  conversao_pct: number | null;
  alerta_principal: string | null;
}

export function useTimeAgregado(gestorId: string | null | undefined) {
  return useQuery({
    queryKey: ["time-agregado", gestorId],
    queryFn: async (): Promise<TimeAgregadoRow[]> => {
      if (!gestorId) return [];
      const { data, error } = await supabase.rpc("get_time_agregado", {
        p_gestor_id: gestorId,
      });
      if (error) throw error;
      return (data ?? []) as TimeAgregadoRow[];
    },
    enabled: !!gestorId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
