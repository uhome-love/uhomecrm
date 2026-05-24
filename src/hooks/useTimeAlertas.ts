/**
 * useTimeAlertas — Gera até 3 alertas client-side a partir do agregado do time.
 *
 * Hierarquia:
 *  1. RED  — pior corretor com ≥5 tarefas atrasadas
 *  2. AMBER — total do time sem contato há 5+ dias (≥10)
 *  3. (futuro) BLUE — visitas amanhã sem confirmação
 */
import { useMemo } from "react";
import type { TimeAgregadoRow } from "@/hooks/useTimeAgregado";

export type AlertaAction =
  | { tipo: "filtrar_kanban"; filtros: { corretor_id?: string; status_lead?: "tarefa_atrasada" | "desatualizado" | "em_dia" } }
  | { tipo: "ver_visitas" };

export interface Alerta {
  id: string;
  tipo: "red" | "amber" | "blue";
  icone: string;
  texto: string;
  action: AlertaAction;
}

export function useTimeAlertas(rows: TimeAgregadoRow[]): Alerta[] {
  return useMemo(() => {
    const alertas: Alerta[] = [];

    const piorCorretor = rows
      .filter((r) => r.atrasados >= 5)
      .sort((a, b) => b.atrasados - a.atrasados)[0];

    if (piorCorretor) {
      alertas.push({
        id: "corretor-atrasados",
        tipo: "red",
        icone: "🔴",
        texto: `${piorCorretor.nome}: ${piorCorretor.atrasados} tarefas atrasadas`,
        action: {
          tipo: "filtrar_kanban",
          filtros: { corretor_id: piorCorretor.corretor_id, status_lead: "tarefa_atrasada" },
        },
      });
    }

    const totalSemContato = rows.reduce((sum, r) => sum + (r.sem_contato_5d || 0), 0);
    if (totalSemContato >= 10) {
      alertas.push({
        id: "time-sem-contato",
        tipo: "amber",
        icone: "⚠️",
        texto: `${totalSemContato} leads sem contato há 5+ dias no time`,
        action: { tipo: "filtrar_kanban", filtros: { status_lead: "desatualizado" } },
      });
    }

    return alertas.slice(0, 3);
  }, [rows]);
}
