import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SituacaoVisitas = "apto" | "evolucao" | "retomada";

export interface SemanaVisitas { inicio: string; label: string; visitas: number; atual: boolean }

export interface MinhaEvolucao {
  meta: number;
  semanaAtual: number;
  semanaAnterior: number;
  semanas: SemanaVisitas[];
  situacao: SituacaoVisitas;
  bloqueio: { bloqueado: boolean; codigo?: string; titulo?: string; texto?: string } | null;
}

/** Data (YYYY-MM-DD) de hoje em BRT. */
function hojeBRT(): Date {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${s}T12:00:00`);
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Visitas realizadas por semana (seg–dom, BRT) — mesma régua do credenciamento. */
export function useMinhaEvolucao() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["minha-evolucao", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<MinhaEvolucao> => {
      const hoje = hojeBRT();
      const dow = (hoje.getDay() + 6) % 7; // 0 = segunda
      const segAtual = addDias(hoje, -dow);
      const inicios = [3, 2, 1, 0].map((k) => addDias(segAtual, -7 * k));
      const [metaRes, bloqRes, ...vis] = await Promise.all([
        supabase.rpc("roleta_visitas_meta"),
        supabase.rpc("roleta_motivo_bloqueio", { p_auth_user_id: user!.id }),
        ...inicios.map((ini) =>
          supabase.rpc("roleta_visitas_realizadas_periodo", {
            p_auth_user_id: user!.id, p_inicio: iso(ini), p_fim: iso(addDias(ini, 6)),
          })),
      ]);
      const meta = (metaRes.data as number | null) ?? 2;
      const semanas: SemanaVisitas[] = inicios.map((ini, i) => ({
        inicio: iso(ini),
        label: i === 3 ? "Atual" : ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        visitas: Number(vis[i]?.data ?? 0),
        atual: i === 3,
      }));
      const semanaAnterior = semanas[2].visitas;
      const situacao: SituacaoVisitas = semanaAnterior >= meta ? "apto" : semanaAnterior > 0 ? "evolucao" : "retomada";
      return {
        meta, semanas, semanaAtual: semanas[3].visitas, semanaAnterior, situacao,
        bloqueio: (bloqRes.data as MinhaEvolucao["bloqueio"]) ?? null,
      };
    },
  });
}
