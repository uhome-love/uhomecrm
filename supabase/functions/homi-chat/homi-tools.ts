/**
 * homi-tools — Function-calling tools for the corretor Homi copilot.
 *
 * READ tools (ver_pendencias, buscar_imovel) execute server-side with the
 * caller's JWT (respects RLS) and return data.
 *
 * WRITE tools (criar_tarefa, criar_visita) DO NOT write. They resolve the lead
 * and normalize the fields, then return an `action proposal` that the frontend
 * renders as a confirmation card. Nothing is persisted until the corretor
 * confirms in the UI.
 */

// OpenAI-compatible tool definitions
export const HOMI_TOOLS = [
  {
    type: "function",
    function: {
      name: "lembrar",
      description:
        "Guarda na memória de longo prazo um fato estável sobre quem está falando (preferências de estilo, meta, produtos que domina, região onde atua, horários). Use quando a pessoa disser algo que valha lembrar nas próximas conversas. NÃO use para fatos de um lead específico nem para coisas passageiras.",
      parameters: {
        type: "object",
        properties: {
          chave: { type: "string", description: "Identificador curto do fato, ex: 'meta_mensal', 'estilo_mensagem', 'regiao_atuacao'." },
          valor: { type: "string", description: "O fato em si, em uma frase curta." },
          categoria: { type: "string", description: "Agrupamento: perfil, meta, estilo, produto, rotina ou geral." },
        },
        required: ["chave", "valor"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "ver_pendencias",
      description:
        "Mostra o que o corretor tem de pendente/atrasado: tarefas atrasadas, tarefas de hoje e visitas de hoje. Use quando o corretor perguntar o que tem para fazer, o que está atrasado, sua agenda ou pendências.",
      parameters: {
        type: "object",
        properties: {
          escopo: {
            type: "string",
            enum: ["tudo", "tarefas", "visitas"],
            description: "Filtra o que retornar. Padrão: tudo.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_imovel",
      description:
        "Busca imóveis no catálogo da Uhome. Use quando o corretor pedir para encontrar/buscar um imóvel. O corretor manda um texto único (ex: 'apartamento de 3 dorms de 1M até 1,5M no Menino Deus mobiliado'). EXTRAIA você mesmo TODOS os atributos para os campos (faixa de valor, dorms, mobiliado, suítes, vagas, área, tipo, ZONA) e deixe em `termo` SÓ bairro/empreendimento/cidade. ATENÇÃO: 'de X até Y' / 'entre X e Y' é FAIXA — preencha valor_min E valor_max. 'a partir de X' = valor_min. 'até X' = valor_max. 'M' = milhões, 'mil'/'k' = milhares. Se o corretor citar uma ZONA de Porto Alegre ('zona norte', 'zona sul', 'zona leste', 'zona central', 'centro', 'região norte'), preencha o campo `zona` e NÃO coloque isso em `termo`.",
      parameters: {
        type: "object",
        properties: {
          termo: { type: "string", description: "Somente bairro, empreendimento ou cidade (sem dorms, sem valor, sem 'mobiliado', sem zona)." },
          zona: {
            type: "string",
            enum: ["Norte", "Central", "Leste", "Sul", "Metropolitana"],
            description: "Zona de Porto Alegre pedida pelo corretor. 'centro'/'zona central' = Central. Cidades vizinhas (Canoas, Viamão, Gravataí, litoral) = Metropolitana.",
          },
          dormitorios: { type: "number", description: "Número de dormitórios citado." },
          dormitorios_exato: { type: "boolean", description: "true quando o corretor disse um número fechado ('3 dorms'); false quando disse '3+' / 'no mínimo 3'. Padrão: true." },
          valor_min: { type: "number", description: "Valor de venda MÍNIMO em reais (ex: 1000000 para '1M')." },
          valor_max: { type: "number", description: "Valor de venda MÁXIMO em reais (ex: 1500000 para '1,5M')." },
          mobiliado: { type: "boolean", description: "true se o corretor pediu mobiliado." },
          suites_min: { type: "number", description: "Número mínimo de suítes." },
          vagas_min: { type: "number", description: "Número mínimo de vagas." },
          area_min: { type: "number", description: "Área privativa mínima em m²." },
          tipo: { type: "string", description: "Tipo do imóvel: apartamento, casa, cobertura, terreno, sala..." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fila_execucao",
      description:
        "Monta uma FILA de execução para o corretor resolver pendências uma a uma. Use quando ele pedir 'me ajuda a concluir minhas tarefas atrasadas', 'quais leads estão sem tarefa', 'me organiza', 'vamos resolver de 3 em 3'. Cada item traz o contexto do lead e a ação sugerida.",
      parameters: {
        type: "object",
        properties: {
          fila: {
            type: "string",
            enum: ["tarefas_atrasadas", "leads_sem_tarefa"],
            description: "Qual fila montar. Padrão: tarefas_atrasadas.",
          },
          lote: { type: "number", description: "Quantos cards mostrar por vez: 1 ou 3. Padrão: 1." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "visitas_a_confirmar",
      description:
        "Lista as visitas futuras do corretor que ainda NÃO foram confirmadas com o cliente. Use quando ele perguntar 'quais visitas tenho que confirmar?', 'preciso confirmar alguma visita?'.",
      parameters: { type: "object", properties: { dias: { type: "number", description: "Janela em dias à frente. Padrão: 3." } } },
    },
  },
  {
    type: "function",
    function: {
      name: "visitas_pendentes_resultado",
      description:
        "Lista as visitas do corretor cuja data já passou e que continuam SEM resultado registrado (nem realizada, nem no-show). Use quando ele perguntar 'quais visitas tenho pendentes?', 'o que falta registrar de visita?'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "briefing_do_dia",
      description:
        "Monta o briefing objetivo do dia: números (tarefas atrasadas, visitas a confirmar, visitas sem resultado, leads sem tarefa, leads esfriando) e prioridades. Use quando o corretor pedir 'faz meu briefing', 'o que devo fazer hoje', 'me dá o resumo objetivo'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description:
        "Prepara a criação de uma tarefa vinculada a um lead (não cria direto — o corretor confirma na tela). Use quando o corretor pedir para criar/agendar uma tarefa, follow-up, ligação, lembrete etc.",
      parameters: {
        type: "object",
        properties: {
          lead_nome: { type: "string", description: "Nome (ou parte) do lead." },
          tipo: {
            type: "string",
            enum: ["ligar", "whatsapp", "enviar_material", "follow_up", "enviar_proposta", "marcar_visita", "outro"],
            description: "Tipo da tarefa.",
          },
          tipo_personalizado: { type: "string", description: "Descrição do tipo quando tipo='outro'." },
          data: { type: "string", description: "Data no formato YYYY-MM-DD (converta 'hoje'/'amanhã' para data absoluta em horário de Brasília)." },
          hora: { type: "string", description: "Hora HH:MM (24h). Opcional." },
          observacao: { type: "string", description: "Observação/descrição da tarefa. Opcional." },
        },
        required: ["lead_nome", "tipo", "data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_visita",
      description:
        "Prepara o agendamento de uma visita para um lead (não agenda direto — o corretor confirma na tela). Use quando o corretor pedir para marcar/agendar uma visita.",
      parameters: {
        type: "object",
        properties: {
          lead_nome: { type: "string", description: "Nome (ou parte) do lead." },
          data: { type: "string", description: "Data YYYY-MM-DD (converta relativas para absolutas em horário de Brasília)." },
          hora: { type: "string", description: "Hora HH:MM (24h). Opcional." },
          local: {
            type: "string",
            enum: ["stand", "empresa", "videochamada", "decorado", "no_imovel", "outro"],
            description: "Local da visita. Opcional.",
          },
          empreendimento: { type: "string", description: "Empreendimento. Opcional." },
          observacao: { type: "string", description: "Observações. Opcional." },
        },
        required: ["lead_nome", "data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumo_lead",
      description:
        "Mostra um resumo do lead (etapa, última interação, próximas tarefas, imóveis de interesse) e sugere a próxima ação. Use quando o corretor pedir 'me fala do lead X', 'como está o lead X', 'resumo do X'.",
      parameters: {
        type: "object",
        properties: {
          lead_nome: { type: "string", description: "Nome (ou parte) do lead." },
        },
        required: ["lead_nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "anotar_lead",
      description:
        "Prepara uma anotação na timeline do lead (o corretor confirma na tela). Use quando o corretor disser 'anota no lead X que...', 'registra que...'.",
      parameters: {
        type: "object",
        properties: {
          lead_nome: { type: "string", description: "Nome (ou parte) do lead." },
          texto: { type: "string", description: "Conteúdo da anotação." },
        },
        required: ["lead_nome", "texto"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "contexto_lead",
      description:
        "Lê o histórico completo do lead (etapa, substatus, timeline de atividades e anotações do corretor) para você ENTENDER o momento do lead SEM PERGUNTAR. CHAME SEMPRE esta ferramenta ANTES de escrever uma mensagem de WhatsApp, follow-up ou script para um lead citado pelo nome. Depois, faça um mini-resumo curto (1 linha) do que entendeu e já escreva a mensagem pronta.",
      parameters: {
        type: "object",
        properties: {
          lead_nome: { type: "string", description: "Nome (ou parte) do lead." },
        },
        required: ["lead_nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_resultado",
      description:
        "Prepara o registro do resultado de um contato com o lead (o corretor confirma na tela). Use quando o corretor relatar o que aconteceu: 'liguei e não atendeu', 'falei com a Marilá, quer visitar sábado', 'não tem interesse'. Classifique o resultado.",
      parameters: {
        type: "object",
        properties: {
          lead_nome: { type: "string", description: "Nome (ou parte) do lead." },
          resultado: {
            type: "string",
            enum: ["nao_atendeu", "atendeu_sem_interesse", "atendeu_interessado", "pediu_retorno", "agendou_visita"],
            description: "Classificação do resultado do contato.",
          },
          detalhe: { type: "string", description: "Detalhe do que aconteceu (texto livre). Opcional." },
        },
        required: ["lead_nome", "resultado"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "leads_esfriando",
      description:
        "Lista os leads do corretor que estão esfriando (sem atividade há vários dias), ordenados pelo tempo parado. Use quando o corretor perguntar quais leads estão parados, esfriando, precisando de atenção ou reengajamento.",
      parameters: {
        type: "object",
        properties: {
          dias: { type: "number", description: "Nº mínimo de dias sem atividade. Padrão: 5." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preparar_visita",
      description:
        "Monta um briefing pré-visita: quem é o lead, histórico resumido, imóvel de interesse e argumentos de venda. Use quando o corretor pedir para preparar/se preparar para uma visita, seja de um lead nomeado ou das visitas de hoje/amanhã.",
      parameters: {
        type: "object",
        properties: {
          lead_nome: { type: "string", description: "Nome do lead (opcional). Se vazio, usa as visitas de hoje/amanhã." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "meu_dia",
      description:
        "Monta o resumo do dia do corretor em 3 frentes: (1) AGORA — tarefas atrasadas e de hoje; (2) VISITAS de hoje; (3) leads ESFRIANDO (sem contato há 5+ dias). Use quando o corretor perguntar 'meu dia', 'por onde começo', 'o que faço agora', 'resumo do dia', 'me organiza' ou clicar no botão Meu dia.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];


function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDaysBRT(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Contexto enxuto de um lead para os cards da fila de execução
async function leadContextoCurto(userClient: any, leadIds: string[]) {
  const map = new Map<string, any>();
  if (!leadIds.length) return map;
  const { data: leads } = await userClient
    .from("pipeline_leads")
    .select("id, nome, telefone, empreendimento, stage_id, ultima_acao_at")
    .in("id", leadIds);
  const stageIds = [...new Set((leads || []).map((l: any) => l.stage_id).filter(Boolean))];
  let stageMap = new Map<string, string>();
  if (stageIds.length) {
    const { data: stages } = await userClient.from("pipeline_stages").select("id, nome").in("id", stageIds);
    stageMap = new Map((stages || []).map((s: any) => [s.id, s.nome]));
  }
  for (const l of leads || []) {
    const dt = l.ultima_acao_at ? new Date(l.ultima_acao_at) : null;
    map.set(l.id, {
      id: l.id,
      nome: l.nome,
      telefone: l.telefone,
      empreendimento: l.empreendimento,
      stage_nome: stageMap.get(l.stage_id) || "",
      dias_parado: dt ? Math.floor((Date.now() - dt.getTime()) / 86400000) : null,
    });
  }
  return map;
}


// Resolve a lead by name within the corretor's scope. Returns { lead } | { candidates } | { none }
async function resolveLead(userClient: any, uid: string, nome: string) {
  const term = (nome || "").trim();
  if (!term) return { none: true as const };
  const { data, error } = await userClient
    .from("pipeline_leads")
    .select("id, nome, telefone, empreendimento, stage_id")
    .eq("corretor_id", uid)
    .ilike("nome", `%${term}%`)
    .limit(6);
  if (error) {
    console.error("[resolveLead] error:", error);
    return { none: true as const };
  }
  const rows = data || [];
  if (rows.length === 0) return { none: true as const };
  if (rows.length === 1) return { lead: rows[0] };
  // exact (case-insensitive) match shortcut
  const exact = rows.filter((r: any) => (r.nome || "").toLowerCase() === term.toLowerCase());
  if (exact.length === 1) return { lead: exact[0] };
  return { candidates: rows };
}

// Reads a lead's history (stage, substatus, timeline, notes) — read-only, RLS-scoped.
async function readLeadHistory(userClient: any, lead: any) {
  let stageNome = "";
  let flagStatus = "";
  const { data: leadFull } = await userClient
    .from("pipeline_leads")
    .select("flag_status, empreendimento, stage_id")
    .eq("id", lead.id)
    .maybeSingle();
  const rawFlag = leadFull?.flag_status;
  flagStatus = rawFlag && typeof rawFlag === "object"
    ? Object.entries(rawFlag).map(([k, v]) => `${k}: ${v}`).join(", ")
    : (rawFlag || "");
  const empreendimento = leadFull?.empreendimento || lead.empreendimento || "";
  const stageId = leadFull?.stage_id || lead.stage_id;
  if (stageId) {
    const { data: st } = await userClient.from("pipeline_stages").select("nome").eq("id", stageId).maybeSingle();
    stageNome = st?.nome || "";
  }
  const { data: atividades } = await userClient
    .from("pipeline_atividades")
    .select("titulo, descricao, tipo, data, created_at")
    .eq("pipeline_lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(8);
  const { data: anotacoes } = await userClient
    .from("pipeline_anotacoes")
    .select("conteudo, autor_nome, created_at")
    .eq("pipeline_lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(5);
  const acts = atividades || [];
  const ultima = acts[0] ? `${acts[0].titulo || acts[0].tipo || "atividade"}${acts[0].data ? " · " + acts[0].data : ""}` : null;
  return { stageNome, flagStatus, empreendimento, atividades: acts, anotacoes: anotacoes || [], ultima };
}

export interface ToolOutcome {
  // What we feed back to the model as the tool result
  modelResult: string;
  // A read result to render (optional)
  result?: Record<string, unknown>;
  // A write proposal to render as a confirmation card (optional)
  action?: Record<string, unknown>;
}

export async function executeHomiTool(
  name: string,
  args: Record<string, any>,
  userClient: any,
  uid: string,
): Promise<ToolOutcome> {
  try {
    if (name === "lembrar") {
      const chave = String(args.chave || "").trim().slice(0, 80);
      const valor = String(args.valor || "").trim().slice(0, 400);
      const categoria = String(args.categoria || "geral").trim().slice(0, 40);
      if (!chave || !valor) {
        return { modelResult: "Não deu para guardar: faltou o que lembrar." };
      }
      const { error } = await userClient
        .from("homi_memoria_usuario")
        .upsert({ user_id: uid, chave, valor, categoria }, { onConflict: "user_id,chave" });
      if (error) {
        console.error("[lembrar] error:", error);
        return { modelResult: "Não consegui guardar isso na memória agora." };
      }
      return {
        modelResult: `Memória guardada: ${chave} = ${valor}. Confirme em 1 frase curta.`,
        result: { tipo: "memoria_salva", chave, valor, categoria },
      };
    }

    if (name === "meu_dia") {

      const today = todayBRT();

      // AGORA: tarefas pendentes (atrasadas + hoje)
      const { data: tarefas } = await userClient
        .from("pipeline_tarefas")
        .select("id, titulo, tipo, vence_em, hora_vencimento, pipeline_lead_id, status")
        .eq("responsavel_id", uid)
        .eq("status", "pendente")
        .lte("vence_em", today)
        .order("vence_em", { ascending: true })
        .limit(40);
      const tRows = tarefas || [];
      const tLeadIds = [...new Set(tRows.map((r: any) => r.pipeline_lead_id).filter(Boolean))];
      let tNameMap = new Map<string, string>();
      if (tLeadIds.length) {
        const { data: leads } = await userClient.from("pipeline_leads").select("id, nome").in("id", tLeadIds);
        tNameMap = new Map((leads || []).map((l: any) => [l.id, l.nome]));
      }
      const tWithNames = tRows.map((r: any) => ({ ...r, lead_nome: tNameMap.get(r.pipeline_lead_id) || "Lead" }));
      const atrasadas = tWithNames.filter((r: any) => r.vence_em && r.vence_em < today);
      const hoje = tWithNames.filter((r: any) => r.vence_em === today);

      // VISITAS de hoje
      const { data: visitas } = await userClient
        .from("visitas")
        .select("id, nome_cliente, empreendimento, data_visita, hora_visita, local_visita, status, pipeline_lead_id")
        .eq("corretor_id", uid)
        .eq("data_visita", today)
        .order("hora_visita", { ascending: true })
        .limit(20);
      const visitasHoje = visitas || [];

      // ESFRIANDO: sem atividade há 5+ dias
      const dias = 5;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - dias);
      const cutoffISO = cutoff.toISOString();
      const { data: coldData } = await userClient
        .from("pipeline_leads")
        .select("id, nome, empreendimento, ultima_acao_at")
        .eq("corretor_id", uid)
        .eq("arquivado", false)
        .or(`ultima_acao_at.lt.${cutoffISO},ultima_acao_at.is.null`)
        .order("ultima_acao_at", { ascending: true, nullsFirst: true })
        .limit(8);
      const esfriando = (coldData || []).map((l: any) => {
        const dt = l.ultima_acao_at ? new Date(l.ultima_acao_at) : null;
        const diasParado = dt ? Math.floor((Date.now() - dt.getTime()) / 86400000) : null;
        return { id: l.id, nome: l.nome, empreendimento: l.empreendimento, dias_parado: diasParado };
      });

      const nAgora = atrasadas.length + hoje.length;
      return {
        result: { tipo: "meu_dia", today, atrasadas, hoje, visitas_hoje: visitasHoje, esfriando, dias },
        modelResult: `Meu dia montado: ${nAgora} pendências agora (${atrasadas.length} atrasadas), ${visitasHoje.length} visitas hoje, ${esfriando.length} leads esfriando. As seções já apareceram na tela com botões de ação. Responda em NO MÁXIMO 1 frase dizendo por onde começar (ex: foco na pendência mais antiga e na visita mais próxima). Não repita a lista.`,
      };
    }

    if (name === "ver_pendencias") {
      const escopo = args.escopo || "tudo";
      const today = todayBRT();
      const out: Record<string, unknown> = { tipo: "pendencias", today };

      if (escopo === "tudo" || escopo === "tarefas") {
        const { data: tarefas } = await userClient
          .from("pipeline_tarefas")
          .select("id, titulo, tipo, vence_em, hora_vencimento, pipeline_lead_id, status")
          .eq("responsavel_id", uid)
          .eq("status", "pendente")
          .order("vence_em", { ascending: true })
          .limit(40);
        const rows = tarefas || [];
        // resolve lead names
        const leadIds = [...new Set(rows.map((r: any) => r.pipeline_lead_id).filter(Boolean))];
        let nameMap = new Map<string, string>();
        if (leadIds.length) {
          const { data: leads } = await userClient.from("pipeline_leads").select("id, nome").in("id", leadIds);
          nameMap = new Map((leads || []).map((l: any) => [l.id, l.nome]));
        }
        const withNames = rows.map((r: any) => ({ ...r, lead_nome: nameMap.get(r.pipeline_lead_id) || "Lead" }));
        out.atrasadas = withNames.filter((r: any) => r.vence_em && r.vence_em < today);
        out.hoje = withNames.filter((r: any) => r.vence_em === today);
      }
      if (escopo === "tudo" || escopo === "visitas") {
        const { data: visitas } = await userClient
          .from("visitas")
          .select("id, nome_cliente, empreendimento, data_visita, hora_visita, local_visita, status, pipeline_lead_id")
          .eq("corretor_id", uid)
          .eq("data_visita", today)
          .order("hora_visita", { ascending: true })
          .limit(20);
        out.visitas_hoje = visitas || [];
      }

      const nAtras = (out.atrasadas as any[])?.length || 0;
      const nHoje = (out.hoje as any[])?.length || 0;
      const nVis = (out.visitas_hoje as any[])?.length || 0;
      return {
        result: out,
        modelResult: `Encontrado: ${nAtras} tarefas atrasadas, ${nHoje} tarefas para hoje, ${nVis} visitas hoje. A lista já foi exibida ao corretor. Faça um resumo curto e sugira por onde começar.`,
      };
    }

    if (name === "buscar_imovel") {
      const SELECT = "id, codigo, titulo, empreendimento, bairro, cidade, regiao, tipo, valor_venda, valor_condominio, mobiliado, dormitorios, suites, vagas, area_privativa, fotos";
      const mapRows = (data: any[]) => (data || []).map((r: any) => ({
        id: r.id,
        codigo: r.codigo,
        titulo: r.titulo,
        empreendimento: r.empreendimento,
        bairro: r.bairro,
        cidade: r.cidade,
        zona: r.regiao,
        tipo: r.tipo,
        valor_venda: r.valor_venda,
        valor_condominio: r.valor_condominio,
        mobiliado: r.mobiliado,
        dormitorios: r.dormitorios,
        suites: r.suites,
        vagas: r.vagas,
        area: r.area_privativa,
        fotos: Array.isArray(r.fotos) ? r.fotos.slice(0, 8) : [],
        thumb: Array.isArray(r.fotos) ? r.fotos[0] : null,
      }));


      // Normaliza o texto: separa em tokens úteis (ignora conectivos curtos)
      const rawTermo = `${args.termo || ""} ${args.bairro || ""}`.trim();
      const stop = new Set(["de", "da", "do", "com", "para", "em", "no", "na", "e", "dorms", "dorm", "dormitorios", "quartos", "apartamento", "apto", "casa", "imovel", "mobiliado", "mobiliada"]);
      const tokens = rawTermo
        .toLowerCase()
        .replace(/['"]/g, "")
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !stop.has(t));
      const strongest = [...tokens].sort((a, b) => b.length - a.length)[0];

      const num = (v: any) => (typeof v === "number" && !isNaN(v) ? v : undefined);
      const dorms = num(args.dormitorios);
      const dormsExato = args.dormitorios_exato !== false; // padrão: número fechado
      const vMin = num(args.valor_min);
      const vMax = num(args.valor_max);
      const wantMobiliado = args.mobiliado === true;
      const suitesMin = num(args.suites_min);
      const vagasMin = num(args.vagas_min);
      const areaMin = num(args.area_min);
      const tipoTxt = typeof args.tipo === "string" && args.tipo.trim().length >= 3 ? args.tipo.trim() : "";

      // Zona de Porto Alegre (Norte / Central / Leste / Sul / Metropolitana)
      const zonaRaw = typeof args.zona === "string" ? args.zona.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
      const zona = /norte/.test(zonaRaw) ? "Norte"
        : /(central|centro)/.test(zonaRaw) ? "Central"
        : /leste/.test(zonaRaw) ? "Leste"
        : /sul/.test(zonaRaw) ? "Sul"
        : /(metropolitan|grande porto|litoral)/.test(zonaRaw) ? "Metropolitana"
        : "";

      type Opts = {
        mobiliado: boolean; extras: boolean; dormsExato: boolean; faixa: "estrita" | "ampliada" | "off";
        tokens: "todos" | "principal" | "nenhum"; tipo: boolean;
      };

      const build = (o: Opts) => {
        let q = userClient.from("properties").select(SELECT).eq("ativo", true).not("valor_venda", "is", null);
        if (zona) q = q.eq("regiao", zona);
        if (dorms !== undefined) q = o.dormsExato ? q.eq("dormitorios", dorms) : q.gte("dormitorios", dorms);
        if (o.faixa !== "off") {
          const fator = o.faixa === "ampliada" ? 0.2 : 0;
          if (vMin !== undefined) q = q.gte("valor_venda", Math.round(vMin * (1 - fator)));
          if (vMax !== undefined) q = q.lte("valor_venda", Math.round(vMax * (1 + fator)));
        }
        if (o.mobiliado && wantMobiliado) q = q.eq("mobiliado", true);
        if (o.extras) {
          if (suitesMin !== undefined) q = q.gte("suites", suitesMin);
          if (vagasMin !== undefined) q = q.gte("vagas", vagasMin);
          if (areaMin !== undefined) q = q.gte("area_privativa", areaMin);
        }
        if (o.tipo && tipoTxt) q = q.ilike("tipo", `%${tipoTxt}%`);
        const tks = o.tokens === "todos" ? tokens : o.tokens === "principal" ? (strongest ? [strongest] : []) : [];
        for (const tk of tks) {
          q = q.or(`bairro.ilike.%${tk}%,empreendimento.ilike.%${tk}%,titulo.ilike.%${tk}%,cidade.ilike.%${tk}%`);
        }
        return q.order("valor_venda", { ascending: true }).limit(6);
      };

      const full: Opts = { mobiliado: true, extras: true, dormsExato: true, faixa: "estrita", tokens: "todos", tipo: true };
      const tentativas: { opts: Opts; relaxou: string[] }[] = [
        { opts: full, relaxou: [] },
        { opts: { ...full, tokens: "principal" }, relaxou: [] },
        { opts: { ...full, tokens: "principal", extras: false }, relaxou: suitesMin || vagasMin || areaMin ? ["suítes/vagas/área"] : [] },
        { opts: { ...full, tokens: "principal", extras: false, tipo: false }, relaxou: [tipoTxt ? "tipo do imóvel" : ""].filter(Boolean) },
        { opts: { ...full, tokens: "principal", extras: false, tipo: false, dormsExato: false }, relaxou: [dorms !== undefined && dormsExato ? `dormitórios (aceitando ${dorms}+)` : ""].filter(Boolean) },
        { opts: { ...full, tokens: "principal", extras: false, tipo: false, dormsExato: false, mobiliado: false }, relaxou: [wantMobiliado ? "mobiliado" : ""].filter(Boolean) },
        { opts: { ...full, tokens: "principal", extras: false, tipo: false, dormsExato: false, mobiliado: false, faixa: "ampliada" }, relaxou: [(vMin || vMax) ? "faixa de valor (±20%)" : ""].filter(Boolean) },
      ];

      let imoveis: any[] = [];
      const relaxados: string[] = [];
      for (const t of tentativas) {
        const { data, error } = await build(t.opts);
        if (error) {
          console.error("[buscar_imovel] error:", error);
          return { modelResult: "Não consegui buscar imóveis agora." };
        }
        for (const r of t.relaxou) if (!relaxados.includes(r)) relaxados.push(r);
        imoveis = mapRows(data || []);
        if (imoveis.length > 0) break;
      }

      const criterios = [
        dorms !== undefined ? `${dorms} dorm${dormsExato ? "" : "+"}` : "",
        vMin !== undefined || vMax !== undefined
          ? `${vMin !== undefined ? "de " + fmtBRL(vMin) : ""}${vMax !== undefined ? (vMin !== undefined ? " até " : "até ") + fmtBRL(vMax) : ""}`
          : "",
        wantMobiliado ? "mobiliado" : "",
        zona ? (zona === "Metropolitana" ? "Região Metropolitana" : `Zona ${zona}`) : "",
        rawTermo || "",
      ].filter(Boolean).join(" · ");

      if (imoveis.length === 0) {
        return {
          result: { tipo: "imoveis", imoveis: [], criterios },
          modelResult: `Nenhum imóvel encontrado para: ${criterios}. Diga isso em 1 frase e sugira ampliar 1 critério específico (faixa de valor, bairro ou mobiliado).`,
        };
      }

      const aproximado = relaxados.length > 0;

      // Critérios pedidos + o que cada imóvel atende (para os selos no card)
      const pedidos = {
        dormitorios: dorms !== undefined,
        vagas: vagasMin !== undefined,
        suites: suitesMin !== undefined,
        area: areaMin !== undefined,
        valor: vMin !== undefined || vMax !== undefined,
        mobiliado: wantMobiliado,
      };
      const imoveisComMatch = imoveis.map((im: any) => ({
        ...im,
        match: {
          dormitorios: dorms === undefined ? null : (dormsExato ? im.dormitorios === dorms : (im.dormitorios ?? 0) >= dorms),
          vagas: vagasMin === undefined ? null : (im.vagas ?? 0) >= vagasMin,
          suites: suitesMin === undefined ? null : (im.suites ?? 0) >= suitesMin,
          area: areaMin === undefined ? null : (im.area ?? 0) >= areaMin,
          valor: !pedidos.valor ? null : (
            (vMin === undefined || (im.valor_venda ?? 0) >= vMin) &&
            (vMax === undefined || (im.valor_venda ?? Infinity) <= vMax)
          ),
          mobiliado: !wantMobiliado ? null : im.mobiliado === true,
        },
      }));

      return {
        result: { tipo: "imoveis", imoveis: imoveisComMatch, aproximado, criterios, relaxados, pedidos },

        modelResult: aproximado
          ? `Busca "${criterios}": não havia correspondência exata, relaxei ${relaxados.join(" e ")} e trouxe ${imoveis.length} opções (já exibidas na tela). Responda em 1 frase repetindo o critério entendido e AVISANDO explicitamente o que foi relaxado.`
          : `Busca "${criterios}": ${imoveis.length} imóveis dentro do pedido (já exibidos na tela com botão de WhatsApp). Responda em 1 frase confirmando o critério entendido e o destaque. Não repita a lista.`,
      };
    }



    if (name === "criar_tarefa") {
      const r = await resolveLead(userClient, uid, args.lead_nome);
      if ((r as any).none) return { modelResult: `Não achei nenhum lead com "${args.lead_nome}". Peça ao corretor para conferir o nome.` };
      if ((r as any).candidates) {
        return {
          result: { tipo: "escolher_lead", intent: "criar_tarefa", candidates: (r as any).candidates, args },
          modelResult: `Achei vários leads com "${args.lead_nome}". A lista de escolha já apareceu. Peça para o corretor selecionar qual.`,
        };
      }
      const lead = (r as any).lead;
      const action = {
        tipo: "criar_tarefa",
        lead_id: lead.id,
        lead_nome: lead.nome,
        campos: {
          tipo: args.tipo || "follow_up",
          tipo_personalizado: args.tipo_personalizado || "",
          vence_em: args.data || todayBRT(),
          hora_vencimento: args.hora || "",
          descricao: args.observacao || "",
        },
      };
      return {
        action,
        modelResult: `Tarefa preparada para ${lead.nome}. O cartão de confirmação já apareceu na tela. Diga em 1 frase para o corretor revisar e confirmar.`,
      };
    }

    if (name === "criar_visita") {
      const r = await resolveLead(userClient, uid, args.lead_nome);
      if ((r as any).none) return { modelResult: `Não achei nenhum lead com "${args.lead_nome}". Peça ao corretor para conferir o nome.` };
      if ((r as any).candidates) {
        return {
          result: { tipo: "escolher_lead", intent: "criar_visita", candidates: (r as any).candidates, args },
          modelResult: `Achei vários leads com "${args.lead_nome}". A lista de escolha já apareceu. Peça para o corretor selecionar qual.`,
        };
      }
      const lead = (r as any).lead;
      const action = {
        tipo: "criar_visita",
        lead_id: lead.id,
        lead_nome: lead.nome,
        campos: {
          nome_cliente: lead.nome,
          telefone: lead.telefone || "",
          empreendimento: args.empreendimento || lead.empreendimento || "",
          data_visita: args.data || todayBRT(),
          hora_visita: args.hora || "",
          local_visita: args.local || "",
          responsavel_visita: "proprio_corretor",
          observacoes: args.observacao || "",
        },
      };
      return {
        action,
        modelResult: `Visita preparada para ${lead.nome}. O cartão de confirmação já apareceu na tela. Diga em 1 frase para o corretor revisar e confirmar.`,
      };
    }

    if (name === "resumo_lead") {
      const r = await resolveLead(userClient, uid, args.lead_nome);
      if ((r as any).none) return { modelResult: `Não achei nenhum lead com "${args.lead_nome}".` };
      if ((r as any).candidates) {
        return {
          result: { tipo: "escolher_lead", intent: "resumo_lead", candidates: (r as any).candidates, args },
          modelResult: `Achei vários leads com "${args.lead_nome}". Peça para o corretor selecionar qual.`,
        };
      }
      const lead = (r as any).lead;
      const today = todayBRT();

      // Etapa
      let stageNome = "";
      if (lead.stage_id) {
        const { data: st } = await userClient.from("pipeline_stages").select("nome").eq("id", lead.stage_id).maybeSingle();
        stageNome = st?.nome || "";
      }
      // Próximas tarefas
      const { data: tarefas } = await userClient
        .from("pipeline_tarefas")
        .select("id, titulo, tipo, vence_em, hora_vencimento, status")
        .eq("pipeline_lead_id", lead.id)
        .eq("status", "pendente")
        .order("vence_em", { ascending: true })
        .limit(3);
      // Última atividade
      const { data: atividades } = await userClient
        .from("pipeline_atividades")
        .select("titulo, data, created_at")
        .eq("pipeline_lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const ultima = atividades?.[0];

      const proximas = tarefas || [];
      const temAtrasada = proximas.some((t: any) => t.vence_em && t.vence_em < today);
      let sugestao = "";
      if (temAtrasada) sugestao = "Há tarefa atrasada — priorize o contato hoje.";
      else if (proximas.length === 0) sugestao = "Sem próxima tarefa agendada. Crie um follow-up para manter a cadência.";
      else sugestao = "Siga a próxima tarefa agendada e conduza para uma visita.";

      const out = {
        tipo: "resumo_lead",
        lead: { id: lead.id, nome: lead.nome, telefone: lead.telefone, empreendimento: lead.empreendimento, stage_nome: stageNome },
        proximas_tarefas: proximas,
        ultima_interacao: ultima ? `${ultima.titulo || "atividade"}${ultima.data ? " · " + ultima.data : ""}` : null,
        sugestao_proxima_acao: sugestao,
      };
      return {
        result: out,
        modelResult: `Resumo de ${lead.nome} exibido no cartão. Comente em 1 frase a próxima ação recomendada.`,
      };
    }

    if (name === "anotar_lead") {
      const r = await resolveLead(userClient, uid, args.lead_nome);
      if ((r as any).none) return { modelResult: `Não achei nenhum lead com "${args.lead_nome}".` };
      if ((r as any).candidates) {
        return {
          result: { tipo: "escolher_lead", intent: "anotar_lead", candidates: (r as any).candidates, args },
          modelResult: `Achei vários leads com "${args.lead_nome}". Peça para o corretor selecionar qual.`,
        };
      }
      const lead = (r as any).lead;
      return {
        action: { tipo: "anotar_lead", lead_id: lead.id, lead_nome: lead.nome, texto: args.texto || "" },
        modelResult: `Anotação preparada para ${lead.nome}. Peça ao corretor para revisar e confirmar.`,
      };
    }

    if (name === "contexto_lead") {
      const r = await resolveLead(userClient, uid, args.lead_nome);
      if ((r as any).none) return { modelResult: `Não achei nenhum lead com "${args.lead_nome}". Peça ao corretor para conferir o nome.` };
      if ((r as any).candidates) {
        return {
          result: { tipo: "escolher_lead", intent: "contexto_lead", candidates: (r as any).candidates, args },
          modelResult: `Achei vários leads com "${args.lead_nome}". A lista de escolha já apareceu. Peça para o corretor selecionar qual.`,
        };
      }
      const lead = (r as any).lead;
      const hist = await readLeadHistory(userClient, lead);

      const out = {
        tipo: "contexto_lead",
        lead: { id: lead.id, nome: lead.nome, telefone: lead.telefone, empreendimento: lead.empreendimento, stage_nome: hist.stageNome, flag_status: hist.flagStatus },
        ultima_interacao: hist.ultima,
        n_anotacoes: hist.anotacoes.length,
      };

      const semHistorico = hist.atividades.length === 0 && hist.anotacoes.length === 0 && !hist.stageNome;
      const contextoTxt = [
        `Etapa: ${hist.stageNome || "—"}${hist.flagStatus ? " (" + hist.flagStatus + ")" : ""}`,
        hist.empreendimento ? `Empreendimento: ${hist.empreendimento}` : "",
        hist.atividades.length ? `Timeline (mais recente primeiro):\n${hist.atividades.map((a: any) => `- ${a.data || ""} ${a.titulo || a.tipo || ""}${a.descricao ? ": " + a.descricao : ""}`).join("\n")}` : "Sem atividades registradas.",
        hist.anotacoes.length ? `Anotações do corretor:\n${hist.anotacoes.map((n: any) => `- ${n.conteudo}`).join("\n")}` : "",
      ].filter(Boolean).join("\n");

      return {
        result: out,
        modelResult: semHistorico
          ? `O lead ${lead.nome} não tem histórico. Faça 1 pergunta rápida para entender o momento antes de escrever.`
          : `HISTÓRICO DE ${lead.nome}:\n${contextoTxt}\n\nCom base nisso: (1) faça um mini-resumo de 1 linha do momento do lead; (2) JÁ escreva a mensagem de WhatsApp pronta (máx 3 linhas, natural, termina com pergunta). NÃO pergunte o momento do funil — você já tem o contexto.`,
      };
    }

    if (name === "registrar_resultado") {
      const r = await resolveLead(userClient, uid, args.lead_nome);
      if ((r as any).none) return { modelResult: `Não achei nenhum lead com "${args.lead_nome}".` };
      if ((r as any).candidates) {
        return {
          result: { tipo: "escolher_lead", intent: "registrar_resultado", candidates: (r as any).candidates, args },
          modelResult: `Achei vários leads com "${args.lead_nome}". Peça para o corretor selecionar qual.`,
        };
      }
      const lead = (r as any).lead;
      const RES: Record<string, { label: string; tarefa: string; tipoTarefa: string }> = {
        nao_atendeu: { label: "☎️ Não atendeu", tarefa: "Tentar ligar de novo", tipoTarefa: "ligar" },
        atendeu_sem_interesse: { label: "🙅 Sem interesse", tarefa: "Follow-up de reengajamento", tipoTarefa: "follow_up" },
        atendeu_interessado: { label: "🔥 Interessado", tarefa: "Marcar visita", tipoTarefa: "marcar_visita" },
        pediu_retorno: { label: "🔁 Pediu retorno", tarefa: "Retornar contato", tipoTarefa: "ligar" },
        agendou_visita: { label: "🏠 Agendou visita", tarefa: "Confirmar visita", tipoTarefa: "marcar_visita" },
      };
      const meta = RES[args.resultado] || RES.pediu_retorno;
      const action = {
        tipo: "registrar_resultado",
        lead_id: lead.id,
        lead_nome: lead.nome,
        resultado: args.resultado,
        resultado_label: meta.label,
        detalhe: args.detalhe || "",
        proxima_tarefa: { tipo: meta.tipoTarefa, titulo: meta.tarefa },
      };
      return {
        action,
        modelResult: `Resultado preparado para ${lead.nome} (${meta.label}). O cartão de confirmação apareceu com a próxima tarefa sugerida. Diga 1 frase para o corretor confirmar.`,
      };
    }

    if (name === "leads_esfriando") {
      const dias = typeof args.dias === "number" && args.dias > 0 ? args.dias : 5;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - dias);
      const cutoffISO = cutoff.toISOString();
      const { data } = await userClient
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento, ultima_acao_at, stage_id")
        .eq("corretor_id", uid)
        .eq("arquivado", false)
        .or(`ultima_acao_at.lt.${cutoffISO},ultima_acao_at.is.null`)
        .order("ultima_acao_at", { ascending: true, nullsFirst: true })
        .limit(15);
      const rows = (data || []).map((l: any) => {
        const dt = l.ultima_acao_at ? new Date(l.ultima_acao_at) : null;
        const diasParado = dt ? Math.floor((Date.now() - dt.getTime()) / 86400000) : null;
        return { id: l.id, nome: l.nome, empreendimento: l.empreendimento, dias_parado: diasParado };
      });
      return {
        result: { tipo: "leads_esfriando", dias, leads: rows },
        modelResult: rows.length
          ? `${rows.length} leads esfriando (sem contato há ${dias}+ dias) já exibidos com ações de reengajar. Comente em 1 frase por onde começar.`
          : `Nenhum lead esfriando há mais de ${dias} dias. Parabenize o corretor pela cadência em 1 frase.`,
      };
    }

    if (name === "preparar_visita") {
      const today = todayBRT();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      let lead: any = null;
      let visitaInfo = "";
      if (args.lead_nome) {
        const r = await resolveLead(userClient, uid, args.lead_nome);
        if ((r as any).lead) lead = (r as any).lead;
        else if ((r as any).candidates) {
          return {
            result: { tipo: "escolher_lead", intent: "preparar_visita", candidates: (r as any).candidates, args },
            modelResult: `Achei vários leads com "${args.lead_nome}". Peça para o corretor selecionar qual.`,
          };
        } else return { modelResult: `Não achei nenhum lead com "${args.lead_nome}".` };
      } else {
        const { data: visitas } = await userClient
          .from("visitas")
          .select("nome_cliente, empreendimento, data_visita, hora_visita, local_visita, pipeline_lead_id")
          .eq("corretor_id", uid)
          .in("data_visita", [today, tomorrowStr])
          .order("data_visita", { ascending: true })
          .limit(1);
        const v = visitas?.[0];
        if (!v) return { modelResult: "Não há visitas agendadas para hoje ou amanhã. Peça ao corretor o nome do lead para preparar." };
        visitaInfo = `Visita: ${v.data_visita}${v.hora_visita ? " " + v.hora_visita.slice(0, 5) : ""}${v.empreendimento ? " · " + v.empreendimento : ""}${v.local_visita ? " · " + v.local_visita : ""}`;
        if (v.pipeline_lead_id) {
          const { data: ld } = await userClient.from("pipeline_leads").select("id, nome, telefone, empreendimento, stage_id").eq("id", v.pipeline_lead_id).maybeSingle();
          lead = ld;
        } else {
          lead = { nome: v.nome_cliente, empreendimento: v.empreendimento };
        }
      }

      let contextoTxt = "";
      if (lead?.id) {
        const hist = await readLeadHistory(userClient, lead);
        contextoTxt = [
          `Etapa: ${hist.stageNome || "—"}`,
          hist.empreendimento ? `Empreendimento: ${hist.empreendimento}` : "",
          hist.atividades.length ? `Últimas interações:\n${hist.atividades.slice(0, 5).map((a: any) => `- ${a.data || ""} ${a.titulo || a.tipo || ""}`).join("\n")}` : "",
          hist.anotacoes.length ? `Anotações:\n${hist.anotacoes.map((n: any) => `- ${n.conteudo}`).join("\n")}` : "",
        ].filter(Boolean).join("\n");
      }

      return {
        result: { tipo: "preparar_visita", lead: { id: lead?.id, nome: lead?.nome, empreendimento: lead?.empreendimento } },
        modelResult: `BRIEFING PRÉ-VISITA de ${lead?.nome || "cliente"}.\n${visitaInfo}\n${contextoTxt}\n\nMonte um briefing curto e prático: (1) quem é o lead e momento; (2) imóvel/empreendimento de interesse; (3) 2-3 argumentos de venda fortes desse empreendimento (use o conhecimento da base). Formato objetivo em tópicos.`,
      };
    }

    if (name === "fila_execucao") {
      const fila = args.fila === "leads_sem_tarefa" ? "leads_sem_tarefa" : "tarefas_atrasadas";
      const lote = args.lote === 3 ? 3 : 1;
      const today = todayBRT();

      if (fila === "tarefas_atrasadas") {
        const { data: tarefas } = await userClient
          .from("pipeline_tarefas")
          .select("id, titulo, tipo, descricao, vence_em, hora_vencimento, pipeline_lead_id")
          .eq("responsavel_id", uid)
          .eq("status", "pendente")
          .lt("vence_em", today)
          .order("vence_em", { ascending: true })
          .limit(40);
        const rows = tarefas || [];
        const ctx = await leadContextoCurto(userClient, [...new Set(rows.map((r: any) => r.pipeline_lead_id).filter(Boolean))]);
        const itens = rows.map((t: any) => {
          const l = ctx.get(t.pipeline_lead_id) || {};
          const atrasoDias = t.vence_em ? Math.max(0, Math.floor((new Date(today).getTime() - new Date(t.vence_em).getTime()) / 86400000)) : 0;
          return {
            tarefa_id: t.id,
            titulo: t.titulo || t.tipo,
            tipo: t.tipo,
            vence_em: t.vence_em,
            hora: t.hora_vencimento,
            atraso_dias: atrasoDias,
            lead_id: t.pipeline_lead_id,
            lead_nome: l.nome || "Lead",
            telefone: l.telefone || "",
            empreendimento: l.empreendimento || "",
            stage_nome: l.stage_nome || "",
            dias_parado: l.dias_parado ?? null,
          };
        });
        if (!itens.length) {
          return {
            result: { tipo: "fila_execucao", fila, lote, total: 0, itens: [] },
            modelResult: "Nenhuma tarefa atrasada. Parabenize a cadência em 1 frase e ofereça revisar os leads sem tarefa.",
          };
        }
        const resumo = itens.slice(0, lote).map((i: any) => `${i.lead_nome} (${i.stage_nome || "sem etapa"}, ${i.titulo}, ${i.atraso_dias}d de atraso, empreendimento ${i.empreendimento || "—"})`).join(" | ");
        return {
          result: { tipo: "fila_execucao", fila, lote, total: itens.length, itens },
          modelResult: `Fila de ${itens.length} tarefas atrasadas montada, mostrando ${lote} por vez. Primeiros: ${resumo}. Para CADA um desses, escreva em 1-2 linhas a sugestão de ação + a mensagem de WhatsApp pronta (curta, natural, terminando em pergunta que puxe visita). Não repita a lista inteira nem dados que já estão nos cartões.`,
        };
      }

      // leads_sem_tarefa
      const { data: leads } = await userClient
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento, stage_id, ultima_acao_at")
        .eq("corretor_id", uid)
        .eq("arquivado", false)
        .order("ultima_acao_at", { ascending: true, nullsFirst: true })
        .limit(200);
      const leadRows = leads || [];
      const ids = leadRows.map((l: any) => l.id);
      let comTarefa = new Set<string>();
      if (ids.length) {
        const { data: pend } = await userClient
          .from("pipeline_tarefas")
          .select("pipeline_lead_id")
          .eq("status", "pendente")
          .in("pipeline_lead_id", ids);
        comTarefa = new Set((pend || []).map((t: any) => t.pipeline_lead_id));
      }
      const semTarefa = leadRows.filter((l: any) => !comTarefa.has(l.id)).slice(0, 30);
      const ctx = await leadContextoCurto(userClient, semTarefa.map((l: any) => l.id));
      const itens = semTarefa.map((l: any) => {
        const c = ctx.get(l.id) || {};
        return {
          lead_id: l.id,
          lead_nome: l.nome,
          telefone: l.telefone || "",
          empreendimento: l.empreendimento || "",
          stage_nome: c.stage_nome || "",
          dias_parado: c.dias_parado ?? null,
        };
      });
      if (!itens.length) {
        return {
          result: { tipo: "fila_execucao", fila, lote, total: 0, itens: [] },
          modelResult: "Todos os leads ativos têm próxima tarefa agendada. Elogie a cadência em 1 frase.",
        };
      }
      const resumo = itens.slice(0, lote).map((i: any) => `${i.lead_nome} (${i.stage_nome || "sem etapa"}, ${i.empreendimento || "—"}, parado há ${i.dias_parado ?? "?"}d)`).join(" | ");
      return {
        result: { tipo: "fila_execucao", fila, lote, total: itens.length, itens },
        modelResult: `Fila de ${itens.length} leads SEM próxima tarefa, mostrando ${lote} por vez. Primeiros: ${resumo}. Para CADA um, sugira em 1 linha qual próxima tarefa criar (tipo e prazo) e já entregue a mensagem de WhatsApp pronta. Não repita a lista.`,
      };
    }

    if (name === "visitas_a_confirmar") {
      const dias = typeof args.dias === "number" && args.dias > 0 ? Math.min(args.dias, 14) : 3;
      const today = todayBRT();
      const limite = addDaysBRT(dias);
      const { data } = await userClient
        .from("visitas")
        .select("id, nome_cliente, empreendimento, data_visita, hora_visita, local_visita, status, pipeline_lead_id")
        .eq("corretor_id", uid)
        .gte("data_visita", today)
        .lte("data_visita", limite)
        .in("status", ["marcada", "reagendada"])
        .order("data_visita", { ascending: true })
        .limit(30);
      const visitas = data || [];
      return {
        result: { tipo: "visitas_pendentes", modo: "confirmar", visitas, janela_dias: dias },
        modelResult: visitas.length
          ? `${visitas.length} visitas a confirmar nos próximos ${dias} dias (já exibidas em cartões com botão de confirmar): ${visitas.map((v: any) => `${v.nome_cliente} ${v.data_visita}${v.hora_visita ? " " + String(v.hora_visita).slice(0, 5) : ""}`).join(", ")}. Escreva UMA mensagem de confirmação curta e natural que sirva de modelo (com [nome], data e hora). Não repita a lista.`
          : `Nenhuma visita pendente de confirmação nos próximos ${dias} dias. Diga isso em 1 frase.`,
      };
    }

    if (name === "visitas_pendentes_resultado") {
      const today = todayBRT();
      const { data } = await userClient
        .from("visitas")
        .select("id, nome_cliente, empreendimento, data_visita, hora_visita, local_visita, status, pipeline_lead_id")
        .eq("corretor_id", uid)
        .lt("data_visita", today)
        .in("status", ["marcada", "confirmada", "reagendada"])
        .order("data_visita", { ascending: false })
        .limit(30);
      const visitas = data || [];
      return {
        result: { tipo: "visitas_pendentes", modo: "resultado", visitas },
        modelResult: visitas.length
          ? `${visitas.length} visitas já passaram e continuam sem resultado registrado (cartões na tela com botão de abrir o lead para registrar). Diga em 1 frase que registrar isso é o que destrava o funil e cite a mais antiga.`
          : "Nenhuma visita passada sem resultado. Elogie em 1 frase o controle da agenda.",
      };
    }

    if (name === "briefing_do_dia") {
      const today = todayBRT();
      const limite3 = addDaysBRT(3);

      const { data: tarefas } = await userClient
        .from("pipeline_tarefas")
        .select("id, titulo, tipo, vence_em, pipeline_lead_id")
        .eq("responsavel_id", uid)
        .eq("status", "pendente")
        .lte("vence_em", today)
        .order("vence_em", { ascending: true })
        .limit(100);
      const tRows = tarefas || [];
      const atrasadas = tRows.filter((t: any) => t.vence_em && t.vence_em < today);
      const hoje = tRows.filter((t: any) => t.vence_em === today);

      const { data: visitasHoje } = await userClient
        .from("visitas")
        .select("id, nome_cliente, hora_visita, empreendimento")
        .eq("corretor_id", uid)
        .eq("data_visita", today)
        .order("hora_visita", { ascending: true })
        .limit(20);

      const { data: aConfirmar } = await userClient
        .from("visitas")
        .select("id, nome_cliente, data_visita")
        .eq("corretor_id", uid)
        .gte("data_visita", today)
        .lte("data_visita", limite3)
        .in("status", ["marcada", "reagendada"])
        .limit(30);

      const { data: semResultado } = await userClient
        .from("visitas")
        .select("id, nome_cliente, data_visita")
        .eq("corretor_id", uid)
        .lt("data_visita", today)
        .in("status", ["marcada", "confirmada", "reagendada"])
        .limit(30);

      const { data: leadsAtivos } = await userClient
        .from("pipeline_leads")
        .select("id, ultima_acao_at")
        .eq("corretor_id", uid)
        .eq("arquivado", false)
        .limit(500);
      const ativos = leadsAtivos || [];
      let comTarefa = new Set<string>();
      if (ativos.length) {
        const { data: pend } = await userClient
          .from("pipeline_tarefas")
          .select("pipeline_lead_id")
          .eq("status", "pendente")
          .in("pipeline_lead_id", ativos.map((l: any) => l.id));
        comTarefa = new Set((pend || []).map((t: any) => t.pipeline_lead_id));
      }
      const semTarefa = ativos.filter((l: any) => !comTarefa.has(l.id));
      const cutoff = Date.now() - 5 * 86400000;
      const esfriando = ativos.filter((l: any) => !l.ultima_acao_at || new Date(l.ultima_acao_at).getTime() < cutoff);

      const numeros = {
        tarefas_atrasadas: atrasadas.length,
        tarefas_hoje: hoje.length,
        visitas_hoje: (visitasHoje || []).length,
        visitas_a_confirmar: (aConfirmar || []).length,
        visitas_sem_resultado: (semResultado || []).length,
        leads_sem_tarefa: semTarefa.length,
        leads_esfriando: esfriando.length,
      };

      return {
        result: { tipo: "briefing_dia", today, numeros, visitas_hoje: visitasHoje || [] },
        modelResult: `BRIEFING DO DIA (números já exibidos em cartão): ${JSON.stringify(numeros)}. Escreva um briefing OBJETIVO em tópicos curtos: (1) 3 a 5 prioridades em ordem, cada uma com motivo + próximo passo; (2) uma linha "Risco do dia" — o que se não for feito hoje custa venda; (3) termine oferecendo iniciar a fila (ex: "quer resolver as ${numeros.tarefas_atrasadas} atrasadas agora, de 3 em 3?"). Não repita os números crus, use-os nas prioridades.`,
      };
    }

    return { modelResult: `Ferramenta desconhecida: ${name}` };
  } catch (e) {
    console.error("[executeHomiTool] error:", name, e);
    return { modelResult: "Ocorreu um erro ao executar a ação." };
  }
}
