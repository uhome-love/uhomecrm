// =============================================================================
// Helpers de estado dinâmico da roleta (baseados em roleta_presencas)
//
// Regras de presença (Jul/2026):
// - Falta = registro EXPLÍCITO do gestor (botão "Faltou"). Sem row = "sem marcar".
// - Credenciado sem row = "na_empresa" (rede de segurança, trigger normalmente cria).
// - Gestor pode registrar/editar durante todo o dia.
// - Regime por dia da semana:
//    · Seg-Sex: presencial (manhã + tarde). Noturna = auto (só quem participa).
//    · Sábado : híbrido — presente quem tem visita/plantão OU credenciamento.
//    · Domingo: remoto — presente = credenciado aprovado na roleta de domingo.
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

export type EstadoCorretor =
  | "saiu"
  | "na_empresa"
  | "na_roleta"
  | "falta"
  | "sem_marcar";

export interface EstadoTurno {
  turno: PresencaTurno;
  estado: EstadoCorretor;
  presenca?: PresencaRow;
}

/**
 * Deriva estado do corretor em um turno específico.
 * - presença 'saiu'      → saiu
 * - presença 'na_empresa' → na_empresa
 * - presença 'falta'      → falta (registro EXPLÍCITO do gestor)
 * - sem presença mas credenciado → na_empresa (rede de segurança)
 * - sem presença e sem credenciamento → sem_marcar (gestor precisa validar)
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
  return temCredenciamento ? "na_empresa" : "sem_marcar";
}

export const ESTADO_LABEL: Record<EstadoCorretor, string> = {
  na_roleta: "Na roleta",
  na_empresa: "Presente",
  saiu: "Saiu",
  falta: "Faltou",
  sem_marcar: "Sem marcar",
};

export const ESTADO_CLASSES: Record<EstadoCorretor, string> = {
  na_roleta: "bg-muted text-muted-foreground border border-border",
  na_empresa: "bg-success-500/15 text-success-700 border border-success-500/30",
  saiu: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30",
  falta: "bg-destructive/10 text-destructive border border-destructive/30",
  sem_marcar: "bg-muted text-muted-foreground border border-border",
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

// =============================================================================
// Regime por dia da semana
// =============================================================================
export type RegimeDia = "seg_sex" | "sabado" | "domingo";

export interface RegimeInfo {
  regime: RegimeDia;
  label: string;
  turnosMarcaveis: PresencaTurno[]; // turnos onde o gestor marca manual
  mostrarNoturnaAuto: boolean;      // seg-sex: exibir noturna como derivada
}

/** dataBRT no formato YYYY-MM-DD. */
export function getRegimeDoDia(dataBRT: string): RegimeInfo {
  // Cria Date interpretando como meio-dia BRT pra evitar edge de fuso.
  const d = new Date(`${dataBRT}T12:00:00-03:00`);
  const dow = d.getDay(); // 0=dom, 6=sáb
  if (dow === 0) {
    return {
      regime: "domingo",
      label: "Domingo · roleta de casa",
      turnosMarcaveis: [],
      mostrarNoturnaAuto: false,
    };
  }
  if (dow === 6) {
    return {
      regime: "sabado",
      label: "Sábado · visita/plantão ou roleta",
      turnosMarcaveis: [],
      mostrarNoturnaAuto: false,
    };
  }
  return {
    regime: "seg_sex",
    label: "Seg a sex · presencial",
    turnosMarcaveis: ["manha", "tarde"],
    mostrarNoturnaAuto: true,
  };
}
