import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DESCARTE_STAGE = "1dd66c25-3848-4053-9f66-82e902989b4d";

export function useLiaResumoRecupera() {
  return useQuery({
    queryKey: ["lia-reeng-resumo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lia_reengajamento_resumo").select("balde, produto_slug, produto_ativo, n");
      if (error) throw error;
      return (data ?? []).map((row) => {
        if (row.balde === null || row.n === null) throw new Error("Resumo indisponível");
        return { ...row, balde: row.balde, n: row.n };
      });
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
      if (count === null) throw new Error("Contagem indisponível");
      return count;
    },
  });
}