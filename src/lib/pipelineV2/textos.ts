// ─────────────────────────────────────────────────────────────────
// pipelineV2/textos — textos curtos do card novo do Pipeline.
// Funções puras (sem React, sem Supabase), cobertas por testes.
// ─────────────────────────────────────────────────────────────────
import { getLeadSubstatusBadge } from "@/lib/leadHelpers";

/**
 * Nome do produto sem o nome da campanha.
 * "Open Bosque - v4" → "Open Bosque"; "Casa Tua Canoas | RMKT Quente 60D" → "Casa Tua Canoas";
 * "Casa Tua Canoas v6 - Final" → "Casa Tua Canoas"; "open" → "Open".
 */
export function produtoLimpo(raw: string | null | undefined): string {
  if (!raw) return "";
  // Lista deduplicada ("A · B") → fica o primeiro produto.
  let s = raw.split(/[·,;]/)[0] ?? "";
  // Corta no primeiro separador de campanha: " - ", " – ", " — " ou " | ".
  s = s.split(/\s+[-–—|]\s+/)[0] ?? "";
  // Tira versão de campanha no fim ("v6", "V2 Final").
  s = s.replace(/\s+v\d+\b.*$/i, "");
  // Tira observações entre parênteses.
  s = s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (s && s === s.toLowerCase()) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

/** "Luiza Clós" → "Luiza C."; "Roni" → "Roni"; "" → "". */
export function nomeCurto(nome: string | null | undefined): string {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1].charAt(0).toUpperCase()}.`;
}

const EMOJI_INICIAL = /^[\p{Extended_Pictographic}️‍\s]+/u;

/**
 * Situação do lead em texto curto, sem emoji, para a linha "produto · situação".
 * Usa getLeadSubstatusBadge (fonte única dos sub-status) e só ajusta a redação.
 */
export function situacaoTexto(
  flagStatus: Record<string, string> | null | undefined,
  stageTipo: string | null | undefined,
): string {
  const badge = getLeadSubstatusBadge(flagStatus, stageTipo);
  if (!badge) return "";
  if (stageTipo === "visita" && flagStatus?.status_visita === "no_show") return "não veio na visita";
  if (stageTipo === "pos_visita" && flagStatus?.interesse) {
    const mapa: Record<string, string> = { alto: "interesse alto", medio: "interesse médio", baixo: "interesse baixo" };
    if (mapa[flagStatus.interesse]) return mapa[flagStatus.interesse];
  }
  if (stageTipo === "aquecimento") {
    const n = parseInt(flagStatus?.prazo || "", 10);
    if (Number.isFinite(n) && n > 0) return `retomar em ${n} dias`;
  }
  const semEmoji = badge.label.replace(EMOJI_INICIAL, "").trim();
  return semEmoji ? semEmoji.charAt(0).toLowerCase() + semEmoji.slice(1) : "";
}

/** Junta produto e situação: "Open Bosque · alinhando visita". */
export function linhaProduto(produto: string, situacao: string): string {
  return [produto, situacao].filter(Boolean).join(" · ");
}

export type SaudeCard = "verde" | "ambar" | "vermelho" | "estagnado" | "terminal";

/** Texto do rodapé do card a partir da saúde por toque (leadSaude) e dos dias sem toque. */
export function saudeTexto(saude: SaudeCard | string, dias: number | null, temAtividade: boolean): string {
  if (!temAtividade) return "sem atividade ainda";
  if (dias === null || dias <= 0) return "atividade hoje";
  if (dias === 1) return "atividade ontem";
  if (saude === "verde" || saude === "terminal") return `atividade há ${dias}d`;
  return `${dias}d sem atividade`;
}

/** Telefone só com dígitos, com DDI 55, para wa.me e tel:. Vazio se não houver número. */
export function telefoneInternacional(raw: string | null | undefined): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

/** (51) 99999-9999 */
export function telefoneFormatado(raw: string | null | undefined): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  const local = (d.length === 13 || d.length === 12) && d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return String(raw ?? "");
}

/** Emoji da etapa pelo TIPO (não pelo nome — o nome pode mudar, como Qualificação → Atendimento). */
export const EMOJI_POR_TIPO: Record<string, string> = {
  novo_lead: "🆕",
  sem_contato: "🚫",
  qualificacao: "💬",
  aquecimento: "🔥",
  visita: "🏠",
  pos_visita: "💰",
  documentacao: "📄",
  proposta: "📤",
  contrato_gerado: "✍️",
  venda: "🏆",
  descarte: "🗑️",
  caiu: "📉",
  convertido: "🤝",
};
