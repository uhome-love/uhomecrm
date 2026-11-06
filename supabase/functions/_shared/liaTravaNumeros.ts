/**
 * Trava de números da Lia — regra do Lucas (06/11/2026):
 * qualquer número na resposta (R$, %, parcelas, prazo, metragem, data, renda) só sai se estiver
 * na ficha do imóvel, no catálogo do Natal ou dito pelo cliente na conversa.
 * Formatos equivalentes contam igual ("R$ 240 mil" = "240.000", "2,48 mi" = "2,48 milhões").
 * Arquivo puro: usado pela lia-chat (conversas reais e Laboratório) e pelos testes do front.
 */

export const FRASE_ENTRADA = "O especialista monta o parcelamento da entrada certinho pra você.";
export const FRASE_GENERICA = "Esse detalhe o especialista confirma certinho pra você.";
export const PERGUNTA_DIRECIONAMENTO = "Quer que eu já peça pra ele te chamar por aqui?";

const HORA = 1e12;
const VEZES = 2e12;
const RE_NUM = /(\d+(?:[.,]\d+)*)(\s*(?:milh[õo]es|milh[ãa]o|mil|mi)\b)?/gi;

function parseNumero(bruto: string): number[] {
  // "240.000" / "1.000.000" → milhar; "46,70" / "2,48" → decimal; "18/12" chega separado.
  if (/^\d{1,3}(\.\d{3})+$/.test(bruto)) return [Number(bruto.replace(/\./g, ""))];
  if (/^\d+(,\d+)$/.test(bruto)) return [Number(bruto.replace(",", "."))];
  if (/^\d+(\.\d{1,2})$/.test(bruto)) return [Number(bruto)];
  if (/^\d+$/.test(bruto)) return [Number(bruto)];
  // formatos mistos ("1.234,56")
  const n = Number(bruto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? [n] : [];
}

/** Todos os números de um texto, já na forma canônica (mil/milhão multiplicados). */
export function numerosDe(texto: string): number[] {
  const t = texto.replace(/\[\[[^\]]*\]\]/g, " ");
  const out: number[] = [];
  RE_NUM.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_NUM.exec(t))) {
    const unidade = (m[2] || "").trim().toLowerCase();
    const mult = unidade === "mil" ? 1000 : unidade.startsWith("mi") ? 1_000_000 : 1;
    // unidades que mudam o sentido do número ganham "espaço" próprio: 9h ≠ R$ 9 mil, 24 vezes ≠ 24 m²
    const depois = t.slice(RE_NUM.lastIndex, RE_NUM.lastIndex + 10).toLowerCase();
    const ns = /^\s*(h\b|h\d|hs\b|horas?\b)/.test(depois) ? HORA : /^\s*(x\b|vezes\b|parcelas?\b|presta[çc])/.test(depois) ? VEZES : 0;
    for (const n of parseNumero(m[1])) out.push(ns + Math.round(n * mult * 100) / 100);
  }
  return out;
}

/** Números permitidos: ficha + catálogo (no prompt) + falas da conversa. */
export function permitidos(fontes: string[]): Set<number> {
  const s = new Set<number>();
  for (const f of fontes) for (const n of numerosDe(f)) s.add(n);
  return s;
}

/** Números da resposta que não estão nas fontes. */
export function numerosFora(resposta: string, ok: Set<number>): number[] {
  return [...new Set(numerosDe(resposta).filter((n) => !ok.has(n)))].map((n) => n >= VEZES ? n - VEZES : n >= HORA ? n - HORA : n);
}

/** Troca as bolhas com número fora pela frase do assunto; garante uma pergunta de direcionamento no fim. */
export function substituirBolhas(resposta: string, ok: Set<number>): string {
  const bolhas = resposta.split(/\s*\|\|\|\s*/);
  const out: string[] = [];
  for (const b of bolhas) {
    const marcadores = (b.match(/\[\[[^\]]*\]\]/g) ?? []).join(" ");
    if (numerosFora(b, ok).length === 0) { out.push(b); continue; }
    const frase = /entrada/i.test(b) ? FRASE_ENTRADA : FRASE_GENERICA;
    if (!out.some((o) => o.startsWith(frase))) out.push([frase, marcadores].filter(Boolean).join(" "));
    else if (marcadores) out.push(marcadores);
  }
  const ultimaTexto = [...out].reverse().find((o) => o.replace(/\[\[[^\]]*\]\]/g, "").trim());
  if (!ultimaTexto || !/\?\s*$/.test(ultimaTexto.replace(/\[\[[^\]]*\]\]/g, "").trim())) {
    // a pergunta entra antes dos marcadores de sinal/repassar da última bolha
    out.push(PERGUNTA_DIRECIONAMENTO);
  }
  return out.join("|||");
}
