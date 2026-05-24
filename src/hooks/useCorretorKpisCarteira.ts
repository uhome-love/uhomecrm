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

      const minVencePorLead = new Map<string, number>();
      for (const t of tarefas || []) {
        const id = (t as any).pipeline_lead_id as string;
        const v = new Date((t as any).vence_em as string).getTime();
        const prev = minVencePorLead.get(id);
        if (prev === undefined || v < prev) minVencePorLead.set(id, v);
      }

      const now = Date.now();
      const fimDia = endOfDayBRT().getTime();

      let sem_tarefa = 0, atrasado = 0, para_hoje = 0, em_dia = 0;
      for (const id of ativos) {
        const v = minVencePorLead.get(id);
        if (v === undefined) sem_tarefa++;
        else if (v < now) atrasado++;
        else if (v <= fimDia) para_hoje++;
        else em_dia++;
      }

      return { sem_tarefa, atrasado, para_hoje, em_dia, total: ativos.length };
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
