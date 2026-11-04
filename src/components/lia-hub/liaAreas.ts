// Estrutura da página da Lia: 6 áreas, cada uma com suas seções.
// As chaves antigas `?aba=` continuam válidas e apontam para a área nova.
export type LiaArea = "visao" | "conversas" | "recuperacao" | "relatorios" | "cerebro" | "config";

export interface LiaSecao { valor: string; rotulo: string }
export interface LiaAreaDef { valor: LiaArea; rotulo: string; descricao: string; secoes: LiaSecao[] }

export const LIA_AREAS: LiaAreaDef[] = [
  { valor: "visao", rotulo: "Visão geral", descricao: "Como a Lia está trabalhando", secoes: [{ valor: "painel", rotulo: "Painel" }] },
  { valor: "conversas", rotulo: "Conversas", descricao: "Atendimento e acompanhamento dos clientes", secoes: [
    { valor: "leads", rotulo: "Lista" },
    { valor: "kanban", rotulo: "Quadro" },
    { valor: "followups", rotulo: "Follow-ups" },
    { valor: "transito", rotulo: "Em trânsito" },
  ] },
  { valor: "recuperacao", rotulo: "Recuperação", descricao: "Clientes descartados que a Lia pode reativar", secoes: [
    { valor: "recupera", rotulo: "Descartes" },
    { valor: "reengajar", rotulo: "Reengajamento" },
    { valor: "mensagens", rotulo: "Mensagens" },
  ] },
  { valor: "relatorios", rotulo: "Relatórios", descricao: "Resultado do contato com a Lia até a venda", secoes: [{ valor: "qualificados", rotulo: "Funil e qualificação" }] },
  { valor: "cerebro", rotulo: "Cérebro", descricao: "O que a Lia sabe e como ela é testada", secoes: [
    { valor: "conhecimento", rotulo: "Conhecimento" },
    { valor: "laboratorio", rotulo: "Laboratório" },
  ] },
  { valor: "config", rotulo: "Configurações", descricao: "Limites, horários e proteção dos envios", secoes: [{ valor: "configuracoes", rotulo: "Parâmetros" }] },
];

export function resolverArea(area: string | null, aba: string | null): { area: LiaAreaDef; secao: string | null } {
  if (aba) {
    const dona = LIA_AREAS.find((a) => a.secoes.some((s) => s.valor === aba));
    if (dona && (!area || area === dona.valor)) return { area: dona, secao: aba };
  }
  const def = LIA_AREAS.find((a) => a.valor === area) ?? LIA_AREAS[0];
  return { area: def, secao: def.secoes[0]?.valor ?? null };
}
