// Scripts inteligentes por stage — Sprint 1 Mudança 4
// Filtra opções de mensagem por etapa do funil + templates contextualizados.

export type ScriptId =
  | "primeiro_contato"
  | "tentativa_ligacao"
  | "reativacao"
  | "levantar_perfil"
  | "validar_interesse"
  | "confirmar_proximo_passo"
  | "apresentar_opcao"
  | "convite_visita"
  | "condicoes_especiais"
  | "retomar_contato"
  | "agendar_visita"
  | "enviar_material"
  | "senso_urgencia"
  | "confirmar_visita_d1"
  | "enviar_direcoes"
  | "lembrete_visita"
  | "followup_impressoes"
  | "levantar_duvidas"
  | "avancar_negocio"
  | "reativar_pos_visita";

export interface ScriptOption {
  id: ScriptId;
  label: string;
  emoji: string;
}

export const SCRIPTS_BY_STAGE: Record<string, ScriptOption[]> = {
  "Sem Contato": [
    { id: "primeiro_contato", label: "Primeiro contato", emoji: "🎯" },
    { id: "tentativa_ligacao", label: "Tentativa ligação", emoji: "📞" },
    { id: "reativacao", label: "Reativação", emoji: "🔄" },
  ],
  "Contato Iniciado": [
    { id: "levantar_perfil", label: "Levantar perfil", emoji: "❓" },
    { id: "validar_interesse", label: "Validar interesse", emoji: "✅" },
    { id: "confirmar_proximo_passo", label: "Próximo passo", emoji: "🎯" },
  ],
  Busca: [
    { id: "apresentar_opcao", label: "Apresentar opção", emoji: "🏠" },
    { id: "convite_visita", label: "Convite visita", emoji: "📅" },
    { id: "condicoes_especiais", label: "Condições especiais", emoji: "💰" },
    { id: "retomar_contato", label: "Retomar contato", emoji: "🔄" },
  ],
  Aquecimento: [
    { id: "agendar_visita", label: "Agendar visita", emoji: "📅" },
    { id: "enviar_material", label: "Enviar material", emoji: "📎" },
    { id: "senso_urgencia", label: "Senso urgência", emoji: "⏰" },
  ],
  Visita: [
    { id: "confirmar_visita_d1", label: "Confirmar D-1", emoji: "✅" },
    { id: "enviar_direcoes", label: "Enviar direções", emoji: "📍" },
    { id: "lembrete_visita", label: "Lembrete", emoji: "⏰" },
  ],
  "Pós-Visita": [
    { id: "followup_impressoes", label: "Follow-up impressões", emoji: "💬" },
    { id: "levantar_duvidas", label: "Levantar dúvidas", emoji: "❓" },
    { id: "avancar_negocio", label: "Avançar negócio", emoji: "🚀" },
    { id: "reativar_pos_visita", label: "Reativar", emoji: "🔄" },
  ],
};

export const DEFAULT_SCRIPTS: ScriptOption[] = [
  { id: "primeiro_contato", label: "Primeiro contato", emoji: "🎯" },
  { id: "retomar_contato", label: "Retomar contato", emoji: "🔄" },
];

export function getScriptsForStage(stage: string): ScriptOption[] {
  return SCRIPTS_BY_STAGE[stage] || DEFAULT_SCRIPTS;
}

