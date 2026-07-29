/**
 * useEvolucaoSSOT — série mensal de métricas (últimos N meses) a partir do SSOT.
 * Consome fetchMetricas (rpc_metricas) uma vez por mês, em paralelo.
 */
import { useQuery } from "@tanstack/react-query";
import { addMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchMetricas, somarMetricas, type MetricasFiltro } from "@/lib/metricasSSOT";

export interface PontoEvolucao {
  mes: string;
  inicio: string;
  vgv: number;
  vendas: number;
  visitas: number;
  leads: number;
}

interface Params extends Omit<MetricasFiltro, "start" | "end"> {
  /** mês de referência (última barra) */
  referencia: Date;
  meses?: number;
}

export function useEvolucaoSSOT({ referencia, meses = 6, userId, gerenteId, incluirInativos }: Params) {
  const ref = startOfMonth(referencia);
  const chave = format(ref, "yyyy-MM");

  const query = useQuery({
    queryKey: ["metricas-ssot-evolucao", chave, meses, userId ?? null, gerenteId ?? null, incluirInativos ?? true],
    queryFn: async (): Promise<PontoEvolucao[]> => {
      const janelas = Array.from({ length: meses }, (_, i) => addMonths(ref, i - (meses - 1)));
      const resultados = await Promise.all(
        janelas.map(async (d) => {
          const start = format(startOfMonth(d), "yyyy-MM-dd");
          const end = format(endOfMonth(d), "yyyy-MM-dd");
          const linhas = await fetchMetricas({ start, end, userId, gerenteId, incluirInativos });
          const t = somarMetricas(linhas);
          const label = format(d, "MMM", { locale: ptBR }).replace(".", "");
          return {
            mes: label.charAt(0).toUpperCase() + label.slice(1),
            inicio: start,
            vgv: t.vgv_assinado,
            vendas: t.vendas,
            visitas: t.visitas_realizadas,
            leads: t.leads_recebidos,
          };
        })
      );
      return resultados;
    },
    staleTime: 5 * 60_000,
  });

  return { ...query, pontos: query.data ?? [] };
}
