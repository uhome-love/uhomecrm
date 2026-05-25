/**
 * useCorretorKpisCarteira — KPIs do Dashboard /corretor.
 *
 * Regras canônicas (ver src/lib/taskBuckets.ts):
 *   - tarefas_hoje:       count de TAREFAS pendentes com vence_em=hoje BRT
 *                         (inclui as que já passaram da hora — overlap esperado)
 *   - tarefas_atrasadas:  count de TAREFAS pendentes vencidas
 *                         (data<hoje OR data=hoje E hora<agora; NULL→23:59)
 *   - leads_sem_tarefa:   LEADS ativos sem nenhuma tarefa pendente
 *   - leads_em_dia:       LEADS ativos com tarefas só no futuro
 *
 * Escopo de leads ativos: corretor_id = auth.users.id, arquivado=false,
 * negocio_id IS NULL, stage.tipo NOT IN ('descarte','convertido').
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeTaskBuckets, type TaskBuckets } from "@/lib/taskBuckets";

const EMPTY: TaskBuckets = {
  tarefas_hoje: 0,
  tarefas_atrasadas: 0,
  leads_sem_tarefa: 0,
  leads_em_dia: 0,
  total_leads: 0,
};

// Retrocompat: campos antigos mantidos como alias para componentes legados.
export interface CarteiraBuckets extends TaskBuckets {
  /** @deprecated use tarefas_hoje */
  para_hoje: number;
  /** @deprecated use tarefas_atrasadas */
  atrasado: number;
  /** @deprecated use leads_sem_tarefa */
  sem_tarefa: number;
  /** @deprecated use leads_em_dia */
  em_dia: number;
  /** @deprecated use total_leads */
  total: number;
}

function withAliases(b: TaskBuckets): CarteiraBuckets {
  return {
    ...b,
    para_hoje: b.tarefas_hoje,
    atrasado: b.tarefas_atrasadas,
    sem_tarefa: b.leads_sem_tarefa,
    em_dia: b.leads_em_dia,
    total: b.total_leads,
  };
}

export function useCorretorKpisCarteira() {
  const { user } = useAuth();
  return useQuery<CarteiraBuckets>({
    queryKey: ["corretor-kpis-carteira", user?.id],
    queryFn: async () => {
      if (!user?.id) return withAliases(EMPTY);

      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, tipo")
        .eq("ativo", true);
      const excluded = new Set(
        (stages || [])
          .filter((s: any) => s.tipo === "descarte" || s.tipo === "convertido")
          .map((s: any) => s.id as string)
      );

      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("id, stage_id")
        .eq("corretor_id", user.id)
        .eq("arquivado", false)
        .is("negocio_id", null);
      const ativos = (leads || [])
        .filter((l: any) => !excluded.has(l.stage_id))
        .map((l: any) => l.id as string);

      if (ativos.length === 0) return withAliases(EMPTY);

      const { data: tarefas } = await supabase
        .from("pipeline_tarefas")
        .select("pipeline_lead_id, vence_em, hora_vencimento")
        .eq("status", "pendente")
        .in("pipeline_lead_id", ativos);

      const buckets = computeTaskBuckets(
        (tarefas || []).map((t: any) => ({
          pipeline_lead_id: t.pipeline_lead_id,
          vence_em: t.vence_em,
          hora_vencimento: t.hora_vencimento,
        })),
        ativos
      );

      return withAliases(buckets);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
