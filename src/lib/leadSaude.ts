// ─────────────────────────────────────────────────────────────────
// leadSaude — espelho TS de public.lead_saude_status (SSOT no banco).
// Saúde do lead pelo ÚLTIMO TOQUE REAL (não por tarefa aberta).
// Relógio: ultimo_toque_at → fallback distribuido_em/created_at.
// "dias sem toque" é tempo absoluto (independe de fuso).
// ─────────────────────────────────────────────────────────────────

export type LeadSaude = "verde" | "ambar" | "vermelho" | "terminal";

/** Prazo "em dia" (dias sem toque) por tipo de etapa. Deve espelhar o SQL. */
const PRAZO_POR_ETAPA: Record<string, number> = {
  novo_lead: 1,
  sem_contato: 2,
  qualificacao: 7,
  aquecimento: 15,
  visita: 2,
  proposta: 7,
  contrato_gerado: 7,
};
const PRAZO_PADRAO = 7;

const TERMINAIS = new Set(["venda", "caiu", "descarte", "convertido"]);

export interface LeadSaudeInput {
  ultimo_toque_at?: string | null;
  /** referência de fallback quando nunca houve toque (distribuido_em, aceito_em, created_at). */
  distribuido_em?: string | null;
  aceito_em?: string | null;
  created_at?: string | null;
  /** tipo da etapa atual (pipeline_stages.tipo). */
  stage_tipo?: string | null;
}

function diasSem(base: string): number {
  const t = new Date(base).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
}

/** Retorna a saúde do lead pelo último toque. Etapas terminais → "terminal". */
export function leadSaude(input: LeadSaudeInput): LeadSaude {
  const tipo = input.stage_tipo ?? "";
  if (TERMINAIS.has(tipo)) return "terminal";

  const base = input.ultimo_toque_at || input.distribuido_em || input.aceito_em || input.created_at;
  if (!base) return "vermelho"; // sem qualquer referência = tratar como frio

  const prazo = PRAZO_POR_ETAPA[tipo] ?? PRAZO_PADRAO;
  const dias = diasSem(base);
  if (dias <= prazo) return "verde";
  if (dias <= prazo * 2) return "ambar";
  return "vermelho";
}

/** Dias inteiros desde o último toque (para tooltip/label). */
export function diasSemToque(input: LeadSaudeInput): number | null {
  const base = input.ultimo_toque_at || input.distribuido_em || input.aceito_em || input.created_at;
  if (!base) return null;
  return Math.floor(diasSem(base));
}

export interface SaudeVisual {
  cor: LeadSaude;
  label: string;
  /** classe de fundo/borda para o indicador (tokens do design system). */
  dot: string;
}

const VISUAL: Record<LeadSaude, SaudeVisual> = {
  verde: { cor: "verde", label: "Em dia", dot: "bg-success-500" },
  ambar: { cor: "ambar", label: "Esfriando", dot: "bg-warning-500" },
  vermelho: { cor: "vermelho", label: "Frio", dot: "bg-danger-500" },
  terminal: { cor: "terminal", label: "", dot: "bg-transparent" },
};

export function saudeVisual(input: LeadSaudeInput): SaudeVisual {
  return VISUAL[leadSaude(input)];
}
