/**
 * Fonte ÚNICA de motivos de descarte / inativação — Onda 0, Parte A (2026-08-05).
 *
 * Antes existiam 4 listas divergentes:
 *  - DiscardLeadDialog.tsx (texto puro)
 *  - PipelineLeadDetail.tsx (texto puro)
 *  - task-completion/types.ts (code + label)
 *  - PipelineStageTransitionPopup.tsx (códigos próprios)
 *
 * Agora todas consomem esta constante. Os `code` já usados em
 * `task-completion/types.ts` foram PRESERVADOS para não invalidar payloads antigos.
 *
 * `tipo` é o destino canônico do motivo:
 *   - 'reengajavel' → lead vai para Descarte (nutrição / oferta ativa podem reengajar)
 *   - 'definitivo'  → lead é arquivado (fica fora de tudo)
 *
 * O texto gravado em `pipeline_leads.motivo_descarte` continua vindo de
 * `buildMotivoDescarte()` (src/lib/leadOutcome.ts). O código estável vai em
 * `pipeline_leads.motivo_descarte_code`.
 */

export type DiscardTipo = "reengajavel" | "definitivo";

export interface DiscardReason {
  readonly code: string;
  readonly label: string;
  readonly emoji: string;
  readonly tipo: DiscardTipo;
  /** `outro` aparece nas duas listas (reengajável e definitivo). */
  readonly both?: boolean;
}

export const DISCARD_REASONS: ReadonlyArray<DiscardReason> = [
  // ── Reengajáveis (podem voltar via Base Única → Oferta Ativa / nutrição) ──
  { code: "nao_atende", label: "Não atende / não responde", emoji: "📞", tipo: "reengajavel" },
  { code: "sem_interesse_momento", label: "Sem interesse no momento", emoji: "😐", tipo: "reengajavel" },
  { code: "sem_condicao_financeira", label: "Sem condição financeira", emoji: "💸", tipo: "reengajavel" },
  { code: "sem_perfil", label: "Sem perfil para o produto", emoji: "🎯", tipo: "reengajavel" },
  { code: "imovel_nao_atende", label: "Imóvel não atende necessidade", emoji: "🏚️", tipo: "reengajavel" },
  { code: "desistiu_compra", label: "Desistiu da compra", emoji: "🚪", tipo: "reengajavel" },

  // ── Definitivos (arquivam o lead) ──
  { code: "nao_quer_contato", label: "Não quer mais contato", emoji: "🚫", tipo: "definitivo" },
  { code: "contato_invalido", label: "Contato errado / Número inválido", emoji: "📵", tipo: "definitivo" },
  { code: "lgpd", label: "Solicitou retirada (LGPD)", emoji: "🗑️", tipo: "definitivo" },
  { code: "lead_antigo", label: "Lead antigo sem retorno", emoji: "🕰️", tipo: "definitivo" },
  { code: "comprou_outro", label: "Comprou com outro", emoji: "🤝", tipo: "definitivo" },
  { code: "duplicado", label: "Lead duplicado", emoji: "👥", tipo: "definitivo" },

  // ── Coringa (aparece nas duas listas) ──
  { code: "outro", label: "Outro (especificar)", emoji: "✏️", tipo: "reengajavel", both: true },
];

/** Motivos exibidos quando o destino é "descartar" (reengajável). */
export const DISCARD_REASONS_REENGAJAVEL: ReadonlyArray<DiscardReason> =
  DISCARD_REASONS.filter((r) => r.tipo === "reengajavel");

/** Motivos exibidos quando o destino é "inativar" (definitivo) + o coringa "outro". */
export const DISCARD_REASONS_DEFINITIVO: ReadonlyArray<DiscardReason> = [
  ...DISCARD_REASONS.filter((r) => r.tipo === "definitivo"),
  ...DISCARD_REASONS.filter((r) => r.both),
];

export function getReasonByCode(code?: string | null): DiscardReason | null {
  if (!code) return null;
  return DISCARD_REASONS.find((r) => r.code === code) ?? null;
}

/** Rótulo com emoji, para usar direto em <SelectItem>. */
export function reasonDisplay(r: DiscardReason): string {
  return `${r.emoji} ${r.label}`;
}

/* ─────────── Classificador determinístico do texto legado ─────────── */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Regras aplicadas na MESMA ordem do backfill SQL (migration 2026-08-05).
 * Classifica pelo CONTEÚDO do motivo, nunca pelo prefixo "Descartado:"/"Inativado:".
 * Retorna `null` quando não há correspondência confiável.
 */
const RULES: ReadonlyArray<{ code: string; test: (m: string) => boolean }> = [
  { code: "lgpd", test: (m) => m.includes("lgpd") || m.includes("retirada do nome") || m.includes("retirar o nome") },
  {
    code: "contato_invalido",
    test: (m) =>
      m.includes("contato errado") || m.includes("numero invalido") || m.includes("telefone invalido") ||
      m.includes("contato invalido") || m.includes("numero errado"),
  },
  {
    code: "nao_quer_contato",
    test: (m) => m.includes("nao quer mais contato") || m.includes("nao quer contato") || m.includes("pediu para nao"),
  },
  { code: "duplicado", test: (m) => m.includes("duplicad") },
  {
    code: "comprou_outro",
    test: (m) => m.includes("comprou com outro") || m.includes("comprou outro") || m.includes("comprou_outro") || m.includes("comprou com a concorr"),
  },
  { code: "desistiu_compra", test: (m) => m.includes("desist") },
  { code: "sem_perfil", test: (m) => m.includes("sem perfil") || m.includes("sem_perfil") },
  {
    code: "sem_condicao_financeira",
    test: (m) =>
      /sem condi\w* financ/.test(m) || m.includes("nao tem renda") || m.includes("credito negado") ||
      m.includes("nao aprovou credito") || /restri\w*o no nome/.test(m),
  },
  {
    code: "imovel_nao_atende",
    test: (m) => m.includes("imovel nao atende") || m.includes("nao atende necessidade") || m.includes("nao gostou do imovel"),
  },
  { code: "sem_interesse_momento", test: (m) => m.includes("sem interesse") || m.includes("nao tem interesse") || m.includes("sem_interesse") },
  {
    code: "lead_antigo",
    test: (m) => m.includes("lead antigo") || m.includes("leads antigos") || m.includes("base antiga") || m.includes("limpeza de base"),
  },
  {
    code: "nao_atende",
    test: (m) =>
      m.includes("nao atende") || m.includes("nao responde") || m.includes("sem retorno") ||
      m.includes("sem contato") || m.includes("nao atendeu"),
  },
];

export function classifyMotivoText(texto?: string | null): string | null {
  if (!texto) return null;
  const m = norm(texto.replace(/^(descartado|descarte|inativado)\s*:\s*/i, ""));
  if (!m) return null;
  for (const rule of RULES) if (rule.test(m)) return rule.code;
  return null;
}
