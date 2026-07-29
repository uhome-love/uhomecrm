/**
 * useMetricasOrigem — funil por origem/campanha (coorte de leads do período).
 * Consome rpc_metricas_origem (SSOT).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MetricaOrigem {
  origem: string;
  campanha: string;
  leads: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  vendas: number;
  vgv_assinado: number;
}

export function useMetricasOrigem(start: string, end: string, gerenteId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["metricas-origem", start, end, gerenteId ?? null],
    queryFn: async (): Promise<MetricaOrigem[]> => {
      const { data, error } = await supabase.rpc("rpc_metricas_origem" as any, {
        p_start: start,
        p_end: end,
        p_gerente_id: gerenteId ?? null,
      } as any);
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => ({
        origem: r.origem ?? "Sem origem",
        campanha: r.campanha ?? "Sem campanha",
        leads: Number(r.leads ?? 0),
        visitas_marcadas: Number(r.visitas_marcadas ?? 0),
        visitas_realizadas: Number(r.visitas_realizadas ?? 0),
        vendas: Number(r.vendas ?? 0),
        vgv_assinado: Number(r.vgv_assinado ?? 0),
      }));
    },
    enabled: enabled && Boolean(start && end),
    staleTime: 60_000,
  });
}
