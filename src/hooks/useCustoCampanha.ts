/**
 * useCustoCampanha — investimento de mídia por campanha no período (marketing_entries).
 *
 * `marketing_entries.periodo` é texto no formato "YYYY-MM-DD a YYYY-MM-DD" (linha diária),
 * então o recorte lexicográfico por prefixo equivale ao recorte por data (BRT).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CustoPorCampanha = Record<string, number>;

export function useCustoCampanha(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: ["custo-campanha", start, end],
    enabled: enabled && Boolean(start && end),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CustoPorCampanha> => {
      const mapa: CustoPorCampanha = {};
      const passo = 1000;
      for (let offset = 0; ; offset += passo) {
        const { data, error } = await supabase
          .from("marketing_entries")
          .select("campanha, investimento")
          .gte("periodo", start)
          .lte("periodo", `${end} z`)
          .range(offset, offset + passo - 1);
        if (error) throw error;
        const linhas = data ?? [];
        for (const l of linhas) {
          const chave = (l.campanha || "").trim();
          if (!chave) continue;
          mapa[chave] = (mapa[chave] ?? 0) + Number(l.investimento || 0);
        }
        if (linhas.length < passo) break;
      }
      return mapa;
    },
  });
}
