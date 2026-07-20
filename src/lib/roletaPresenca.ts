// =============================================================================
// Helpers de estado dinâmico da roleta (baseados em roleta_presencas)
// =============================================================================

export type PresencaTurno = "manha" | "tarde" | "noturna";
export type PresencaStatus = "na_empresa" | "saiu" | "falta";

export interface PresencaRow {
  id: string;
  corretor_id: string;
  data: string;
  turno: PresencaTurno;
  status: PresencaStatus;
  chegou_em: string | null;
  saiu_em: string | null;
}

export type EstadoCorretor = "saiu" | "na_empresa" | "na_roleta" | "falta";

export interface EstadoTurno {
  turno: PresencaTurno;
  estado: EstadoCorretor;
  presenca?: PresencaRow;
}

/**
 * Deriva estado do corretor em um turno específico.
 * - Se tem presença 'saiu' → saiu (removido da fila)
 * - Se tem presença 'na_empresa' → na_empresa (validado, participando)
 * - Se tem presença 'falta' → falta (não compareceu, fechamento do dia)
 * - Sem presença mas credenciado na roleta → na_empresa (participou da roleta =
 *   presente; o trigger de aprovação já cria a linha, isso é rede de segurança).
 * - Sem presença e sem credenciamento → sem_marcar (gestor precisa validar).
 */
export function derivarEstadoTurno(
  presenca: PresencaRow | undefined,
  temCredenciamento: boolean,
): EstadoCorretor {
  if (presenca) {
    if (presenca.status === "saiu") return "saiu";
    if (presenca.status === "falta") return "falta";
    return "na_empresa";
  }
  return temCredenciamento ? "na_empresa" : "falta";
}

export const ESTADO_LABEL: Record<EstadoCorretor, string> = {
  na_roleta: "Na roleta",
  na_empresa: "Presente",
  saiu: "Saiu",
  falta: "Sem marcar",
};

export const ESTADO_CLASSES: Record<EstadoCorretor, string> = {
  na_roleta: "bg-muted text-muted-foreground border border-border",
  na_empresa: "bg-success-500/15 text-success-700 border border-success-500/30",
  saiu: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30",
  falta: "bg-muted text-muted-foreground border border-border",
};

export const TURNO_LABEL: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noturna: "Noite",
  dia_todo: "Dia todo",
};

/** Expande 'dia_todo' em ['manha','tarde'] para mapear com presenças. */
export function expandirTurnos(turnos: string[]): PresencaTurno[] {
  const out = new Set<PresencaTurno>();
  for (const t of turnos) {
    if (t === "dia_todo") {
      out.add("manha");
      out.add("tarde");
    } else if (t === "manha" || t === "tarde" || t === "noturna") {
      out.add(t);
    }
  }
  return Array.from(out);
}
