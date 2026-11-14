// ─────────────────────────────────────────────────────────────────
// Decide se um arrasto lateral no celular troca de etapa.
// Função pura (sem React) para poder testar.
//   dx < 0 (arrastou para a esquerda)  → próxima etapa  →  1
//   dx > 0 (arrastou para a direita)   → etapa anterior → -1
//   arrasto curto, lento ou mais vertical que horizontal → 0 (fica onde está)
// ─────────────────────────────────────────────────────────────────

export interface SwipeEntrada {
  dx: number;
  dy: number;
  /** largura da área da lista, em px */
  largura: number;
  /** duração do arrasto, em ms */
  ms: number;
}

/** Distância mínima: 22% da largura, no máximo 80px. */
export function limiteSwipe(largura: number): number {
  return Math.min(80, Math.max(40, largura * 0.22));
}

export function decidirSwipe({ dx, dy, largura, ms }: SwipeEntrada): -1 | 0 | 1 {
  const ax = Math.abs(dx);
  if (ax <= Math.abs(dy)) return 0;
  const rapido = ax >= 30 && ax / Math.max(1, ms) >= 0.5;
  if (ax < limiteSwipe(largura) && !rapido) return 0;
  return dx < 0 ? 1 : -1;
}

/** Arrasto além da primeira ou da última etapa: anda 1/3 (efeito de mola). */
export function resistenciaSwipe(dx: number, podeAnterior: boolean, podeProxima: boolean): number {
  if ((dx > 0 && !podeAnterior) || (dx < 0 && !podeProxima)) return dx / 3;
  return dx;
}
