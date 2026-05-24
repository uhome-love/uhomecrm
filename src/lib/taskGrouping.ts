// ─────────────────────────────────────────────────────────────────
// taskGrouping — Buckets de prazo para Drawer v4 (aba Tarefas)
// Regra BRT global obrigatória.
// ─────────────────────────────────────────────────────────────────
import { addDays, differenceInCalendarDays, isBefore, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateBRTSafe } from "@/lib/utils";
import { formatBRT, nowBRT } from "@/lib/brtTime";
import type { PipelineTarefa } from "@/hooks/usePipelineLeadData";

export type TaskBucket = "atrasadas" | "hoje" | "amanha" | "semana" | "proximas";

export interface GroupedTasks {
  atrasadas: PipelineTarefa[];
  hoje: PipelineTarefa[];
  amanha: PipelineTarefa[];
  semana: PipelineTarefa[];
  proximas: PipelineTarefa[];
}

const SEMANA_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function startOfDayBRT(d: Date): Date {
  const ymd = formatBRT(d, "yyyy-MM-dd");
  return new Date(`${ymd}T00:00:00-03:00`);
}

export function groupTasksByDeadline(tarefas: PipelineTarefa[]): GroupedTasks {
  const pendentes = tarefas.filter(t => t.status === "pendente");
  const today = startOfDayBRT(nowBRT());
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);

  const out: GroupedTasks = { atrasadas: [], hoje: [], amanha: [], semana: [], proximas: [] };

  for (const t of pendentes) {
    const d = t.vence_em ? parseDateBRTSafe(t.vence_em) : null;
    if (!d) { out.proximas.push(t); continue; }
    const dayStart = startOfDayBRT(d);
    if (isBefore(dayStart, today)) out.atrasadas.push(t);
    else if (isSameDay(dayStart, today)) out.hoje.push(t);
    else if (isSameDay(dayStart, tomorrow)) out.amanha.push(t);
    else if (isBefore(dayStart, weekEnd)) out.semana.push(t);
    else out.proximas.push(t);
  }

  // Sort each bucket by datetime asc (using vence_em + hora)
  const cmp = (a: PipelineTarefa, b: PipelineTarefa) => {
    const av = (a.vence_em ?? "9999-12-31") + "T" + (a.hora_vencimento ?? "23:59");
    const bv = (b.vence_em ?? "9999-12-31") + "T" + (b.hora_vencimento ?? "23:59");
    return av.localeCompare(bv);
  };
  out.atrasadas.sort(cmp);
  out.hoje.sort(cmp);
  out.amanha.sort(cmp);
  out.semana.sort(cmp);
  out.proximas.sort(cmp);

  return out;
}

/** Formata prazo da tarefa de forma humanizada (BRT). */
export function formatTaskDeadline(vence_em: string | null, hora_vencimento: string | null): string {
  if (!vence_em) return "Sem prazo";
  const d = parseDateBRTSafe(vence_em);
  if (!d) return "Sem prazo";
  const today = startOfDayBRT(nowBRT());
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const dayStart = startOfDayBRT(d);
  const hora = hora_vencimento ? hora_vencimento.slice(0, 5) : "";

  if (isBefore(dayStart, today)) {
    const dias = differenceInCalendarDays(today, dayStart);
    if (dias === 1) return "Vencida ontem" + (hora ? ` · ${hora}` : "");
    return `Vencida há ${dias} dias` + (hora ? ` · ${hora}` : "");
  }
  if (isSameDay(dayStart, today)) return "Hoje" + (hora ? ` · ${hora}` : "");
  if (isSameDay(dayStart, tomorrow)) return "Amanhã" + (hora ? ` · ${hora}` : "");
  if (isBefore(dayStart, weekEnd)) {
    const dow = SEMANA_DIAS[d.getDay()];
    const dia = formatBRT(d, "dd");
    const mes = (d.toLocaleString("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" }) || "").replace(".", "");
    return `${dow.charAt(0).toUpperCase() + dow.slice(1)} · ${dia} ${mes}` + (hora ? ` · ${hora}` : "");
  }
  const dia = formatBRT(d, "dd");
  const mes = (d.toLocaleString("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" }) || "").replace(".", "");
  return `${dia} ${mes}` + (hora ? ` · ${hora}` : "");
}
