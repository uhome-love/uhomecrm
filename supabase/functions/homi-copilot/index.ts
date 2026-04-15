import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireApiKey, callAI, withCorsAndErrorHandling } from "../_shared/ai-helpers.ts";

Deno.serve(withCorsAndErrorHandling("homi-copilot", async (req) => {
  // JWT validation
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Unauthorized", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return errorResponse("Unauthorized", 401);
  }

  const { lead_id, ultima_mensagem } = await req.json();
  if (!lead_id || !ultima_mensagem) {
    return errorResponse("lead_id e ultima_mensagem são obrigatórios", 400);
  }

  // Admin client for broader queries
  const sbAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Parallel queries for full CRM context
  const [mensagensRes, leadRes, stagesRes, tarefasRes, visitasRes, atividadesRes] = await Promise.all([
    supabase
      .from("whatsapp_mensagens")
      .select("body, direction, timestamp")
      .eq("lead_id", lead_id)
      .order("timestamp", { ascending: false })
      .limit(20),
    supabase
      .from("pipeline_leads")
      .select("nome, empreendimento, valor_estimado, stage_id, pipeline_stages(nome), origem, origem_detalhe, objetivo_cliente, bairro_regiao, forma_pagamento, imovel_troca, nivel_interesse, temperatura, observacoes, primeiro_contato_em, created_at, telefone, email, motivo_descarte, proxima_acao, data_proxima_acao, prioridade_lead, corretor_id, radar_quartos, radar_valor_max, radar_tipologia, modulo_atual, segmento_id")
      .eq("id", lead_id)
      .single(),
    sbAdmin
      .from("pipeline_stages")
      .select("nome, ordem")
      .eq("pipeline_tipo", "leads")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
    supabase
      .from("pipeline_tarefas")
      .select("titulo, tipo, status, vence_em, prioridade")
      .eq("pipeline_lead_id", lead_id)
      .in("status", ["pendente", "em_andamento"])
      .order("vence_em", { ascending: true })
      .limit(5),
    supabase
      .from("visitas")
      .select("data_visita, status, empreendimento")
      .eq("lead_id", lead_id)
      .order("data_visita", { ascending: false })
      .limit(5),
    supabase
      .from("pipeline_atividades")
      .select("tipo, titulo, data, created_at")
      .eq("pipeline_lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (leadRes.error) {
    console.error("Lead not found:", leadRes.error);
    return errorResponse("Lead não encontrado", 404);
  }

  const lead = leadRes.data;
  const mensagens = mensagensRes.data || [];
  const allStages = stagesRes.data || [];
  const tarefas = tarefasRes.data || [];
  const visitas = visitasRes.data || [];
  const atividades = atividadesRes.data || [];

  // Format history
  const historico = mensagens
    .reverse()
    .map((m: any) => {
      const d = new Date(m.timestamp);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const role = m.direction === "sent" ? "Corretor" : m.direction === "note" ? "Nota" : "Lead";
      return `[${hh}:${mm}] ${role}: ${m.body}`;
    })
    .join("\n");

  const nome = lead.nome || "Desconhecido";
  const etapa = (lead as any).pipeline_stages?.nome || "Não definida";
  const empreendimento = lead.empreendimento || "Não informado";
  const orcamento = lead.valor_estimado ? `R$ ${Number(lead.valor_estimado).toLocaleString("pt-BR")}` : "Não informado";

  // Build stages list
  const stagesList = allStages.map((s: any) => s.nome).join(" → ");

  // Build tasks context
  const tarefasCtx = tarefas.length > 0
    ? tarefas.map((t: any) => `- ${t.titulo} (${t.tipo}, ${t.status}, vence: ${t.vence_em ? new Date(t.vence_em).toLocaleDateString("pt-BR") : "s/d"}, prioridade: ${t.prioridade || "media"})`).join("\n")
    : "Nenhuma tarefa pendente";

  // Build visits context
  const visitasCtx = visitas.length > 0
    ? visitas.map((v: any) => `- ${new Date(v.data_visita).toLocaleDateString("pt-BR")} | ${v.status} | ${v.empreendimento || "local não definido"}`).join("\n")
    : "Nenhuma visita registrada";

  // Build activities context
  const atividadesCtx = atividades.length > 0
    ? atividades.slice(0, 5).map((a: any) => `- ${a.tipo}: ${a.titulo} (${a.data})`).join("\n")
    : "Sem atividades recentes";

  // Lead profile details
  const leadProfile = [
    lead.origem ? `Origem: ${lead.origem}${lead.origem_detalhe ? ` (${lead.origem_detalhe})` : ""}` : null,
    lead.objetivo_cliente ? `Objetivo: ${lead.objetivo_cliente}` : null,
    lead.bairro_regiao ? `Região: ${lead.bairro_regiao}` : null,
    lead.forma_pagamento ? `Pagamento: ${lead.forma_pagamento}` : null,
    lead.imovel_troca ? `Imóvel de troca: ${lead.imovel_troca}` : null,
    lead.nivel_interesse ? `Interesse: ${lead.nivel_interesse}` : null,
    lead.temperatura ? `Temperatura: ${lead.temperatura}` : null,
    lead.prioridade_lead ? `Prioridade: ${lead.prioridade_lead}` : null,
    lead.radar_quartos ? `Quartos desejados: ${lead.radar_quartos}` : null,
    lead.radar_valor_max ? `Valor máx: R$ ${Number(lead.radar_valor_max).toLocaleString("pt-BR")}` : null,
    lead.radar_tipologia ? `Tipologia: ${lead.radar_tipologia}` : null,
    lead.observacoes ? `Obs: ${lead.observacoes}` : null,
    lead.proxima_acao ? `Próxima ação agendada: ${lead.proxima_acao}${lead.data_proxima_acao ? ` em ${new Date(lead.data_proxima_acao).toLocaleDateString("pt-BR")}` : ""}` : null,
    lead.primeiro_contato_em ? `Primeiro contato: ${new Date(lead.primeiro_contato_em).toLocaleDateString("pt-BR")}` : null,
    lead.created_at ? `Lead criado: ${new Date(lead.created_at).toLocaleDateString("pt-BR")}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `Você é HOMI, assistente de IA especialista em vendas imobiliárias da Uhome Negócios Imobiliários em Porto Alegre/RS, Brasil.
Você ajuda corretores a converter leads em visitas presenciais e vendas, entendendo que cada conversa tem seu momento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMPRESA E EMPREENDIMENTOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A Uhome trabalha com os seguintes empreendimentos:
• Casa Tua — Alto padrão, Bela Vista, POA. 3 e 4 dorms, plantas amplas
• Open Bosque — Médio/alto padrão, próximo a áreas verdes
• Lake Eyre — Investimento/moradia, região em valorização
• Orygem — Compactos/studios para investidores
• Las Casas — Médio padrão, bairro nobre
• Casa Bastian — Alto padrão, exclusivo
• Alto Lindóia — MCMV/econômico, facilidade de financiamento
• Connect JW — Compactos/studios, público jovem
• Shift — Compactos modernos, localização privilegiada
• High Garden Iguatemi — Alto padrão, região do Iguatemi
• Outros empreendimentos podem existir no portfólio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPAS DO PIPELINE (ordem real)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${stagesList}

O lead está atualmente em: **${etapa}**

Regras de movimentação:
- "Sem Contato" → "Contato Iniciado": quando corretor faz primeiro contato efetivo
- "Contato Iniciado" → "Qualificação"/"Busca": quando lead responde e compartilha informações
- "Busca"/"Aquecimento" → "Visita Agendada": quando lead aceita agendar visita
- "Visita Agendada" → "Pós-Visita": após visita realizada
- "Pós-Visita" → "Proposta": quando lead demonstra intenção de compra
- Só sugerir "Descarte" se lead explicitamente disser que não tem interesse

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERFIL COMPLETO DO LEAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Nome: ${nome}
- Etapa atual: ${etapa}
- Empreendimento de interesse: ${empreendimento}
- Orçamento estimado: ${orcamento}
${leadProfile}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAREFAS PENDENTES DO LEAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${tarefasCtx}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISITAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${visitasCtx}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ATIVIDADES RECENTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${atividadesCtx}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HISTÓRICO DA CONVERSA (cronológico)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${historico || "(sem histórico)"}

ÚLTIMA MENSAGEM:
'${ultima_mensagem}'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE COMPORTAMENTO POR MOMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MOMENTO 1 — PRIMEIRO CONTATO
(histórico vazio ou 1-2 mensagens, etapa = 'Sem Contato' ou 'Novo Lead')
→ NÃO propor visita ainda
→ Objetivo: acolher, criar rapport, descobrir de onde veio e o que busca
→ Tom: amigável, curioso, humano
→ Fazer UMA pergunta de qualificação

MOMENTO 2 — QUALIFICAÇÃO
(2-5 mensagens, ainda não há dados claros de perfil, budget ou urgência)
→ NÃO propor visita ainda
→ Objetivo: entender perfil completo (composição familiar, região, budget, urgência)
→ Conectar respostas ao empreendimento

MOMENTO 3 — APRESENTAÇÃO E GERAÇÃO DE DESEJO
(perfil entendido, lead demonstra interesse, faz perguntas sobre o imóvel)
→ Apresentar diferenciais conectados com o que o lead disse querer
→ Criar antecipação (decorado, experiência presencial)
→ Ainda não propor visita diretamente

MOMENTO 4 — CONVITE PARA VISITA
(lead demonstrou interesse claro, fez perguntas sobre valores/condições)
→ Agora propor a visita naturalmente como experiência
→ Dar opções de horário
→ Reforçar o que ele vai ver/sentir

MOMENTO 5 — FOLLOW-UP / REATIVAÇÃO
(lead sumiu, não respondeu há dias)
→ Mensagem leve, sem pressão
→ Trazer algo novo: novidade, condição especial
→ NÃO perguntar 'você ainda tem interesse?'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBJEÇÕES COMUNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
'Está caro' → Explorar condições, financiamento, outro produto
'Preciso pensar' → Incluir decisor, visita em conjunto
'Não tenho urgência' → Manter contato leve, valorização
'Já vi outros' → Diferenciar, propor comparar pessoalmente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AÇÕES DISPONÍVEIS NO SISTEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você pode sugerir ao corretor:
1. **Mover etapa** — quando a conversa indica progressão (usar nomes reais das etapas acima)
2. **Criar follow-up** — quando precisa lembrar de retomar contato (ex: "Ligar em 2 dias", "Enviar material amanhã")
3. **Agendar visita** — quando lead está pronto (sugerir via botão de visita na interface)
4. **Criar tarefa** — para ações específicas (enviar material, ligar, reunião)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPOSTA OBRIGATÓRIA EM JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Responda APENAS com JSON válido, sem markdown, sem explicação:
{
  "momento_detectado": "primeiro_contato" | "qualificacao" | "apresentacao" | "convite_visita" | "followup" | "objecao",
  "sugestao_resposta": string (resposta natural, consultiva, máx 3 frases, adequada ao momento, SEM forçar visita se momento não for convite_visita),
  "briefing": string (resumo do momento do lead em máx 20 palavras, incluir dados relevantes do perfil),
  "tom_detectado": "interessado" | "hesitante" | "frio" | "pronto" | "curioso" | "com_objecao",
  "proxima_acao": string (o que o corretor deve buscar, ex: 'Descobrir budget', 'Propor visita', 'Enviar material do ${empreendimento}'),
  "sugestao_followup": string | null (ex: "Ligar em 2 dias para retomar", "Enviar condições amanhã"),
  "sugestao_etapa": string | null (DEVE ser um nome exato da lista de etapas: ${stagesList}. Só sugerir se momento indica progressão clara)
}`;

  const apiKey = requireApiKey();
  const raw = await callAI(apiKey, [
    { role: "user", content: prompt },
  ], {
    model: "google/gemini-2.5-flash",
    fnName: "homi-copilot",
    temperature: 0.4,
  });

  // Parse JSON from response (strip markdown fences if present)
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return jsonResponse(parsed);
  } catch {
    console.error("homi-copilot: failed to parse AI response:", cleaned);
    return jsonResponse({
      sugestao_resposta: raw.trim(),
      briefing: "Resposta gerada sem estrutura",
      tom_detectado: "hesitante",
      momento_detectado: "qualificacao",
      proxima_acao: "Analisar contexto manualmente",
      sugestao_followup: null,
      sugestao_etapa: null,
    });
  }
}));
