// ─────────────────────────────────────────────────────────────────
// visitGrouping — Divide visitas em agendadas (futuras) e realizadas (passadas).
// ─────────────────────────────────────────────────────────────────
import { todayBRT } from "@/lib/brtTime";

export interface VisitaLike {
  id: string;
  data_visita: string;
  hora_visita: string | null;
  status: string;
  [k: string]: unknown;
}

export interface GroupedVisits<V extends VisitaLike> {
  agendadas: V[];
  realizadas: V[];
}

export function groupVisitsByStatus<V extends VisitaLike>(visitas: V[]): GroupedVisits<V> {
  const today = todayBRT(); // YYYY-MM-DD
  const agendadas: V[] = [];
  const realizadas: V[] = [];
  for (const v of visitas) {
    const isFuture = (v.data_visita ?? "") >= today;
    const isDoneStatus = v.status === "realizada" || v.status === "cancelada" || v.status === "nao_compareceu";
    if (isFuture && !isDoneStatus) agendadas.push(v);
    else realizadas.push(v);
  }
  // Agendadas asc, realizadas desc
  agendadas.sort((a, b) => (a.data_visita + (a.hora_visita ?? "")).localeCompare(b.data_visita + (b.hora_visita ?? "")));
  realizadas.sort((a, b) => (b.data_visita + (b.hora_visita ?? "")).localeCompare(a.data_visita + (a.hora_visita ?? "")));
  return { agendadas, realizadas };
}
