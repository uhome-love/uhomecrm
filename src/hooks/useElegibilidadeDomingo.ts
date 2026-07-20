// =============================================================================
// useElegibilidadeDomingo — Consulta elegibilidade para Roleta de Domingo.
// Regras: >=4 presenças (manhã/tarde na_empresa) + >=2 visitas realizadas
// na semana Seg→Sáb anterior ao domingo alvo.
// =============================================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ElegibilidadeDomingo {
  corretor_id: string;
  elegivel: boolean;
  presencas_semana: number;
  visitas_semana: number;
}

export function useElegibilidadeDomingo(
  corretorIds: string[],
  domingoBRT: string,
) {
  return useQuery({
    queryKey: ["elegibilidade-domingo", domingoBRT, corretorIds.slice().sort()],
    enabled: corretorIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, ElegibilidadeDomingo>> => {
      const out: Record<string, ElegibilidadeDomingo> = {};
      await Promise.all(
        corretorIds.map(async (id) => {
          const { data, error } = await supabase.rpc(
            "elegivel_roleta_domingo" as any,
            { p_corretor_id: id, p_domingo: domingoBRT },
          );
          if (error) {
            out[id] = {
              corretor_id: id,
              elegivel: false,
              presencas_semana: 0,
              visitas_semana: 0,
            };
            return;
          }
          const row = Array.isArray(data) ? data[0] : data;
          out[id] = {
            corretor_id: id,
            elegivel: !!row?.elegivel,
            presencas_semana: row?.presencas_semana ?? 0,
            visitas_semana: row?.visitas_semana ?? 0,
          };
        }),
      );
      return out;
    },
  });
}
