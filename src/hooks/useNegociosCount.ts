/**
 * useNegociosCount — Conta leads do corretor na stage "Negócio Criado".
 *
 * Pílula informacional do header do Pipeline v2. Filtra por:
 *   - corretor_id = auth.users.id (não profiles.id)
 *   - arquivado = false
 *   - stage.tipo = 'convertido'
 *
 * Pareado com `useCorretorKpisCarteira` (Em dia / Sem tarefa / Atrasado).
 * Os 4 juntos compõem as 4 pílulas clicáveis do header.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useNegociosCount() {
  const { user } = useAuth();
  return useQuery<number>({
    queryKey: ["pipeline-negocios-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("ativo", true)
        .in("tipo", ["convertido", "proposta", "contrato_gerado", "venda", "caiu"]);

      const stageIds = (stages || []).map((s: any) => s.id as string);
      if (stageIds.length === 0) return 0;

      const { count } = await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user.id)
        .eq("arquivado", false)
        .in("stage_id", stageIds);

      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
