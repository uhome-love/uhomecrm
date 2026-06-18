/**
 * taskBuckets — Regra canônica única de classificação de tarefas.
 *
 * Regras (definidas pelo produto, vale para TODOS os locais):
 *   1. PARA HOJE = tarefa pendente com vence_em == hoje BRT
 *                  (independe de já ter passado da hora).
 *   2. ATRASADA  = tarefa pendente com vence_em < hoje BRT
 *                  OU (vence_em == hoje BRT E hora_vencimento já passou).
 *                  Quando hora_vencimento IS NULL no dia de hoje, default 23:59
 *                  (consistente com mem://rules/business/sla-and-overdue-logic).
 *   3. SEM TAREFA = lead ativo sem nenhuma tarefa pendente.
 *
 * IMPORTANTE: PARA HOJE e ATRASADA podem se sobrepor — uma tarefa hoje 10:00
 * às 16:00 BRT está em AMBOS os buckets. Esse é o comportamento esperado.
 *
 * Consumido por:
 *   - src/hooks/useCorretorKpisCarteira.ts (Dashboard /corretor)
 *   - src/pages/MinhasTarefas.tsx (Central de Tarefas)
 *   - src/lib/taskQueryUtils.ts (Pipeline + Central de Tarefas)
 */
import { todayBRT, nowBRT, BRT_TIMEZONE } from "./brtTime";

export interface TaskLike {
  vence_em: string | null;
  hora_vencimento: string | null;
}

export interface TaskFlags {
  isToday: boolean;
  isOverdue: boolean;
}

/**
 * Extrai YYYY-MM-DD de um valor `vence_em` (geralmente coluna `date` no Postgres).
 * PostgREST devolve a string YYYY-MM-DD direto; fallback defensivo se virar timestamptz.
 */
function ymdBRT(v: string): string {
  if (v.length >= 10 && v[4] === "-" && v[7] === "-") return v.slice(0, 10);
  return new Date(v).toLocaleDateString("en-CA", { timeZone: BRT_TIMEZONE });
}

function nowHHMMBrt(now: Date = nowBRT()): string {
  return now.toLocaleTimeString("en-GB", {
    timeZone: BRT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Classifica uma tarefa em isToday / isOverdue conforme regras canônicas.
 * Ambos podem ser true simultaneamente (tarefa de hoje cuja hora já passou).
 */
export function classifyTask(
  t: TaskLike,
  ctx?: { todayStr?: string; nowHHMM?: string }
): TaskFlags {
  if (!t.vence_em) return { isToday: false, isOverdue: false };
  const today = ctx?.todayStr ?? todayBRT();
  const venceDia = ymdBRT(t.vence_em);

  if (venceDia < today) return { isToday: false, isOverdue: true };
  if (venceDia > today) return { isToday: false, isOverdue: false };

  // venceDia == today
  const nowHM = ctx?.nowHHMM ?? nowHHMMBrt();
  const horaVenc = (t.hora_vencimento ?? "23:59").slice(0, 5);
  return { isToday: true, isOverdue: horaVenc < nowHM };
}

export interface TaskBuckets {
  tarefas_hoje: number;
  tarefas_atrasadas: number;
  leads_sem_tarefa: number;
  leads_em_dia: number;
  total_leads: number;
}

/**
 * Calcula buckets canônicos a partir de tarefas pendentes e leads ativos.
 *
 * @param tarefas Lista de tarefas pendentes (status='pendente') com pipeline_lead_id.
 * @param leadIds IDs dos leads ativos do escopo (ex: carteira do corretor).
 */
export function computeTaskBuckets(
  tarefas: Array<TaskLike & { pipeline_lead_id: string | null }>,
  leadIds: string[]
): TaskBuckets {
  const today = todayBRT();
  const nowHM = nowHHMMBrt();

  let tarefas_hoje = 0;
  let tarefas_atrasadas = 0;
  const leadsComTarefa = new Set<string>();
  const leadsAtrasados = new Set<string>();
  const leadsComHoje = new Set<string>();

  for (const t of tarefas) {
    if (t.pipeline_lead_id) leadsComTarefa.add(t.pipeline_lead_id);
    const { isToday, isOverdue } = classifyTask(t, { todayStr: today, nowHHMM: nowHM });
    if (isToday) {
      tarefas_hoje++;
      if (t.pipeline_lead_id) leadsComHoje.add(t.pipeline_lead_id);
    }
    if (isOverdue) {
      tarefas_atrasadas++;
      if (t.pipeline_lead_id) leadsAtrasados.add(t.pipeline_lead_id);
    }
  }

  const leadSet = new Set(leadIds);
  let leads_sem_tarefa = 0;
  let leads_em_dia = 0;
  for (const id of leadSet) {
    if (!leadsComTarefa.has(id)) {
      leads_sem_tarefa++;
    } else if (!leadsAtrasados.has(id) && !leadsComHoje.has(id)) {
      leads_em_dia++;
    }
  }

  return {
    tarefas_hoje,
    tarefas_atrasadas,
    leads_sem_tarefa,
    leads_em_dia,
    total_leads: leadSet.size,
  };
}