export const SCRIPT_TEMPLATES: Record<ScriptId, string> = {
  primeiro_contato: `Olá {nome}! Tudo bem? Sou {corretor} da Uhome.
Vi seu interesse no {empreendimento} e queria te ajudar a encontrar o imóvel ideal.

Pode me contar um pouco do que você está buscando? Região, tamanho, faixa de preço?`,

  tentativa_ligacao: `Olá {nome}! Tentei te ligar agora mas não consegui falar.
Sou {corretor} da Uhome, sobre o {empreendimento}.

Tem um momento melhor pra eu te ligar de volta? Posso ligar mais tarde ou outro dia que for melhor pra você.`,

  reativacao: `Olá {nome}! Faz um tempo que não conversamos.
Sou {corretor} da Uhome.

Você ainda está buscando imóvel? Tenho novidades sobre o {empreendimento} que podem te interessar.`,

  levantar_perfil: `{nome}, pra eu te ajudar melhor, posso entender um pouco do seu cenário?

- Você está buscando pra morar ou investir?
- Qual região de preferência?
- Qual faixa de valor faz sentido?
- Tem prazo pra fechar?

Com essas informações consigo te apresentar opções certeiras.`,

  validar_interesse: `{nome}, depois da nossa conversa, queria entender melhor:

O {empreendimento} faz sentido pro que você busca?
Tem algum ponto que ficou em dúvida ou que eu posso esclarecer?

Se preferir outras opções, também tenho algumas que combinam com seu perfil.`,

  confirmar_proximo_passo: `{nome}, pra eu te ajudar a avançar, qual o melhor próximo passo?

1. Marcar uma visita pra você conhecer pessoalmente
2. Te enviar mais material pra avaliar
3. Conversar sobre valores e condições

Me diz o que faz mais sentido pro seu momento.`,

  apresentar_opcao: `{nome}, lembrei de você hoje.
Tenho uma opção que encaixa exatamente no que conversamos:

{empreendimento} — quer que eu te mande as informações completas?
Posso enviar fotos, plantas e valores agora.`,

  convite_visita: `{nome}, que tal conhecer o {empreendimento} pessoalmente?

A visita ajuda muito a sentir o imóvel de verdade — espaço, vizinhança, vista.
Consigo agendar uma visita rápida pra você esta semana. Qual dia funciona melhor: terça, quinta ou sábado?`,

  condicoes_especiais: `{nome}, novidade importante: o {empreendimento} está com condição especial agora.

Vou te enviar o detalhe completo, mas adianto que vale a pena olhar antes de tomar decisão.
Posso te ligar pra te explicar pessoalmente?`,

  retomar_contato: `Oi {nome}, tudo bem?
Faz um tempo que não conversamos sobre o {empreendimento}.

Você ainda está procurando? Posso te atualizar sobre o que mudou desde a última vez — estoque, valores, condições.`,

  agendar_visita: `{nome}, vamos marcar a visita ao {empreendimento}?

Tenho horários disponíveis essa semana. Qual dia e horário ficam melhores pra você?
Posso buscar você no local ou nos encontramos lá direto.`,

  enviar_material: `{nome}, vou te enviar material completo do {empreendimento}:
- Fotos do imóvel e áreas comuns
- Plantas e metragens
- Valores e condições atuais

Dá uma olhada com calma e depois conversamos sobre o que achou.`,

  senso_urgencia: `{nome}, queria te avisar sobre o {empreendimento}.

As unidades melhores estão saindo rápido nesse mês. Se você tem interesse real, vale a pena a gente acelerar a decisão antes que as opções diminuam.
Posso te apresentar o que ainda está disponível?`,

  confirmar_visita_d1: `Oi {nome}! Passando aqui pra confirmar nossa visita amanhã ao {empreendimento}.

Está tudo certo do seu lado? Algum imprevisto?
Te aguardo no horário combinado. Qualquer coisa, me avisa por aqui.`,

  enviar_direcoes: `{nome}, segue o endereço e direções pra nossa visita:

📍 Local: {empreendimento}
🕐 Horário: [a definir]

Caso tenha dificuldade pra chegar, me avisa que te oriento.`,

  lembrete_visita: `{nome}, lembrete da nossa visita ao {empreendimento} hoje!

Te aguardo no horário combinado. Se precisar reagendar, me avisa o quanto antes pra eu organizar.`,

  followup_impressoes: `{nome}, e aí, o que achou do {empreendimento}?

Algum ponto chamou mais atenção? Alguma dúvida ou observação que ficou?
Quero entender pra te ajudar nos próximos passos.`,

  levantar_duvidas: `{nome}, depois da visita ao {empreendimento}, é normal surgirem dúvidas.

Tem algo específico que você quer esclarecer? Valores, condições de pagamento, prazos de entrega, financiamento?
Me conta que respondo no detalhe.`,

  avancar_negocio: `{nome}, percebi que você gostou do {empreendimento}.

Que tal a gente avançar pra próxima etapa? Posso te apresentar a proposta com as condições atuais e simular o financiamento se quiser.
Quando podemos conversar com mais calma?`,

  reativar_pos_visita: `{nome}, faz um tempo desde nossa visita ao {empreendimento}.

Queria entender como você está com a decisão. Surgiu alguma dúvida nesse meio tempo? Quer rever as condições?
Estou aqui pra te ajudar quando você quiser avançar.`,
};

export function buildScriptText(
  scriptId: ScriptId,
  variables: { nome: string; empreendimento: string; corretor: string }
): string {
  const template = SCRIPT_TEMPLATES[scriptId] || "";
  return template
    .replace(/\{nome\}/g, variables.nome || "cliente")
    .replace(/\{empreendimento\}/g, variables.empreendimento || "nosso empreendimento")
    .replace(/\{corretor\}/g, variables.corretor || "corretor");
}
