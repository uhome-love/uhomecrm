import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchMetricas, somarMetricas, type MetricasTotais } from "@/lib/metricasSSOT";

/** Leads, visitas realizadas e vendas/VGV do mês atual e do anterior (BRT) — fonte única rpc_metricas. */
function mesBRT(offset: number) {
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const ini = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
  const fim = offset === 0 ? hoje : new Date(hoje.getFullYear(), hoje.getMonth() + offset + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(ini), end: iso(fim), nome: ini.toLocaleDateString("pt-BR", { month: "long" }) };
}

export interface EvolucaoMes { atual: MetricasTotais; anterior: MetricasTotais; mesAtual: string; mesAnterior: string }

export function useMinhaEvolucaoMes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["minha-evolucao-mes", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EvolucaoMes> => {
      const a = mesBRT(0), b = mesBRT(-1);
      const [ra, rb] = await Promise.all([
        fetchMetricas({ start: a.start, end: a.end, userId: user!.id }),
        fetchMetricas({ start: b.start, end: b.end, userId: user!.id }),
      ]);
      return { atual: somarMetricas(ra), anterior: somarMetricas(rb), mesAtual: a.nome, mesAnterior: b.nome };
    },
  });
}
