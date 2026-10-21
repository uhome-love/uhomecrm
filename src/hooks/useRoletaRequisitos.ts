import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Visitas realizadas (mesma régua de roleta_apto_janela): semana passada e semana atual até hoje. Só leitura. */
export interface RequisitosVisitas {
  semanaPassada: number;
  semanaAtual: number;
  meta: number;
}

function isoBRT(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function semanasBRT(agora = new Date()) {
  const hojeStr = isoBRT(agora);
  const hoje = new Date(`${hojeStr}T12:00:00Z`);
  const dow = hoje.getUTCDay() === 0 ? 7 : hoje.getUTCDay();
  const seg = new Date(hoje);
  seg.setUTCDate(hoje.getUTCDate() - (dow - 1));
  const segPassada = new Date(seg);
  segPassada.setUTCDate(seg.getUTCDate() - 7);
  const domPassado = new Date(seg);
  domPassado.setUTCDate(seg.getUTCDate() - 1);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  return { hoje: hojeStr, segAtual: f(seg), segPassada: f(segPassada), domPassado: f(domPassado) };
}

export function useRoletaRequisitos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["roleta-requisitos-visitas", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<RequisitosVisitas | null> => {
      const s = semanasBRT();
      const [pass, atual, meta] = await Promise.all([
        supabase.rpc("roleta_visitas_realizadas_periodo", { p_auth_user_id: user!.id, p_inicio: s.segPassada, p_fim: s.domPassado }),
        supabase.rpc("roleta_visitas_realizadas_periodo", { p_auth_user_id: user!.id, p_inicio: s.segAtual, p_fim: s.hoje }),
        supabase.rpc("roleta_visitas_meta"),
      ]);
      if (pass.error || atual.error) return null;
      return {
        semanaPassada: Number(pass.data ?? 0),
        semanaAtual: Number(atual.data ?? 0),
        meta: Number(meta.data ?? 2),
      };
    },
  });
}
