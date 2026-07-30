/**
 * useMetricasDetalhe — drill-down da Central de Performance.
 * Lista os itens que compõem cada KPI (SSOT: rpc_metricas_detalhe).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DetalheTipo =
  | "vendas"
  | "vgv"
  | "visitas_realizadas"
  | "visitas_marcadas"
  | "visitas_no_show"
  | "leads";

export interface DetalheItem {
  id: string;
  titulo: string;
  subtitulo: string | null;
  data_ref: string | null;
  valor: number | null;
  status: string | null;
  corretor_nome: string | null;
  equipe: string | null;
}

interface Params {
  tipo: DetalheTipo | null;
  start: string;
  end: string;
  gerenteId?: string | null;
  userId?: string | null;
  enabled?: boolean;
}

export function useMetricasDetalhe({ tipo, start, end, gerenteId, userId, enabled = true }: Params) {
  return useQuery({
    queryKey: ["metricas-detalhe", tipo, start, end, gerenteId ?? null, userId ?? null],
    enabled: enabled && !!tipo,
    staleTime: 60_000,
    queryFn: async (): Promise<DetalheItem[]> => {
      const { data, error } = await supabase.rpc("rpc_metricas_detalhe" as never, {
        p_tipo: tipo,
        p_start: start,
        p_end: end,
        p_user_id: userId ?? null,
        p_gerente_id: gerenteId ?? null,
        p_limit: 300,
      } as never);
      if (error) throw error;
      return ((data as unknown as Record<string, unknown>[]) || []).map((r) => ({
        id: String(r.id),
        titulo: (r.titulo as string) ?? "Sem nome",
        subtitulo: (r.subtitulo as string) ?? null,
        data_ref: (r.data_ref as string) ?? null,
        valor: r.valor === null || r.valor === undefined ? null : Number(r.valor),
        status: (r.status as string) ?? null,
        corretor_nome: (r.corretor_nome as string) ?? null,
        equipe: (r.equipe as string) ?? null,
      }));
    },
  });
}
