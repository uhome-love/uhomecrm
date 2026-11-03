import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchMetricas, somarMetricas } from "@/lib/metricasSSOT";
import { todayBRT } from "@/lib/brtTime";
import { CAMPANHA_FIM, CAMPANHA_INICIO } from "./config";
import { META_VGV_MINIMA, META_VISITAS_PADRAO, segundaDaSemana } from "./missao";

export interface MetaNatal { meta_vgv: number; meta_visitas_semana: number; definida: boolean }

const fimAte = (hoje: string) => (hoje > CAMPANHA_FIM ? CAMPANHA_FIM : hoje);

export function useMetaNatal(userId?: string) {
  return useQuery({
    queryKey: ["natal-meta", userId],
    enabled: !!userId,
    staleTime: 120_000,
    queryFn: async (): Promise<MetaNatal> => {
      const { data } = await supabase.from("campanha_natal_metas").select("meta_vgv, meta_visitas_semana").eq("user_id", userId!).maybeSingle();
      return data
        ? { meta_vgv: Number(data.meta_vgv), meta_visitas_semana: data.meta_visitas_semana, definida: true }
        : { meta_vgv: META_VGV_MINIMA, meta_visitas_semana: META_VISITAS_PADRAO, definida: false };
    },
  });
}

export function useSalvarMetaNatal(userId?: string) {
  const qc = useQueryClient();
  return async (meta_vgv: number, meta_visitas_semana: number) => {
    const { error } = await supabase.from("campanha_natal_metas").upsert({ user_id: userId!, meta_vgv, meta_visitas_semana, updated_at: new Date().toISOString() });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["natal-meta", userId] });
  };
}

export function useMissaoNatal(userId?: string) {
  return useQuery({
    queryKey: ["natal-missao", userId],
    enabled: !!userId,
    staleTime: 120_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const hoje = todayBRT();
      const end = fimAte(hoje);
      const { data: tm } = await supabase.from("team_members").select("gerente_id, equipe").eq("user_id", userId!).eq("status", "ativo").limit(1).maybeSingle();
      const [camp, semana, equipe, uhome, neg] = await Promise.all([
        fetchMetricas({ start: CAMPANHA_INICIO, end, userId }),
        fetchMetricas({ start: segundaDaSemana(hoje), end: hoje, userId }),
        tm?.gerente_id ? fetchMetricas({ start: CAMPANHA_INICIO, end, gerenteId: tm.gerente_id }) : Promise.resolve([]),
        fetchMetricas({ start: "2026-01-01", end: hoje }),
        supabase.from("negocios").select("id", { count: "exact", head: true }).eq("auth_user_id", userId!)
          .gte("created_at", `${CAMPANHA_INICIO}T00:00:00-03:00`).lte("created_at", `${end}T23:59:59-03:00`),
      ]);
      return {
        hoje,
        campanha: somarMetricas(camp),
        semanaRealizadas: somarMetricas(semana).visitas_realizadas,
        negocios: neg.count ?? 0,
        equipeNome: tm?.equipe ?? null,
        equipeVgv: somarMetricas(equipe).vgv_assinado,
        uhomeVgv: somarMetricas(uhome).vgv_assinado,
      };
    },
  });
}
