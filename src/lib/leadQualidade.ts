/**
 * Classificação de QUALIDADE de lead por EXCLUSÃO — usado apenas no relatório
 * de performance por origem. NÃO grava nem altera nada no CRM: é derivado em
 * tempo de leitura a partir de `motivo_descarte` / `tipo_descarte` já existentes.
 *
 * Grupos:
 *  - 'desqualificado' → descartado por MÁ QUALIDADE (sem renda, sem perfil,
 *    contato inválido, não atende/não responde, bloqueou, sem interesse).
 *  - 'qualificado' → teve primeiro contato E não é má qualidade. Inclui também
 *    descartes de DESCASAMENTO DE OFERTA (quer aluguel, comprou outro, desistiu),
 *    porque o lead era bom — só não fechou aqui.
 *  - 'neutro' → descarte operacional / LGPD / limpeza / reengajamento / outro
 *    (não é julgamento de qualidade) → EXCLUÍDO do cálculo de taxa.
 *  - 'pendente' → sem primeiro contato E sem descarte (ainda não triado).
 *
 * taxa_qualificacao = qualificados / (qualificados + desqualificados)
 * (pendentes e neutros ficam fora do denominador).
 */

export type QualidadeGrupo = "qualificado" | "desqualificado" | "neutro" | "pendente";

/** Normaliza o motivo: remove prefixo (Descartado:/Descarte:/Inativado:) e o
 * sufixo "| Empreendimento: ...", baixa caixa e apara. */
export function normalizarMotivo(motivo?: string | null): string {
  if (!motivo) return "";
  return motivo
    .toLowerCase()
    .replace(/^\s*(descartado|descarte|inativado)\s*:\s*/i, "")
    .replace(/\s*\|\s*empreendimento:.*$/i, "")
    .trim();
}

// Descasamento de oferta / lead era bom (conta como QUALIFICADO mesmo descartado).
const KW_DESCASAMENTO = [
  "quer aluguel",
  "aluguel",
  "imóvel não atende",
  "imovel nao atende",
  "não atende necessidade",
  "nao atende necessidade",
  "comprou outro",
  "comprou com concorrente",
  "concorrente",
  "já comprou",
  "ja comprou",
  "desistiu",
  "desistiu da compra",
];

// Má qualidade → DESQUALIFICADO.
const KW_DESQUALIFICADO = [
  "sem condição financeira",
  "sem condicao financeira",
  "sem renda",
  "sem perfil",
  "perfil incompat",
  "número inválido",
  "numero invalido",
  "contato errado",
  "não atende",
  "nao atende",
  "não responde",
  "nao responde",
  "sem retorno",
  "sem contato",
  "me bloqueou",
  "fui bloqueado",
  "bloqueou",
  "block",
  "sem interesse",
];

// Operacional / opt-out / limpeza → NEUTRO (fora do cálculo).
const KW_NEUTRO = [
  "não quer mais contato",
  "nao quer mais contato",
  "retirada do nome",
  "retirada (lgpd)",
  "lgpd",
  "solicitou retirada",
  "corretor inativado",
  "estagnação",
  "estagnacao",
  "limpeza",
  "limpa do sistema",
  "reengajamento",
  "auto-limpeza",
  "átrio",
  "atrio",
  "sem previsibilidade",
  "outro motivo",
  "outro",
];

function matchAny(motivo: string, kws: string[]): boolean {
  return kws.some((k) => motivo.includes(k));
}

export interface QualidadeInput {
  motivo_descarte?: string | null;
  tipo_descarte?: string | null;
  /**
   * @deprecated Coluna `pipeline_leads.primeiro_contato_em` (v1) está morta (0% preenchida).
   * Passe `teve_contato` computado via v3 (stage.ordem>=1 OR whatsapp_out OR atividade de contato).
   * Mantido só para compat de callers antigos.
   */
  primeiro_contato_em?: string | null;
  /** Fonte canônica v3 — quando fornecida, prevalece sobre primeiro_contato_em. */
  teve_contato?: boolean | null;
}

function resolveTeveContato(lead: QualidadeInput): boolean {
  if (typeof lead.teve_contato === "boolean") return lead.teve_contato;
  return !!lead.primeiro_contato_em;
}

export function classificarQualidade(lead: QualidadeInput): QualidadeGrupo {
  const motivo = normalizarMotivo(lead.motivo_descarte);
  const temDescarte = motivo.length > 0 || !!lead.tipo_descarte;

  if (temDescarte) {
    // Ordem importa: descasamento (bom) antes de má qualidade.
    if (matchAny(motivo, KW_DESCASAMENTO)) return "qualificado";
    if (matchAny(motivo, KW_DESQUALIFICADO)) return "desqualificado";
    if (matchAny(motivo, KW_NEUTRO)) return "neutro";
    // Descarte sem motivo reconhecível → neutro (indefinido).
    return "neutro";
  }

  // Sem descarte: qualificado se teve triagem (v3), senão pendente.
  return resolveTeveContato(lead) ? "qualificado" : "pendente";
}

/** true quando não há sinal de contato v3 (nunca entra no tempo médio). */
export function semRegistroContato(lead: QualidadeInput): boolean {
  return !resolveTeveContato(lead);
}


/** taxa de qualificação = qualif / (qualif + desqualif); null se denominador 0. */
export function taxaQualificacao(qualificados: number, desqualificados: number): number | null {
  const den = qualificados + desqualificados;
  return den === 0 ? null : qualificados / den;
}
