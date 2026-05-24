/**
 * useTarefasHoje — Tarefas pendentes que vencem hoje (BRT) do corretor logado.
 *
 * Filtro:
 *   - pipeline_tarefas.status='pendente'
 *   - vence_em dentro do dia BRT corrente
 *   - pipeline_lead.corretor_id = auth.users.id
 * Join opcional para mostrar nome/empreendimento/stage no card.
 * Order: vence_em ASC. Limit: 20.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TarefaHoje {
  id: string;
  tipo: string | null;
  vence_em: string;
  titulo: string | null;
  lead_id: string;
  lead_nome: string;
  empreendimento: string | null;
  stage_nome: string;
}

function startOfTodayBRT(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `${today}T00:00:00-03:00`;
}
function endOfTodayBRT(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `${today}T23:59:59.999-03:00`;
}

export function useTarefasHoje() {
  const { user } = useAuth();
  return useQuery<TarefaHoje[]>({
    queryKey: ["corretor-tarefas-hoje", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // 1) IDs dos leads do corretor
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("id, nome, empreendimento, stage_id")
        .eq("corretor_id", user.id)
        .eq("arquivado", false);
      const leadIds = (leads || []).map((l: any) => l.id as string);
      if (leadIds.length === 0) return [];

      const leadById = new Map<string, any>();
      for (const l of leads || []) leadById.set((l as any).id, l);

      // 2) Tarefas pendentes hoje
      const { data: tarefas } = await supabase
        .from("pipeline_tarefas")
        .select("id, tipo, vence_em, titulo, pipeline_lead_id")
        .eq("status", "pendente")
        .in("pipeline_lead_id", leadIds)
        .gte("vence_em", startOfTodayBRT())
        .lte("vence_em", endOfTodayBRT())
        .order("vence_em", { ascending: true })
        .limit(20);

      if (!tarefas?.length) return [];

      // 3) Stages
      const stageIds = Array.from(new Set((tarefas || []).map((t: any) => leadById.get(t.pipeline_lead_id)?.stage_id).filter(Boolean)));
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, nome")
        .in("id", stageIds as string[]);
      const stageNomeById = new Map<string, string>();
      for (const s of stages || []) stageNomeById.set((s as any).id, (s as any).nome);

      return (tarefas || []).map((t: any) => {
        const lead = leadById.get(t.pipeline_lead_id) || {};
        return {
          id: t.id,
          tipo: t.tipo,
          vence_em: t.vence_em,
          titulo: t.titulo,
          lead_id: t.pipeline_lead_id,
          lead_nome: lead.nome || "—",
          empreendimento: lead.empreendimento,
          stage_nome: stageNomeById.get(lead.stage_id) || "—",
        } as TarefaHoje;
      });
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
