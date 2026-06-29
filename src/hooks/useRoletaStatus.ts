// =============================================================================
// useRoletaStatus — KPIs ao vivo da Central de Roleta (status bar).
// Reaproveita as mesmas fontes do RoletaMetricasTab, mas focado no resumo
// sempre visível no topo. Sem mudanças de banco/RLS.
// =============================================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayBRT } from "@/lib/utils";

export interface RoletaStatus {
  distribuidos_hoje: number;
  aceitos_hoje: number;
  rejeitados_hoje: number;
  fila_ceo: number;
  aguardando_aceite: number;
  taxa_aceite: number;
}

export function useRoletaStatus(enabled = true) {
  const hoje = todayBRT();

  const query = useQuery({
    queryKey: ["roleta-status", hoje],
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<RoletaStatus> => {
      const todayStart = `${hoje}T00:00:00-03:00`;
      const todayEnd = `${hoje}T23:59:59-03:00`;

      const [histRes, filaCeoRes, aguardandoRes] = await Promise.all([
        supabase
          .from("distribuicao_historico")
          .select("acao")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
        supabase
          .from("pipeline_leads")
          .select("id", { count: "exact", head: true })
          .eq("aceite_status", "pendente_distribuicao")
          .is("corretor_id", null),
        supabase
          .from("pipeline_leads")
          .select("id", { count: "exact", head: true })
          .eq("aceite_status", "aguardando_aceite"),
      ]);

      const hist = histRes.data || [];
      const distribuidos = hist.filter((h) => h.acao === "distribuido").length;
      const aceitos = hist.filter((h) => h.acao === "aceito").length;
      const rejeitados = hist.filter(
        (h) => h.acao === "rejeitado" || h.acao === "timeout" || h.acao === "expirado"
      ).length;

      return {
        distribuidos_hoje: distribuidos,
        aceitos_hoje: aceitos,
        rejeitados_hoje: rejeitados,
        fila_ceo: filaCeoRes.count || 0,
        aguardando_aceite: aguardandoRes.count || 0,
        taxa_aceite: distribuidos > 0 ? Math.round((aceitos / distribuidos) * 100) : 0,
      };
    },
  });

  return query;
}
