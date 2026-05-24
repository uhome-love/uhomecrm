/**
 * useCorretorKpisConquistas — KPIs de resultado do mês BRT atual.
 *
 *   - visitasRealizadas: visitas.status='realizada' no mês BRT corrente
 *   - vendas: negocios.fase='vendido' com data_assinatura no mês BRT corrente
 *             ⚠️ negocios.corretor_id = profiles.id (pitfall conhecido)
 *   - visitasProximas7d: visitas.status IN ('marcada','confirmada','reagendada')
 *                       nos próximos 7 dias BRT (subtítulo do card Agenda)
 *
 * visitas.corretor_id contém valores mistos (auth.users.id e profiles.id em
 * registros legados), então filtramos por IN (authId, profileId) para cobrir
 * ambos os casos sem perder dados.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCorretorIds } from "@/hooks/useCorretorIds";

export interface ConquistasKpis {
  visitasRealizadas: number;
  vendas: number;
  visitasProximas7d: number;
}

const EMPTY: ConquistasKpis = { visitasRealizadas: 0, vendas: 0, visitasProximas7d: 0 };

function startOfMonthBRT(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return today.slice(0, 7) + "-01"; // YYYY-MM-01
}

function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function plusDaysBRT(days: number): string {
  const t = new Date();
  const brt = new Date(t.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brt.setDate(brt.getDate() + days);
  return brt.toISOString().slice(0, 10);
}

export function useCorretorKpisConquistas() {
  const { authId, profileId, isLoading: idsLoading } = useCorretorIds();

  return useQuery<ConquistasKpis>({
    queryKey: ["corretor-kpis-conquistas", authId, profileId],
    queryFn: async () => {
      if (!authId) return EMPTY;
      const inicioMes = startOfMonthBRT();
      const hoje = todayBRT();
      const em7d = plusDaysBRT(7);
      const visitaIds = [authId, profileId].filter(Boolean) as string[];

      // Visitas realizadas mês
      const visRealQ = supabase
        .from("visitas")
        .select("id", { count: "exact", head: true })
        .in("corretor_id", visitaIds)
        .eq("status", "realizada")
        .gte("data_visita", inicioMes);

      // Vendas mês (negocios usa profiles.id)
      const vendasQ = profileId
        ? supabase
            .from("negocios")
            .select("id", { count: "exact", head: true })
            .eq("corretor_id", profileId)
            .eq("fase", "vendido")
            .gte("data_assinatura", inicioMes)
        : Promise.resolve({ count: 0, error: null } as any);

      // Visitas próximas 7d (incluindo hoje)
      const vis7Q = supabase
        .from("visitas")
        .select("id", { count: "exact", head: true })
        .in("corretor_id", visitaIds)
        .in("status", ["marcada", "confirmada", "reagendada"])
        .gte("data_visita", hoje)
        .lte("data_visita", em7d);

      const [visRes, venRes, vis7Res] = await Promise.all([visRealQ, vendasQ, vis7Q]);

      return {
        visitasRealizadas: visRes.count ?? 0,
        vendas: (venRes as any).count ?? 0,
        visitasProximas7d: vis7Res.count ?? 0,
      };
    },
    enabled: !!authId && !idsLoading,
    staleTime: 5 * 60_000,
  });
}
