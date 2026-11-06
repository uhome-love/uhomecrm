/** Regras aprovadas da Lia Recupera (plano de 04/11/2026). */
export const RECUPERA_CONFIG = {
  limiteDia: 100,
  esperaHoras: 24,
  dias: "Seg a Sáb",
  janela: "9h às 20h",
  modeloConversa: "Gemini Flash",
  modeloDecisao: "Gemini Pro",
} as const;

export type GrupoEntrada = "entra" | "espera_90" | "nunca";

/** Classifica o balde de descarte (mesmos nomes da base da Lia). */
export function grupoDoBalde(balde: string): GrupoEntrada {
  if (["sem_condicao_financeira", "desistiu_compra"].includes(balde)) return "espera_90";
  if (["definitivo", "nao_quer_contato", "ja_comprou", "telefone_invalido"].includes(balde)) return "nunca";
  return "entra";
}

export const BALDE_ROTULO: Record<string, string> = {
  sem_interesse_momento: "Sem interesse no momento",
  sem_motivo: "Sem motivo escrito",
  nao_atende: "Não atende",
  outro: "Outro",
  sem_perfil: "Sem perfil",
  desistiu_compra: "Desistiu",
  lead_antigo: "Lead antigo",
  sem_condicao_financeira: "Sem condição financeira",
};

export const CADENCIA = [
  { dia: "D+1", titulo: "1ª mensagem", texto: "Cita o imóvel que a pessoa pediu + campanha de Natal, com 3 botões." },
  { dia: "D+3", titulo: "Lembrete com oferta", texto: "Uma oportunidade concreta do Natal com preço real." },
  { dia: "D+10", titulo: "Última mensagem", texto: "Avisa que vai encerrar e oferece uma última olhada no Natal; sem resposta, encerra." },
  { dia: "Resposta", titulo: "Conversa da Lia", texto: "Entende momento, faixa, região e prazo; manda as opções certas." },
  { dia: "Interesse recuperado", titulo: "Fila CEO", texto: "Perfil e contexto para repasse manual, nunca para quem descartou." },
] as const;

export interface ModeloRecupera { chave: string; titulo: string; quando: string; texto: string; aprovadoMeta?: string }

export const MODELOS_RECUPERA: ModeloRecupera[] = [
  { chave: "lia_recupera_a", titulo: "A · Não chegou a conversar", quando: "Não atende, sem retorno, sem motivo",
    texto: "Olá {{1}}, tudo bem? Aqui é a Lia, do Relacionamento da Uhome 😊\n\nVocê pediu informações sobre o {{2}} e eu trouxe uma novidade: começou o *Natal Chave de Ouro*, com a melhor condição do ano em 8 imóveis de Porto Alegre e Canoas, a partir de R$ 240 mil. E quem fecha na campanha ainda ganha um presente de Natal 🎁\n\nQuer ver as opções? Se hoje você busca outro perfil, também te ajudo 👇", aprovadoMeta: "05/11/2026" },
  { chave: "lia_recupera_b", titulo: "B · Sem interesse no momento", quando: "Sem interesse no momento",
    texto: "Olá {{1}}, tudo bem? Aqui é a Lia, do Relacionamento da Uhome 😊\n\nVocê conversou com o nosso time sobre o {{2}}, e agora no fim do ano surgiu algo novo: no *Natal Chave de Ouro*, as construtoras liberaram a melhor condição do ano em 8 imóveis. Se na época o que pesou foi entrada ou parcela, vale olhar de novo.\n\nE quem fecha na campanha ainda ganha um presente de Natal 🎁\n\nAinda faz sentido para você? Posso te mostrar nesse perfil ou em outro 👇", aprovadoMeta: "05/11/2026" },
  { chave: "lia_recupera_c", titulo: "C · Atendimento ficou parado", quando: "Corretor desligado ou inativado",
    texto: "Olá {{1}}, tudo bem? Aqui é a Lia, do Relacionamento da Uhome 😊\n\nVi que o seu atendimento sobre o {{2}} ficou parado, e te peço desculpas por isso. Quero retomar do jeito certo, com um especialista acompanhando você.\n\nE chegou numa boa hora: no *Natal Chave de Ouro* temos 8 imóveis com a melhor condição do ano, e quem fecha ainda ganha um presente de Natal 🎁\n\nPosso te mostrar as opções? 👇", aprovadoMeta: "05/11/2026" },
  { chave: "lia_recupera_d", titulo: "D · Sem produto conhecido", quando: "Lead sem empreendimento",
    texto: "Olá {{1}}, tudo bem? Aqui é a Lia, do Relacionamento da Uhome 😊\n\nVocê falou com o nosso time sobre imóveis, e eu trouxe uma novidade: começou o *Natal Chave de Ouro*. São 8 imóveis entre apartamentos, casas e alto padrão em Porto Alegre e Canoas, a partir de R$ 240 mil, com a melhor condição do ano.\n\nE quem fecha na campanha ainda ganha um presente de Natal 🎁\n\nQuer ver as opções? Se preferir, me conta o que você busca que eu separo o que combina 👇", aprovadoMeta: "05/11/2026" },
  { chave: "lia_recupera_lembrete", titulo: "Lembrete D+3", quando: "Sem resposta à 1ª mensagem",
    texto: "Oi {{1}}, separei uma oportunidade do Natal que pode combinar com você: o {{2}}, com {{3}} 🏡\n\nA condição é só de fim de ano. Quer que eu te conte como funciona?", aprovadoMeta: "05/11/2026" },
  { chave: "lia_recupera_final", titulo: "Última D+10", quando: "Sem resposta ao lembrete",
    texto: "Oi {{1}}, não quero te incomodar 🙂\n\nVou encerrar seu atendimento por aqui. Só não queria que você perdesse o *Natal Chave de Ouro* sem nem dar uma olhada: as condições valem só até o fim do ano.\n\nQuer ver as opções antes de eu encerrar? 👇", aprovadoMeta: "05/11/2026" },
];

export const BOTOES_RECUPERA = ["Sim, quero ver", "Outro perfil", "Não quero mais contato"] as const;

export const CENARIOS_LABORATORIO = [
  { grupo: "Interesse", itens: ["Responde \"sim, quero ver\"", "Quer outro perfil (casa em vez de apto)", "Pergunta preço de um produto específico"] },
  { grupo: "Financeiro", itens: ["Pergunta se aceita FGTS", "Quer saber valor de entrada", "Diz que não tem renda suficiente"] },
  { grupo: "Produto", itens: ["Pergunta data de entrega", "Pergunta valor do condomínio", "Pergunta algo que não está na ficha"] },
  { grupo: "Recusa e limites", itens: ["Responde \"não quero mais contato\"", "Fica irritado com a mensagem", "Já comprou com outra imobiliária"] },
  { grupo: "Fora do assunto", itens: ["Pergunta se é robô", "Manda áudio", "Pede para falar com o corretor antigo"] },
];

/** Lead recuperado pela Lia vai sempre para a Fila CEO, sem Roleta, para repasse manual. */
export const DESTINO_RECUPERADO = "fila_ceo_manual" as const;

/** O corretor que descartou nunca recebe o cliente de volta. */
export function podeRepassarRecuperado(corretorDestinoId: string, corretorQueDescartouId: string | null): boolean {
  return !corretorQueDescartouId || corretorDestinoId !== corretorQueDescartouId;
}
