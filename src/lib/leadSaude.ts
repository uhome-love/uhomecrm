// ─────────────────────────────────────────────────────────────────
// leadSaude — espelho TS de public.lead_saude_status (SSOT no banco).
// Saúde do lead pelo ÚLTIMO TOQUE REAL (não por tarefa aberta).
// Relógio: ultimo_toque_at → fallback distribuido_em/created_at.
// "dias sem toque" é tempo absoluto (independe de fuso).
// ─────────────────────────────────────────────────────────────────

// Saúde = ATENÇÃO DO CORRETOR com o lead (não temperatura do cliente).
export type LeadSaude = "verde" | "ambar" | "vermelho" | "estagnado" | "terminal";

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

/**
 * Estagnação (dias sem toque) — vira "ponto de decisão", só nas etapas que
 * estagnam. Sem Contato é por cadência (Fase 2); aqui uso uma aproximação.
 */
const ESTAGNA_POR_ETAPA: Record<string, number> = {
  sem_contato: 15,
  qualificacao: 21,
  aquecimento: 21,
};

const TERMINAIS = new Set(["venda", "caiu", "descarte", "convertido"]);

export interface LeadSaudeInput {
  ultimo_toque_at?: string | null;
  /** referência de fallback quando nunca houve toque (distribuido_em, aceito_em, created_at). */
  distribuido_em?: string | null;
  aceito_em?: string | null;
  created_at?: string | null;
  /** tipo da etapa atual (pipeline_stages.tipo). */
  stage_tipo?: string | null;
  /**
   * Carência ÚNICA de transição (YYYY-MM-DD). Enquanto hoje <= esta data, o lead
   * NÃO estagna (vira "ambar"), mesmo passando do prazo. Espelha a régua de 4 args
   * do SQL (public.lead_saude_status). NULL = sem carência (régua crua). Expira sozinha.
   */
  estagnacao_carencia_ate?: string | null;
}

function diasSem(base: string): number {
  const t = new Date(base).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
}

/**
 * Relógio da saúde. Regra: o toque só conta se aconteceu DEPOIS que o lead
 * chegou ao corretor atual. Lead reciclado/redistribuído carrega
 * `ultimo_toque_at` do ciclo anterior — sem isso ele nascia "estagnado" na mão
 * do novo corretor e sumia do board (bug Joyce Brazil, 31/08/2026).
 */
function relogioBase(input: LeadSaudeInput): string | null {
  const ref = input.distribuido_em || input.aceito_em || input.created_at || null;
  const toque = input.ultimo_toque_at || null;
  if (!toque) return ref;
  if (!ref) return toque;
  return new Date(toque).getTime() >= new Date(ref).getTime() ? toque : ref;
}

/** Data de hoje em BRT no formato ISO (YYYY-MM-DD) — para comparar com a carência. */
function hojeBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Retorna a saúde do lead pelo último toque. Etapas terminais → "terminal". */
export function leadSaude(input: LeadSaudeInput): LeadSaude {
  const tipo = input.stage_tipo ?? "";
  if (TERMINAIS.has(tipo)) return "terminal";

  const base = relogioBase(input);
  if (!base) return "vermelho"; // sem qualquer referência = desatualizado

  const dias = diasSem(base);

  const limiteEstagna = ESTAGNA_POR_ETAPA[tipo];
  if (limiteEstagna != null && dias > limiteEstagna) {
    // Carência de transição: com prazo concedido não estagna — vira atenção (amarelo).
    if (input.estagnacao_carencia_ate && input.estagnacao_carencia_ate >= hojeBRT()) return "ambar";
    return "estagnado";
  }

  const prazo = PRAZO_POR_ETAPA[tipo] ?? PRAZO_PADRAO;
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
  ambar: { cor: "ambar", label: "Atenção", dot: "bg-warning-500" },
  vermelho: { cor: "vermelho", label: "Desatualizado", dot: "bg-danger-500" },
  estagnado: { cor: "estagnado", label: "Estagnado", dot: "bg-violet-500" },
  terminal: { cor: "terminal", label: "", dot: "bg-transparent" },
};

export function saudeVisual(input: LeadSaudeInput): SaudeVisual {
  return VISUAL[leadSaude(input)];
}

/**
 * Classificação compatível com LeadClientStatus (em_dia/desatualizado/tarefa_atrasada),
 * porém pela SAÚDE POR TOQUE — não por tarefa. Drop-in dos call-sites do Pipeline:
 *   verde/terminal → em_dia · ambar (esfriando) → desatualizado · vermelho (frio) → tarefa_atrasada.
 * Assinatura de 3 args igual a getLeadStatusFilter (o 2º arg, tarefa, é ignorado).
 */
export function leadSaudeClientStatus(
  lead: LeadSaudeInput,
  _proximaTarefa?: unknown,
  stageTipo?: string
): "em_dia" | "desatualizado" | "tarefa_atrasada" {
  const s = leadSaude({ ...lead, stage_tipo: stageTipo ?? lead.stage_tipo });
  if (s === "verde" || s === "terminal") return "em_dia";
  if (s === "ambar") return "desatualizado";
  return "tarefa_atrasada"; // vermelho + estagnado
}
