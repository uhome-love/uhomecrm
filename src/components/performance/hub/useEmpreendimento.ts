import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmpreendimentoRow {
  empreendimento: string;
  leads: number;
  visitas: number;
  vendas: number;
  vgv: number;
}

interface Filtro {
  start: string;
  end: string;
  gerenteId: string | null;
  userId: string | null;
}

/** Aproveitamento por empreendimento (get_perf_empreendimento), escopo por papel. */
export function useEmpreendimento(f: Filtro, enabled = true) {
  return useQuery({
    queryKey: ["perf-empreendimento", f.start, f.end, f.gerenteId, f.userId],
    enabled,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    queryFn: async (): Promise<EmpreendimentoRow[]> => {
      const { data, error } = await supabase.rpc("get_perf_empreendimento" as never, {
        p_start: f.start,
        p_end: f.end,
        p_gerente_id: f.gerenteId,
        p_user_id: f.userId,
      } as never);
      if (error) throw error;
      const arr = (data as unknown as Record<string, unknown>[]) || [];
      return arr.map((r) => ({
        empreendimento: String(r.empreendimento ?? "Sem empreendimento"),
        leads: Number(r.leads) || 0,
        visitas: Number(r.visitas) || 0,
        vendas: Number(r.vendas) || 0,
        vgv: Number(r.vgv) || 0,
      }));
    },
  });
}
