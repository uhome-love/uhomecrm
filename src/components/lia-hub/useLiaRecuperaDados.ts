import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ResumoRecupera = { balde: string; produto_slug: string | null; n: number };
const DESCARTE_STAGE = "1dd66c25-3848-4053-9f66-82e902989b4d";

export function useLiaResumoRecupera() {
  return useQuery({
    queryKey: ["lia-hub", "recupera-resumo"],
    queryFn: async () => {
      const sb = supabase as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: ResumoRecupera[] | null; error: Error | null }> } };
      const { data, error } = await sb.from("lia_reengajamento_resumo").select("balde, produto_slug, n");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLiaAguardando24h() {
  return useQuery({
    queryKey: ["lia-hub", "recupera-24h"],
    queryFn: async () => {
      const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count, error } = await supabase.from("pipeline_leads")
        .select("id", { count: "exact", head: true }).eq("stage_id", DESCARTE_STAGE).gte("stage_changed_at", desde);
      if (error) throw error;
      return count ?? 0;
    },
  });
}