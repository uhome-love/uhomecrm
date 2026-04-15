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

  // Parallel queries
  const [mensagensRes, leadRes] = await Promise.all([
    supabase
      .from("whatsapp_mensagens")
      .select("body, direction, timestamp")
      .eq("lead_id", lead_id)
      .order("timestamp", { ascending: false })
      .limit(15),
    supabase
      .from("pipeline_leads")
      .select("nome, empreendimento, valor_estimado, stage_id, pipeline_stages(nome)")
      .eq("id", lead_id)
      .single(),
  ]);

  if (leadRes.error) {
    console.error("Lead not found:", leadRes.error);
    return errorResponse("Lead não encontrado", 404);
  }

  const lead = leadRes.data;
  const mensagens = mensagensRes.data || [];

  // Format history
  const historico = mensagens
    .reverse()
    .map((m: any) => {
      const d = new Date(m.timestamp);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const role = m.direction === "sent" ? "Corretor" : "Lead";
      return `[${hh}:${mm}] ${role}: ${m.body}`;
    })
    .join("\n");

  const nome = lead.nome || "Desconhecido";
  const etapa = (lead as any).pipeline_stages?.nome || "Não definida";
  const empreendimento = lead.empreendimento || "Não informado";
  const orcamento = lead.valor_estimado ? `R$ ${Number(lead.valor_estimado).toLocaleString("pt-BR")}` : "Não informado";

  const prompt = `Você é HOMI, assistente especialista em vendas imobiliárias da Uhome Negócios Imobiliários em Porto Alegre, Brasil.
Você ajuda corretores a converter leads em visitas presenciais, mas entende que cada conversa tem um momento diferente e que forçar a visita cedo espanta o lead.

PERFIL DO LEAD:
- Nome: ${nome}
- Etapa no pipeline: ${etapa}
- Empreendimento de interesse: ${empreendimento}
- Budget estimado: ${orcamento}

HISTÓRICO DA CONVERSA (cronológico):
${historico || "(sem histórico)"}

ÚLTIMA MENSAGEM RECEBIDA:
'${ultima_mensagem}'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE COMPORTAMENTO POR MOMENTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MOMENTO 1 — PRIMEIRO CONTATO
(histórico vazio ou 1-2 mensagens, etapa = 'Sem Contato' ou 'Novo Lead')
→ NÃO propor visita ainda
→ Objetivo: acolher, criar rapport, descobrir de onde veio e o que busca
→ Tom: amigável, curioso, humano
→ Fazer UMA pergunta de qualificação:
  Ex: 'Para quem você está buscando?'
  Ex: 'O que te chamou atenção no ${empreendimento}?'
  Ex: 'Você está buscando para morar ou investir?'

MOMENTO 2 — QUALIFICAÇÃO
(2-5 mensagens, ainda não há dados claros de perfil, budget ou urgência)
→ NÃO propor visita ainda
→ Objetivo: entender perfil completo
→ Perguntas estratégicas:
  - Composição familiar / para quem é
  - Região de preferência / mobilidade
  - Budget / financiamento aprovado
  - Urgência / quando pretende decidir
→ Conectar respostas ao empreendimento:
  Ex: 'Que ótimo! O ${empreendimento} tem exatamente o que você descreveu...'

MOMENTO 3 — APRESENTAÇÃO E GERAÇÃO DE DESEJO
(perfil entendido, lead demonstra interesse, faz perguntas sobre o imóvel)
→ Apresentar diferenciais do empreendimento conectados com o que o lead disse querer
→ Enviar informações que geram curiosidade
→ Fazer o lead PEDIR para ver, não OFERECER
→ Ainda não propor visita diretamente
→ Criar antecipação:
  Ex: 'Temos um decorado incrível que quando as pessoas veem pessoalmente entendem exatamente o que é especial...'

MOMENTO 4 — CONVITE PARA VISITA
(lead demonstrou interesse claro, fez perguntas sobre valores/condições, ou disse que quer conhecer melhor)
→ Agora propor a visita naturalmente
→ Tom: como experiência, não como venda
→ Dar opções de horário
→ Reforçar o que ele vai ver/sentir
  Ex: 'Que tal você e sua família conhecerem pessoalmente? Tenho horários disponíveis sábado...'

MOMENTO 5 — FOLLOW-UP / REATIVAÇÃO
(lead sumiu, não respondeu há dias, etapa parada)
→ Mensagem leve, sem pressão
→ Trazer algo novo: novidade do empreendimento, condição especial, informação útil
→ NÃO perguntar 'você ainda tem interesse?'
→ Ex: 'Oi ${nome}! Surgiu uma novidade no ${empreendimento} que lembrei de você...'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETECÇÃO DE MOMENTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analisar o histórico e classificar:
- Quantas mensagens trocadas
- Lead compartilhou informações de perfil?
- Lead fez perguntas sobre o imóvel?
- Lead demonstrou objeção ou hesitação?
- Lead demonstrou interesse claro?
- Há quanto tempo sem resposta?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBJEÇÕES COMUNS E COMO TRATAR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'Está caro / não tenho dinheiro'
→ Explorar condições: entrada, financiamento, consórcio
→ Perguntar o budget real
→ Ver se há outro produto mais adequado

'Preciso pensar / consultar minha esposa'
→ Incluir o outro decisor
→ Propor visita em conjunto
→ Oferecer material para apresentar

'Não tenho urgência'
→ Não pressionar
→ Manter contato leve
→ Trazer informações de valorização ou escassez de unidades

'Já vi outros imóveis'
→ Descobrir o que viu
→ Diferenciar o ${empreendimento}
→ Propor comparar pessoalmente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPOSTA OBRIGATÓRIA EM JSON:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Responda APENAS com JSON válido, sem markdown, sem explicação:
{
  "momento_detectado": "primeiro_contato" | "qualificacao" | "apresentacao" | "convite_visita" | "followup" | "objecao",
  "sugestao_resposta": string (resposta natural, consultiva, máx 3 frases, adequada ao momento detectado, SEM forçar visita se momento não for convite_visita),
  "briefing": string (resumo do momento do lead em máx 15 palavras),
  "tom_detectado": "interessado" | "hesitante" | "frio" | "pronto" | "curioso" | "com_objecao",
  "proxima_acao": string (o que o corretor deve buscar nesta conversa, ex: 'Descobrir budget e composição familiar', 'Enviar material do empreendimento', 'Propor visita com data específica'),
  "sugestao_followup": string | null,
  "sugestao_etapa": string | null (só sugerir mudança de etapa se momento = convite_visita ou pronto)
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
