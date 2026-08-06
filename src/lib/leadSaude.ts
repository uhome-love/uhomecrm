/**
 * Motor de Atividade — camada VISUAL de saúde por TOQUE REAL (Onda 1, Build 2).
 *
 * IMPORTANTE: isto é SÓ-COR. Nada aqui remove, move ou devolve lead.
 * A régua real de estagnação (get_pipeline_estagnacao / decidir_lead_estagnado)
 * continua lendo `ultima_acao_at` — não é afetada por este arquivo.
 *
 * Função pura: sem query, sem side-effect.
 */

export type SaudeEstado = "em_dia" | "desatualizado" | "em_estagnacao" | "neutro";

export interface SaudeToque {
  estado: SaudeEstado;
  /** Dias corridos desde o último toque humano (fallback: created_at). */
  diasSemToque: number;
}

/** Thresholds por `stage.tipo` (régua Conservador do plano). B=null → sem escalada. */
type Regua = { A: number; B: number | null } | "neutro";

export const SAUDE_THRESHOLDS: Record<string, Regua> = {
  novo_lead: { A: 1, B: null },
  qualificacao: { A: 10, B: 21 },
  aquecimento: { A: 21, B: 45 },
  visita: { A: 3, B: null },
  pos_visita: { A: 5, B: null },
  proposta: { A: 5, B: null },
  negociacao: { A: 5, B: null },
  em_negociacao: { A: 5, B: null },
  contrato: { A: 7, B: null },
  contrato_gerado: { A: 7, B: null },
  // Pausados por definição — sem pílula.
  nutricao: "neutro",
  sem_contato: "neutro", // a cadência de banco governa esta etapa
};

interface LeadLike {
  ultimo_toque_at?: string | null;
  created_at?: string | null;
}

interface TarefaLike {
  vence_em?: string | null;
  hora_vencimento?: string | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / DIA_MS));
}

/**
 * Compromisso marcado no futuro pausa a escalada (trava de justiça):
 * o corretor já agendou o próximo passo, não é "abandono".
 */
function tarefaNoFuturo(tarefa?: TarefaLike | null): boolean {
  if (!tarefa?.vence_em) return false;
  const hora = tarefa.hora_vencimento || "23:59";
  const t = new Date(`${tarefa.vence_em}T${hora.slice(0, 5)}:00-03:00`).getTime();
  if (!Number.isFinite(t)) return false;
  return t > Date.now();
}

/**
 * Saúde por toque humano.
 *
 * TODO (Onda 2): descontar fins de semana e feriados (`public.feriados`) do
 * cálculo de `diasSemToque` — hoje são dias corridos.
 */
export function getSaudeToque(
  lead: LeadLike,
  stageTipo?: string | null,
  proximaTarefa?: TarefaLike | null
): SaudeToque {
  const diasSemToque = diasDesde(lead.ultimo_toque_at ?? lead.created_at ?? null);

  const regua = stageTipo ? SAUDE_THRESHOLDS[stageTipo] : undefined;
  if (!regua || regua === "neutro") return { estado: "neutro", diasSemToque };

  // Trava de justiça: compromisso futuro pausa a escalada.
  if (tarefaNoFuturo(proximaTarefa)) return { estado: "em_dia", diasSemToque };

  const { A, B } = regua;
  if (diasSemToque < A) return { estado: "em_dia", diasSemToque };
  if (B == null) return { estado: "desatualizado", diasSemToque };
  if (diasSemToque < B) return { estado: "desatualizado", diasSemToque };
  return { estado: "em_estagnacao", diasSemToque };
}

export const SAUDE_UI: Record<
  Exclude<SaudeEstado, "neutro">,
  { emoji: string; label: string; pill: string; ring: string }
> = {
  em_dia: {
    emoji: "🟢",
    label: "Em dia",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    ring: "",
  },
  desatualizado: {
    emoji: "🟠",
    label: "Desatualizado",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    ring: "ring-1 ring-amber-400/60",
  },
  em_estagnacao: {
    emoji: "🔴",
    label: "Em estagnação",
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    ring: "ring-1 ring-red-400/70",
  },
};
