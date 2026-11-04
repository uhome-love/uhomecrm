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
  { dia: "D+3", titulo: "Lembrete com oferta", texto: "Uma oportunidade concreta do Natal com preço real e foto." },
  { dia: "D+10", titulo: "Última mensagem", texto: "\"Posso encerrar seu atendimento?\" — sem resposta, encerra." },
  { dia: "Resposta", titulo: "Conversa da Lia", texto: "Entende momento, faixa, região e prazo; manda as opções certas." },
  { dia: "Interesse recuperado", titulo: "Fila CEO", texto: "Perfil e contexto para repasse manual, nunca para quem descartou." },
] as const;

export interface ModeloRecupera { chave: string; titulo: string; quando: string; texto: string }

export const MODELOS_RECUPERA: ModeloRecupera[] = [
  { chave: "lia_recupera_a", titulo: "A · Não chegou a conversar", quando: "Não atende, sem retorno, sem motivo",
    texto: "Olá {{1}}, sou a Lia do Relacionamento da Uhome. Você pediu informações sobre o {{2}} e acho que não conseguimos conversar. Estamos com a campanha Natal Chave de Ouro, com 8 oportunidades a partir de R$ 240 mil. Ainda está procurando imóvel nesse perfil, ou outro? Posso te mandar as opções?" },
  { chave: "lia_recupera_b", titulo: "B · Sem interesse no momento", quando: "Sem interesse no momento",
    texto: "Olá {{1}}, sou a Lia do Relacionamento da Uhome. Você conversou com nosso time sobre o {{2}} e estamos com novas oportunidades, inclusive nossa campanha de Natal! Você ainda está buscando imóvel nesse perfil, ou algum outro? Posso te mandar as opções e ver se faz sentido?" },
  { chave: "lia_recupera_c", titulo: "C · Atendimento ficou parado", quando: "Corretor desligado ou inativado",
    texto: "Olá {{1}}, sou a Lia do Relacionamento da Uhome. Seu atendimento sobre o {{2}} ficou parado e queremos retomar com um especialista. Ainda está procurando imóvel? Posso te mostrar as oportunidades da nossa campanha de Natal?" },
  { chave: "lia_recupera_d", titulo: "D · Sem produto conhecido", quando: "Lead sem empreendimento",
    texto: "Olá {{1}}, sou a Lia do Relacionamento da Uhome. Você falou com nosso time sobre imóveis e estamos com a campanha Natal Chave de Ouro: apartamentos, casas e alto padrão em Porto Alegre e Canoas. Ainda está procurando? Me conta o perfil e eu te mando as opções." },
  { chave: "lia_recupera_lembrete", titulo: "Lembrete D+3", quando: "Sem resposta à 1ª mensagem",
    texto: "{{1}}, separei uma oportunidade do Natal que pode combinar com você: {{2}}, {{3}}. Quer que eu te mande fotos e a planta?" },
  { chave: "lia_recupera_final", titulo: "Última D+10", quando: "Sem resposta ao lembrete",
    texto: "{{1}}, não quero te incomodar. Posso encerrar seu atendimento ou prefere que eu te mande as opções do Natal?" },
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
