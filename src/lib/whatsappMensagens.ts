export interface WhatsAppProduto {
  nome: string;
  valorMin?: number | null;
  diferenciais?: string[] | null;
  argumentosVenda?: string | null;
}

export interface WhatsAppMensagem {
  id: string;
  title: string;
  body: string;
}

export function limparNomeEmpreendimento(nome?: string | null): string {
  return (nome ?? "").trim()
    .replace(/(?:\s*[-–—]\s*natal(?:\s+2026)?|\s+(?:[-–—]\s*)?v\d+)\s*$/i, "")
    .replace(/(?:\s*[-–—]\s*natal(?:\s+2026)?|\s+(?:[-–—]\s*)?v\d+)\s*$/i, "")
    .trim();
}

export function normalizarNomeProduto(nome: string): string {
  return limparNomeEmpreendimento(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

export function selecionarFichaProduto<T extends { nome: string | null }>(
  fichas: T[], nomeOficial: string, aliases: string[] = [],
): T | undefined {
  const oficial = normalizarNomeProduto(nomeOficial);
  const exatas = fichas.filter(f => f.nome && normalizarNomeProduto(f.nome) === oficial);
  if (exatas.length === 1) return exatas[0];
  if (exatas.length > 1) return undefined;
  const nomes = new Set(aliases.map(normalizarNomeProduto));
  const correspondentes = fichas.filter(f => f.nome && nomes.has(normalizarNomeProduto(f.nome)));
  // Uma correspondência parcial ou ambígua nunca empresta preço de outro produto.
  return correspondentes.length === 1 ? correspondentes[0] : undefined;
}

const ETAPA_ALIASES: Record<string, string> = {
  novo: "novo_lead", contato_iniciado: "qualificacao", contato_inicial: "qualificacao",
  busca: "qualificacao", possivel_visita: "aquecimento", visita_marcada: "visita",
  visita_realizada: "pos_visita", negociacao: "proposta", contrato: "contrato_gerado",
  ganho: "venda",
};

const ETAPA_LABELS: Record<string, string> = {
  novo_lead: "Novo Lead", sem_contato: "Sem Contato", qualificacao: "Qualificação",
  aquecimento: "Aquecimento", visita: "Visita", pos_visita: "Pós-Visita",
  documentacao: "Documentação", proposta: "Proposta", contrato_gerado: "Contrato",
  venda: "Ganho", descarte: "Descarte", inativo: "Inativo",
};

export function etapaWhatsApp(stageTipo?: string, statusVisita?: string | null): string {
  const etapa = ETAPA_ALIASES[stageTipo ?? ""] ?? stageTipo ?? "";
  if (etapa === "visita" && (statusVisita === "realizada" || statusVisita === "pos_visita")) return "pos_visita";
  return etapa;
}

export function rotuloEtapaWhatsApp(stageTipo?: string, statusVisita?: string | null): string {
  return ETAPA_LABELS[etapaWhatsApp(stageTipo, statusVisita)] ?? "Cliente";
}

export function gerarMensagensWhatsApp(input: {
  stageTipo?: string;
  statusVisita?: string | null;
  nome: string;
  corretorNome?: string;
  empreendimento?: string | null;
  produto?: WhatsAppProduto;
}): WhatsAppMensagem[] {
  const nome = input.nome.trim().split(/\s+/)[0] || "Olá";
  const corretor = input.corretorNome?.trim().split(/\s+/)[0];
  const apresentacao = corretor ? `Aqui é ${corretor}, da Uhome.` : "Aqui é da Uhome.";
  const emp = limparNomeEmpreendimento(input.produto?.nome || input.empreendimento) || "imóvel do teu interesse";
  const valor = input.produto?.valorMin;
  const preco = typeof valor === "number" && Number.isFinite(valor) && valor > 0
    ? `unidades a partir de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor)}` : "";
  const diferenciais = (input.produto?.diferenciais ?? []).map(d => d.trim()).filter(Boolean);
  const diferencial = diferenciais.slice(0, 2).join("; ");
  const argumentoCondicao = input.produto?.argumentosVenda?.split(/\n+/)
    .map(a => a.trim()).find(a => /^(?:entrada|possibilidade|financiamento|uso de fgts)\b/i.test(a)) ?? "";
  const condicao = diferenciais.find(d => /financia|fgts|entrada/i.test(d)) || argumentoCondicao;
  const detalhes = [preco, condicao].filter(Boolean).join("; ");
  const mensagem = (id: string, title: string, body: string): WhatsAppMensagem => ({ id, title, body });
  const contato = [
    mensagem("primeiro_contato", "👋 Primeiro contato", `Oi ${nome}, tudo bem? ${apresentacao} Vi que tu pediu informações do ${emp} e quero te ajudar. Posso te mandar os detalhes?`),
    mensagem("nao_atendeu", "📞 Não atendeu", `${nome}, tentei te ligar agora sobre o ${emp} e não consegui falar contigo. Qual o melhor horário pra eu te retornar?`),
    mensagem("reativacao", "🔄 Reativação", `${nome}, sei que a rotina é corrida! Queria retomar teu interesse no ${emp}. Tu prefere que eu te mande as informações por aqui ou te ligue rapidinho?`),
  ];
  switch (etapaWhatsApp(input.stageTipo, input.statusVisita)) {
    case "novo_lead": case "sem_contato": return contato;
    case "qualificacao": return [
      mensagem("momento", "🎯 Teu momento", `${nome}, queria entender melhor teu momento pra te ajudar com o ${emp}. Tu tá buscando pra morar ou investir?`),
      mensagem("faixa_valor", "💰 Faixa de valor", `${nome}, qual faixa de valor e entrada fica confortável pra ti? Assim consigo conferir as opções do ${emp} que fazem sentido no teu caso.`),
      mensagem("prioridades", "🏠 Prioridades", `${nome}, pensando no ${emp}, o que mais pesa pra ti: espaço, localização ou valor? E em quanto tempo tu pretende comprar?`),
    ];
    case "aquecimento": return [
      mensagem("diferencial", "✨ Diferencial", diferencial
        ? `${nome}, lembrei de ti: no ${emp}, os destaques são ${diferencial}${preco ? `, com ${preco}` : ""}. Faz sentido pro que tu procura?`
        : `${nome}, lembrei do teu interesse no ${emp}. Quer que eu retome os detalhes contigo pra ver se ainda faz sentido pro teu momento?`),
      mensagem("condicao", "💰 Condição", detalhes
        ? `${nome}, no cadastro do ${emp} temos ${detalhes}. Quer que eu te mostre como ficaria no teu caso?`
        : `${nome}, quer que eu confira as condições atuais do ${emp} e prepare uma simulação pro teu caso?`),
      mensagem("convite", "📅 Convite leve", `${nome}, que tal conhecer o ${emp} pessoalmente, sem compromisso? Fica melhor pra ti durante a semana ou no sábado?`),
    ];
    case "visita": return [
      mensagem("confirmar", "📅 Confirmar visita", `${nome}, podemos confirmar nossa visita ao ${emp} no horário combinado? Se precisar ajustar, me avisa por aqui.`),
      mensagem("lembrete", "📍 Lembrete do dia", `Bom dia, ${nome}! Passando pra combinar os detalhes da visita ao ${emp}. Quer que eu te envie a localização e confirme o horário contigo?`),
      mensagem("reagendar", "🔄 Reagendar", `${nome}, se o horário da visita ao ${emp} não ficou bom, podemos reagendar. Qual dia e horário funciona melhor pra ti?`),
    ];
    case "pos_visita": return [
      mensagem("agradecimento", "🏠 Agradecimento", `${nome}, foi um prazer te receber no ${emp}! O que mais te chamou atenção na visita?`),
      mensagem("simulacao", "📊 Simulação", `${nome}, vamos montar uma simulação do ${emp} pra ti${detalhes ? ` — ${detalhes}` : ""}? Me conta qual entrada e parcela ficam confortáveis pra ti.`),
      mensagem("retomar_duvida", "💬 Retomar dúvida", `${nome}, ficou alguma dúvida depois da visita ao ${emp}? Me conta que eu te ajudo a avaliar com calma.`),
    ];
    case "documentacao": return [
      mensagem("documentos", "📋 Lista de documentos", `${nome}, pra avançarmos com o ${emp}, posso te enviar a lista dos documentos necessários e conferir contigo o que já temos?`),
      mensagem("pendencia", "📎 Conferir pendência", `${nome}, vamos conferir se ficou algum documento pendente pro ${emp}? Posso te ajudar a organizar o envio.`),
      mensagem("andamento", "💬 Andamento", `${nome}, quer que eu te atualize sobre a documentação do ${emp} e os próximos passos? Se tiver alguma dúvida, me chama.`),
    ];
    case "proposta": return [
      mensagem("proposta", "📋 Acompanhar proposta", `${nome}, conseguiu analisar a proposta do ${emp}? Tô aqui pra tirar dúvidas e conferir os ajustes contigo.`),
      mensagem("ajustar", "💰 Ajustar condição", `${nome}, qual ponto da proposta do ${emp} tu gostaria de revisar: entrada, parcelas ou valor? Vou conferir as possibilidades pra ti.`),
      mensagem("prazo", "📅 Combinar retorno", `${nome}, quando fica bom pra conversarmos sobre a proposta do ${emp}? Assim alinhamos os próximos passos com calma.`),
    ];
    case "contrato_gerado": return [
      mensagem("assinatura", "📄 Assinatura", `${nome}, vamos conferir o andamento do contrato do ${emp}? Posso te orientar sobre a leitura e a assinatura.`),
      mensagem("duvida_contrato", "💬 Dúvida no contrato", `${nome}, ficou alguma dúvida na leitura do contrato do ${emp}? Me manda o ponto que tu quer esclarecer.`),
      mensagem("proximos_passos", "🔑 Próximos passos", `${nome}, vamos alinhar os próximos passos do contrato do ${emp} e confirmar o que falta pra assinatura?`),
    ];
    default: return [];
  }
}