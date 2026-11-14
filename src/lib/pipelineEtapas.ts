/**
 * Verdade única das etapas do Pipeline (espelho de `pipeline_stages` ativas, por ordem).
 * Descarte é botão (fora do quadro); Caiu está desligada; "Em Negociação" não existe mais.
 */
export const PIPELINE_ETAPAS = [
  { tipo: "novo_lead", nome: "Novo Lead" },
  { tipo: "sem_contato", nome: "Sem Contato" },
  { tipo: "qualificacao", nome: "Atendimento" },
  { tipo: "aquecimento", nome: "Aquecimento" },
  { tipo: "visita", nome: "Visita" },
  { tipo: "pos_visita", nome: "Pós-Visita" },
  { tipo: "documentacao", nome: "Documentação" },
  { tipo: "proposta", nome: "Proposta" },
  { tipo: "contrato_gerado", nome: "Contrato" },
  { tipo: "venda", nome: "Ganho" },
] as const;
