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
        "Busca imóveis no catálogo da Uhome. Use quando o corretor pedir para encontrar/buscar um imóvel. Receba o texto livre do corretor em `termo` (ex: '2 dorms no Petrópolis até 600 mil') e EXTRAIA você mesmo dormitórios e valor máximo para os campos, deixando em `termo` só bairro/empreendimento/tipo.",
      parameters: {
        type: "object",
        properties: {
          termo: { type: "string", description: "Bairro, empreendimento ou tipo (texto livre, sem número de dorms nem valor)." },
          dormitorios: { type: "number", description: "Número mínimo de dormitórios extraído do texto." },
          valor_max: { type: "number", description: "Valor de venda máximo em reais extraído do texto." },
        },
      },
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
];


function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
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
      const SELECT = "id, codigo, titulo, empreendimento, bairro, cidade, tipo, valor_venda, dormitorios, suites, vagas, area_privativa, fotos";
      const mapRows = (data: any[]) => (data || []).map((r: any) => ({
        codigo: r.codigo,
        titulo: r.titulo,
        empreendimento: r.empreendimento,
        bairro: r.bairro,
        tipo: r.tipo,
        valor_venda: r.valor_venda,
        dormitorios: r.dormitorios,
        suites: r.suites,
        vagas: r.vagas,
        area: r.area_privativa,
        thumb: Array.isArray(r.fotos) ? r.fotos[0] : null,
      }));

      // Normaliza o texto: separa em tokens úteis (ignora conectivos curtos)
      const rawTermo = `${args.termo || ""} ${args.bairro || ""}`.trim();
      const stop = new Set(["de", "da", "do", "com", "para", "em", "no", "na", "e", "dorms", "dorm", "dormitorios", "quartos"]);
      const tokens = rawTermo
        .toLowerCase()
        .replace(/['"]/g, "")
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !stop.has(t));

      const baseFilters = (q0: any) => {
        let q = q0.eq("ativo", true).not("valor_venda", "is", null);
        if (typeof args.dormitorios === "number") q = q.gte("dormitorios", args.dormitorios);
        if (typeof args.valor_max === "number") q = q.lte("valor_venda", args.valor_max);
        return q;
      };

      // 1) Busca estrita: todos os tokens precisam bater em algum campo textual
      let strict = baseFilters(userClient.from("properties").select(SELECT)).limit(6);
      for (const tk of tokens) {
        strict = strict.or(`bairro.ilike.%${tk}%,empreendimento.ilike.%${tk}%,titulo.ilike.%${tk}%,cidade.ilike.%${tk}%`);
      }
      strict = strict.order("valor_venda", { ascending: true });
      const { data: strictData, error } = await strict;
      if (error) {
        console.error("[buscar_imovel] error:", error);
        return { modelResult: "Não consegui buscar imóveis agora." };
      }

      let imoveis = mapRows(strictData || []);
      let aproximado = false;

      // 2) Fallback: se não achou, relaxa (só dorms/valor, ou o token mais forte)
      if (imoveis.length === 0) {
        let loose = baseFilters(userClient.from("properties").select(SELECT)).limit(6);
        const strongest = [...tokens].sort((a, b) => b.length - a.length)[0];
        if (strongest) {
          loose = loose.or(`bairro.ilike.%${strongest}%,empreendimento.ilike.%${strongest}%,titulo.ilike.%${strongest}%,cidade.ilike.%${strongest}%`);
        }
        loose = loose.order("valor_venda", { ascending: true });
        const { data: looseData } = await loose;
        imoveis = mapRows(looseData || []);
        aproximado = imoveis.length > 0;
      }

      if (imoveis.length === 0) {
        return {
          result: { tipo: "imoveis", imoveis: [] },
          modelResult: "Nenhum imóvel encontrado nem em busca ampla. Sugira ao corretor ampliar os critérios (valor, bairro ou dormitórios).",
        };
      }

      return {
        result: { tipo: "imoveis", imoveis, aproximado },
        modelResult: aproximado
          ? `Não achei correspondência exata, mas trouxe ${imoveis.length} opções próximas (já exibidas com botão de enviar por WhatsApp). Comente em 1 frase.`
          : `Encontrei ${imoveis.length} imóveis (já exibidos com botão de enviar por WhatsApp). Comente em 1 frase o destaque.`,
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

    return { modelResult: `Ferramenta desconhecida: ${name}` };
  } catch (e) {
    console.error("[executeHomiTool] error:", name, e);
    return { modelResult: "Ocorreu um erro ao executar a ação." };
  }
}
