// =============================================================================
// useRoletaPresencaDia — Lista de credenciados aprovados do dia, sem filtro de
// equipe. Usado no painel de presença do CEO. Reaproveita o shape de
// RoletaCredenciado do hook de gestor, com leads_recebidos_dia=0 (o painel de
// presença não precisa desse número).
// =============================================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayBRT } from "@/lib/utils";
import type { RoletaCredenciado, RoletaDia } from "./useDashboardGerenteV4Dia";
import { getCurrentWindowInfo } from "./useRoleta";

export function useRoletaPresencaDia(enabled = true) {
  const dataAlvo = todayBRT();

  return useQuery({
    queryKey: ["roleta-presenca-dia", dataAlvo],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<RoletaDia> => {
      const { data: creds, error } = await supabase
        .from("roleta_credenciamentos")
        .select("corretor_id, janela, status")
        .eq("data", dataAlvo)
        .eq("status", "aprovado");
      if (error) throw error;

      const ids = Array.from(new Set((creds ?? []).map((c: any) => c.corretor_id)));
      let profilesById = new Map<string, { nome: string | null; avatar_url: string | null }>();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", ids);
        for (const p of profs ?? []) {
          profilesById.set((p as any).id, {
            nome: (p as any).nome ?? null,
            avatar_url: (p as any).avatar_url ?? null,
          });
        }
      }

      const info = getCurrentWindowInfo();
      const turnoAtivo = info.janela;

      const credenciados: RoletaCredenciado[] = (creds ?? []).map((c: any) => {
        const prof = profilesById.get(c.corretor_id);
        return {
          corretor_id: c.corretor_id,
          nome: prof?.nome ?? null,
          avatar_url: prof?.avatar_url ?? null,
          janela: c.janela,
          turno_ativo_agora:
            c.janela === turnoAtivo ||
            (c.janela === "dia_todo" && (turnoAtivo === "manha" || turnoAtivo === "tarde")),
          leads_recebidos_dia: 0,
          leads_aceitos_dia: 0,
        };
      });

      return {
        turno_ativo_atual: turnoAtivo,
        credenciados,
      };
    },
  });
}
