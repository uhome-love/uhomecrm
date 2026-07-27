/**
 * Fases canônicas de `public.negocios` (pós-migração).
 * Fonte única de verdade — nunca comparar contra nomes legados
 * ("vendido", "assinado", "proposta", "novo_negocio", "negociacao",
 *  "documentacao", "aprovacao").
 *
 * A tabela `negocios` agora usa 3 fases + coluna `status` separada
 * para lost/cancelled/arquivado.
 *
 *   fase:   'em_negociacao' | 'contrato' | 'ganho'
 *   status: 'ativo' | 'perdido' | 'arquivado'
 */

export type NegocioFase = "em_negociacao" | "contrato" | "ganho";
export type NegocioStatus = "ativo" | "perdido" | "arquivado";

export const FASE_EM_NEGOCIACAO: NegocioFase = "em_negociacao";
export const FASE_CONTRATO: NegocioFase = "contrato";
export const FASE_GANHO: NegocioFase = "ganho";

/** Todas as fases ativas do negócio (WIP + ganho). */
export const FASES_TODAS: NegocioFase[] = [
  "em_negociacao",
  "contrato",
  "ganho",
];

/** Fases que representam trabalho em progresso (não fechado). */
export const FASES_WIP: NegocioFase[] = ["em_negociacao", "contrato"];

/** Fases que representam venda concluída/assinada. */
export const FASES_GANHO: NegocioFase[] = ["ganho"];

/**
 * Mapeia nomes legados de fase para o canônico atual.
 * Útil quando ainda há dados históricos vindo de views/exportações.
 */
export function canonicalizarFase(input?: string | null): NegocioFase | null {
  if (!input) return null;
  const v = input.toLowerCase();
  if (v === "ganho" || v === "vendido" || v === "assinado") return "ganho";
  if (v === "contrato" || v === "contrato_gerado") return "contrato";
  if (
    v === "em_negociacao" ||
    v === "novo_negocio" ||
    v === "proposta" ||
    v === "negociacao" ||
    v === "documentacao" ||
    v === "aprovacao"
  )
    return "em_negociacao";
  return null;
}

/** Label amigável por fase canônica. */
export const FASE_LABEL: Record<NegocioFase, string> = {
  em_negociacao: "Em Negociação",
  contrato: "Contrato",
  ganho: "Ganho",
};

/** Emoji por fase canônica (alinhado ao pipeline). */
export const FASE_EMOJI: Record<NegocioFase, string> = {
  em_negociacao: "🤝",
  contrato: "📄",
  ganho: "🏆",
};
