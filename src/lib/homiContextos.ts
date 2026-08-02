/**
 * Contexto do HOMI por página do CRM.
 * Cada rota define um rótulo e atalhos (prompts prontos) daquela tela.
 * Usado pelo botão contextual do HOMI no PageHeader.
 */

export interface HomiContextoPagina {
  /** Rótulo curto da área (aparece no popover) */
  area: string;
  /** Prompts sugeridos para a tela */
  sugestoes: string[];
}

type Regra = { match: RegExp; ctx: HomiContextoPagina };

const REGRAS: Regra[] = [
  {
    match: /^\/pipeline/,
    ctx: {
      area: "Pipeline de Leads",
      sugestoes: [
        "Quais leads do meu pipeline estão parados há mais de 7 dias?",
        "Monte meu plano de ataque de hoje no pipeline",
        "Quais leads estão perto de virar visita?",
      ],
    },
  },
  {
    match: /^\/(agenda|agenda-visitas|visitas)/,
    ctx: {
      area: "Agenda de Visitas",
      sugestoes: [
        "Resuma minhas visitas de hoje e amanhã",
        "Quais visitas ainda não foram confirmadas?",
        "Escreva a mensagem de confirmação de visita para amanhã",
      ],
    },
  },
  {
    match: /^\/(tarefas|central-tarefas)/,
    ctx: {
      area: "Tarefas",
      sugestoes: [
        "Quais tarefas minhas estão atrasadas?",
        "Priorize minhas tarefas de hoje",
        "O que eu preciso fazer antes do fim do dia?",
      ],
    },
  },
  {
    match: /^\/(imoveis|imovel)/,
    ctx: {
      area: "Imóveis",
      sugestoes: [
        "Busque 3 dormitórios até R$ 1,5M na Zona Sul",
        "Compare os empreendimentos que mais convertem",
        "Monte um roteiro de visita com 3 imóveis",
      ],
    },
  },
  {
    match: /^\/(oferta-ativa|corretor\/call|base-leads)/,
    ctx: {
      area: "Oferta Ativa",
      sugestoes: [
        "Monte um script de ligação para essa base",
        "Como contornar a objeção 'não tenho interesse agora'?",
        "Qual o melhor horário para ligar para esses leads?",
      ],
    },
  },
  {
    match: /^\/(central-relatorios|performance|ranking)/,
    ctx: {
      area: "Performance",
      sugestoes: [
        "Resuma o desempenho do mês em 5 linhas",
        "Onde estamos perdendo mais leads no funil?",
        "Compare este mês com o mês passado",
      ],
    },
  },
  {
    match: /^\/(ceo|dashboard-ceo)/,
    ctx: {
      area: "Visão CEO",
      sugestoes: [
        "Faça o briefing executivo de hoje",
        "Quais riscos de VGV para o fechamento do mês?",
        "Quais equipes estão fora da meta?",
      ],
    },
  },
  {
    match: /^\/pdn/,
    ctx: {
      area: "PDN",
      sugestoes: [
        "Qual o forecast do meu PDN para o mês?",
        "Quais negócios estão em risco no PDN?",
        "Resuma o PDN por corretor",
      ],
    },
  },
  {
    match: /^\/(central-nutricao|reengajamento)/,
    ctx: {
      area: "Reengajamento",
      sugestoes: [
        "Qual público faz sentido reengajar esta semana?",
        "Escreva um template de reengajamento curto",
        "Como está a saúde dos disparos?",
      ],
    },
  },
  {
    match: /^\/(materiais|academia)/,
    ctx: {
      area: "Conhecimento Uhome",
      sugestoes: [
        "Explique o método Uhome de atendimento",
        "Resuma o material do empreendimento que eu citar",
        "Me treine com uma simulação de objeção",
      ],
    },
  },
  {
    match: /^\/(central-marketing|dados-anuncios|marketing)/,
    ctx: {
      area: "Marketing",
      sugestoes: [
        "Quais campanhas trouxeram mais visitas?",
        "Qual o custo por lead qualificado por campanha?",
        "O que cortar e o que escalar no investimento?",
      ],
    },
  },
];

const PADRAO: HomiContextoPagina = {
  area: "CRM Uhome",
  sugestoes: [
    "O que eu deveria priorizar agora?",
    "Resuma como está meu dia",
    "Me ajude a escrever uma mensagem para um cliente",
  ],
};

export function getHomiContexto(pathname: string): HomiContextoPagina {
  return REGRAS.find((r) => r.match.test(pathname))?.ctx ?? PADRAO;
}
