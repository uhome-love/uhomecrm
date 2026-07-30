/**
 * _shared/novoInteresseUpdate.ts
 *
 * Monta o payload de atualização quando um lead JÁ EXISTENTE recebe um novo
 * touch (novo interesse) vindo de qualquer receiver.
 *
 * Regra: o lead passa a ser rotulado pelo empreendimento/campanha do NOVO
 * interesse — nunca fica preso à campanha original. Se o novo touch não
 * resolveu um empreendimento útil, mantém o valor antigo.
 *
 * Os campos canônicos (empreendimento_canonico_id) são recalculados pelos
 * triggers `a_resolve_empreendimento_canonico` e `trg_pl_empreendimento_canonico`.
 */

const EMPREENDIMENTO_GENERICO = /^(avulso|avulso\s*-\s*.*|indefinido|outros?|n\/a|-)$/i;

export function isEmpreendimentoUtil(nome?: string | null): boolean {
  const v = (nome ?? "").trim();
  if (!v) return false;
  return !EMPREENDIMENTO_GENERICO.test(v);
}

export interface NovoInteresseInput {
  /** Empreendimento resolvido pelo novo touch (pode ser genérico/nulo) */
  empreendimentoNovo?: string | null;
  /** Empreendimento atualmente gravado no lead */
  empreendimentoAtual?: string | null;
  /** Observações atuais do lead (para preservar histórico) */
  observacoesAtuais?: string | null;
  /** Ex.: "Meta Ads direto", "Landing Page", "RD Station", "ImovelWeb" */
  origemLabel: string;
  /** Valor para a coluna `origem` (ex.: "meta_ads", "site_uhome") */
  origem?: string | null;
  /** Campos de rastreio trazidos pelo novo touch */
  campos?: {
    campanha?: string | null;
    campanha_id?: string | null;
    origem_detalhe?: string | null;
    formulario?: string | null;
    form_id?: string | null;
    form_name?: string | null;
    plataforma?: string | null;
  };
  /** Mensagem livre do lead */
  mensagem?: string | null;
  /** Sufixo extra na linha de histórico (ex.: "| Cód: 12345") */
  sufixo?: string | null;
}

export interface NovoInteresseResult {
  payload: Record<string, unknown>;
  /** Rótulo do interesse atual (novo se útil, senão o antigo) */
  interesseLabel: string;
  /** true quando o empreendimento do lead mudou */
  empreendimentoAtualizado: boolean;
}

export function buildNovoInteresseUpdate(input: NovoInteresseInput): NovoInteresseResult {
  const todayStamp = new Date().toISOString().slice(0, 10);
  const novo = (input.empreendimentoNovo ?? "").trim();
  const atual = (input.empreendimentoAtual ?? "").trim();
  const usaNovo = isEmpreendimentoUtil(novo) && novo.toLowerCase() !== atual.toLowerCase();

  const interesseLabel = isEmpreendimentoUtil(novo) ? novo : atual || "mesmo imóvel";

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (usaNovo) {
    payload.empreendimento = novo;
    if (input.origem) payload.origem = input.origem;
    const c = input.campos ?? {};
    // Só sobrescreve campos de rastreio que o novo touch realmente trouxe.
    for (const [k, v] of Object.entries(c)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") payload[k] = v;
    }
  }

  const prevObs = (input.observacoesAtuais ?? "").trim();
  const separator = prevObs ? "\n---\n" : "";
  const deParaSuffix = usaNovo && atual ? ` — antes: ${atual}` : "";
  const linha =
    `[NOVO INTERESSE ${todayStamp}] ${interesseLabel} (${input.origemLabel})` +
    `${input.sufixo ? ` ${input.sufixo}` : ""}` +
    `${input.mensagem ? ` — "${input.mensagem}"` : ""}` +
    deParaSuffix;

  payload.observacoes = `${prevObs}${separator}${linha}`;

  return { payload, interesseLabel, empreendimentoAtualizado: usaNovo };
}
