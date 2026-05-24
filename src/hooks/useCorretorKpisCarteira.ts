/**
 * useCorretorKpisCarteira — 4 KPIs régua mutuamente exclusivos do Dashboard v3.
 *
 * Régua por lead ativo (em ordem):
 *   1. sem_tarefa  — nenhuma pipeline_tarefa pendente
 *   2. atrasado    — ∃ tarefa pendente com vence_em < now
 *   3. para_hoje   — ∃ tarefa pendente vencendo até fim do dia BRT
 *   4. em_dia      — caso contrário
 *
 * Garantia: sem_tarefa + atrasado + para_hoje + em_dia = total ativos (SQL validado).
 *
 * Reusa o filtro de "lead ativo" alinhado a focusSuggestions.fetchActiveLeadIds:
 *   corretor_id = auth.users.id, arquivado=false, negocio_id IS NULL,
 *   stage.tipo NOT IN ('descarte','convertido'), stage.ativo=true.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayBRT } from "@/lib/utils";

export interface CarteiraBuckets {
  sem_tarefa: number;
  atrasado: number;
  para_hoje: number;
  em_dia: number;
  total: number;
}

const EMPTY: CarteiraBuckets = { sem_tarefa: 0, atrasado: 0, para_hoje: 0, em_dia: 0, total: 0 };

/**
 * Extrai YYYY-MM-DD de um valor `vence_em` (coluna `date` no Postgres).
 * PostgREST devolve a string `YYYY-MM-DD` direto; usamos slice como fallback
 * defensivo se o backend mudar pra timestamptz no futuro.
 */
function ymdBRT(v: string): string {
  if (v.length >= 10 && v[4] === "-" && v[7] === "-") return v.slice(0, 10);
  return new Date(v).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function useCorretorKpisCarteira() {
  const { user } = useAuth();
  return useQuery<CarteiraBuckets>({
    queryKey: ["corretor-kpis-carteira", user?.id],
    queryFn: async () => {
      if (!user?.id) return EMPTY;

      // 1. Stages excluídos (descarte/convertido)
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, tipo")
        .eq("ativo", true);
      const excluded = new Set(
        (stages || [])
          .filter((s: any) => s.tipo === "descarte" || s.tipo === "convertido")
          .map((s: any) => s.id as string)
      );

      // 2. Leads ativos do corretor
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("id, stage_id")
        .eq("corretor_id", user.id)
        .eq("arquivado", false)
        .is("negocio_id", null);
      const ativos = (leads || [])
        .filter((l: any) => !excluded.has(l.stage_id))
        .map((l: any) => l.id as string);

      if (ativos.length === 0) return EMPTY;

      // 3. Tarefas pendentes para esses leads
      const { data: tarefas } = await supabase
        .from("pipeline_tarefas")
        .select("pipeline_lead_id, vence_em")
        .eq("status", "pendente")
        .in("pipeline_lead_id", ativos);

      // Comparação de data em string YYYY-MM-DD no fuso BRT — evita o pitfall
      // de `new Date("YYYY-MM-DD").getTime()` que parseia como 00:00 UTC e
      // colocava tarefas de amanhã BRT no bucket "para_hoje" entre 21h-23h59 UTC.
      const hojeStr = todayBRT();
      type LeadState = "atrasado" | "hoje" | "futuro";
      const PRIORITY: Record<LeadState, number> = { atrasado: 0, hoje: 1, futuro: 2 };
      const stateByLead = new Map<string, LeadState>();

      for (const t of tarefas || []) {
        const id = (t as any).pipeline_lead_id as string;
        const venceRaw = (t as any).vence_em as string | null;
        if (!venceRaw) continue;
        const venceDia = ymdBRT(venceRaw);
        const novo: LeadState =
          venceDia < hojeStr ? "atrasado" :
          venceDia === hojeStr ? "hoje" : "futuro";
        const atual = stateByLead.get(id);
        if (atual === undefined || PRIORITY[novo] < PRIORITY[atual]) {
          stateByLead.set(id, novo);
        }
      }

      let sem_tarefa = 0, atrasado = 0, para_hoje = 0, em_dia = 0;
      for (const id of ativos) {
        const s = stateByLead.get(id);
        if (!s) sem_tarefa++;
        else if (s === "atrasado") atrasado++;
        else if (s === "hoje") para_hoje++;
        else em_dia++;
      }

      return { sem_tarefa, atrasado, para_hoje, em_dia, total: ativos.length };
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
