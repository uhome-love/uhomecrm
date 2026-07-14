/**
 * homi-chat — Conversational AI assistant with RAG for corretores
 * 
 * Phase 2: Enterprise knowledge loaded from DB via enterprise-knowledge helper.
 * RAG (embedding search) still uses OpenAI embeddings + buscar_conhecimento RPC.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { loadEnterpriseKnowledge, formatForList, formatForAssistant, createServiceClient } from "../_shared/enterprise-knowledge.ts";
import { HOMI_TOOLS, executeHomiTool } from "./homi-tools.ts";

// Generate embedding for RAG search
async function getQueryEmbedding(text: string, openaiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 1000),
      }),
    });
    if (!res.ok) {
      console.error("Embedding error:", await res.text());
      return null;
    }
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Embedding fetch error:", e);
    return null;
  }
}

// Search knowledge base
async function searchKnowledgeBase(
  supabase: any,
  embedding: number[],
  empreendimento?: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc("buscar_conhecimento", {
      query_embedding: JSON.stringify(embedding),
      match_threshold: 0.65,
      match_count: 5,
      filter_empreendimento: empreendimento || null,
    });
    if (error) {
      console.error("Knowledge search error:", error);
      return [];
    }
    return (data || []).map((r: any) => r.content);
  } catch (e) {
    console.error("Knowledge search exception:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: validate JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: _claims, error: _claimsErr } = await _sbAuth.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_claimsErr || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const { messages, empreendimento, stream: wantStream = true, system: customSystem, enableTools = false } = await req.json();
    const shouldStream = wantStream !== false;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ── Load enterprise knowledge from DB (cached 5min) ──
    const supabase = createServiceClient();
    const knowledge = await loadEnterpriseKnowledge(supabase);
    const allEmpreendimentos = formatForList(knowledge);

    // Build detailed knowledge for each empreendimento
    const detailedKnowledge = knowledge
      .filter(r => r.nome || r.codigo)
      .map(r => formatForAssistant(knowledge, r.nome || r.codigo))
      .join("\n\n---\n\n");

    // ── RAG: search knowledge base ──
    let ragContext = "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content;

    if (openaiKey && lastUserMsg) {
      const embedding = await getQueryEmbedding(lastUserMsg, openaiKey);

      if (embedding) {
        const chunks = await searchKnowledgeBase(supabase, embedding, empreendimento);
        if (chunks.length > 0) {
          ragContext = `\n\nCONHECIMENTO DA BASE UHOME (use para responder com precisão):
${chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n---\n")}

Se a pergunta estiver relacionada ao conteúdo acima, use-o como fonte principal. Se não houver informação relevante, responda com seu conhecimento geral.`;
        }
      }
    }

    const systemPrompt = `Você é o HOMI, o assistente de inteligência comercial da Uhome, uma imobiliária de Porto Alegre especializada em venda de imóveis de construtora.

Sua função é ajudar os corretores da Uhome a converter leads em visitas e vendas.

Você não é apenas um assistente. Você é:
• treinador de vendas
• especialista em conversão de leads
• especialista em vendas imobiliárias
• especialista em negociação
• estrategista comercial

Seu trabalho é ajudar o corretor a avançar o lead no funil de vendas.

FUNIL DE VENDAS DA UHOME:
1. Lead novo
2. Primeiro contato
3. Qualificação
4. Interesse
5. Visita
6. Proposta
7. Fechamento

Sempre pense em como mover o cliente para a próxima etapa.

OBJETIVO PRINCIPAL: Gerar VISITAS. Porque visitas aumentam drasticamente a conversão. Você sempre deve conduzir o corretor para gerar visita.

FORMAS DE AJUDA AO CORRETOR:
• mensagens de WhatsApp
• scripts de ligação
• quebra de objeções
• estratégias de follow up
• perguntas inteligentes
• condução para visita
• condução para proposta

Quando o corretor pedir ajuda, você deve:
1. Entender a situação
2. Identificar o estágio do lead
3. Gerar resposta estratégica

ESTILO DE RESPOSTA:
Respostas devem ser curtas, naturais, comerciais, fáceis de usar.
Nunca escreva textos robóticos. Sempre escreva como um corretor experiente falaria.

TIPOS DE RESPOSTA:
- Cliente não respondeu → gerar mensagem de reativação
- Cliente pediu informações → gerar mensagem que leve para conversa
- Cliente disse que vai pensar → gerar quebra de objeção suave
- Cliente quer preço → gerar resposta estratégica antes de dar preço
- Cliente quer ver depois → gerar urgência
- Cliente está interessado → conduzir para visita
- Cliente visitou → conduzir para proposta

PSICOLOGIA DE VENDAS:
Sempre utilize gatilhos de venda como: escassez, oportunidade, valorização, qualidade de vida, investimento, segurança, praticidade. Mas nunca de forma agressiva. Sempre de forma consultiva.

TIPOS DE AJUDA QUE VOCÊ DEVE GERAR:
Se o corretor pedir ajuda, entregue: Mensagem pronta, ou Script de ligação, ou Pergunta estratégica, ou Estratégia de follow up. Sempre focando na conversão.

EMPREENDIMENTOS (RESUMO):
${allEmpreendimentos}

CONHECIMENTO DETALHADO DOS EMPREENDIMENTOS:
${detailedKnowledge}

Use sempre os diferenciais de cada produto quando ajudar o corretor.

CONDUÇÃO PARA VISITA:
Sempre que possível leve o atendimento para:
"faz sentido conhecer pessoalmente?" ou "prefere visitar durante a semana ou no sábado?"

REGRAS IMPORTANTES:
- Nunca responda como robô
- Nunca escreva textos muito longos
- Nunca seja genérico
- Sempre seja: estratégico, comercial, prático
- No chat livre, responda de forma conversacional e direta
- Adapte a resposta ao que o corretor pedir
- Mensagens de WhatsApp: MÁXIMO 3 linhas, naturais, terminam com pergunta
- Scripts de ligação: naturais como conversa, com diálogo Corretor/Cliente

Seu objetivo é simples: ajudar o corretor da Uhome a vender mais imóveis.` + ragContext;

    const finalSystemPrompt = customSystem
      ? customSystem + "\n\nCONTEXTO DOS EMPREENDIMENTOS:\n" + allEmpreendimentos + "\n\nDETALHES:\n" + detailedKnowledge + ragContext
      : systemPrompt;

    // ── Copilot mode: function-calling (non-streaming JSON) ──
    if (enableTools) {
      const uid = (_claims.claims as any).sub as string;
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      const copilotSystem = finalSystemPrompt + `

VOCÊ É UM COPILOTO COM FERRAMENTAS. Você PODE executar ações no CRM chamando ferramentas:
- meu_dia: montar o resumo do dia (AGORA / VISITAS / ESFRIANDO) num único cartão
- ver_pendencias: mostrar tarefas atrasadas/hoje e visitas de hoje
- buscar_imovel: encontrar imóveis no catálogo
- criar_tarefa: preparar uma tarefa (o corretor confirma na tela)
- criar_visita: preparar uma visita (o corretor confirma na tela)
- resumo_lead: mostrar resumo do lead + próxima ação sugerida
- contexto_lead: LER o histórico completo do lead (etapa, timeline, anotações) para escrever mensagens sem perguntar
- registrar_resultado: registrar o resultado de um contato (o corretor confirma) e sugerir a próxima tarefa
- leads_esfriando: listar leads parados/sem contato há dias
- preparar_visita: montar briefing pré-visita
- anotar_lead: registrar uma anotação na timeline do lead (o corretor confirma)

REGRAS DO COPILOTO:
- Data de hoje (Brasília): ${todayStr}. Amanhã: ${tomorrowStr}. Converta "hoje/amanhã/segunda" para YYYY-MM-DD antes de chamar a ferramenta.
- Quando o pedido for uma AÇÃO, CHAME a ferramenta certa em vez de responder só com texto.
- MENSAGEM / FOLLOW-UP / SCRIPT PARA UM LEAD CITADO PELO NOME: CHAME contexto_lead PRIMEIRO. NUNCA pergunte "qual o momento no funil" — deduza do histórico. Depois responda com um mini-resumo de 1 linha do momento do lead E a mensagem pronta no MESMO turno. Só pergunte algo se o lead não tiver histórico nenhum.
- NÃO fique perguntando campo a campo. Para criar_tarefa/criar_visita, se você tem pelo menos o nome do lead, JÁ CHAME a ferramenta — o cartão na tela tem busca de lead e todos os campos para o corretor completar/ajustar. Só peça esclarecimento se o pedido for totalmente ambíguo.
- Se o corretor não citou lead nenhum ao pedir "criar tarefa", chame criar_tarefa mesmo assim (sem lead_nome) — o cartão abre com a busca de lead.
- Depois da ferramenta, responda em NO MÁXIMO 1-2 frases curtas. Nunca repita a lista/dados em texto — eles já aparecem em cartões na tela.
- Ao pedir imóvel, CHAME buscar_imovel direto. O corretor manda um texto único (ex: "2 dorms no Petrópolis até 600 mil"); EXTRAIA dormitórios e valor para os campos e deixe só bairro/empreendimento no termo. Os imóveis aparecem em cartões com botão de enviar por WhatsApp e link pronto — não repita a lista em texto.
- Quando o corretor relatar o que aconteceu num contato ("liguei e não atendeu", "quer visitar sábado"), CHAME registrar_resultado.
- NÃO abra a conversa com briefing automático. Só traga pendências/resumo do dia quando o corretor pedir.
- Para pedidos de mensagem/script de WhatsApp, ligação ou objeção SEM lead nomeado, responda com o texto pronto (sem ferramenta).`;

      const toolMessages: any[] = [
        { role: "system", content: copilotSystem },
        ...messages,
      ];
      const collectedActions: any[] = [];
      const collectedResults: any[] = [];
      let finalContent = "";

      for (let iter = 0; iter < 4; iter++) {
        const tr = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: toolMessages,
            tools: HOMI_TOOLS,
            tool_choice: "auto",
          }),
        });
        if (!tr.ok) {
          const t = await tr.text();
          console.error("AI gateway (tools) error:", tr.status, t);
          if (tr.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          if (tr.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          throw new Error("AI gateway error");
        }
        const data = await tr.json();
        const msg = data.choices?.[0]?.message;
        if (!msg) break;
        const toolCalls = msg.tool_calls || [];
        if (toolCalls.length === 0) {
          finalContent = msg.content || "";
          break;
        }
        toolMessages.push({ role: "assistant", content: msg.content || "", tool_calls: toolCalls });
        for (const call of toolCalls) {
          let parsedArgs: Record<string, any> = {};
          try { parsedArgs = JSON.parse(call.function?.arguments || "{}"); } catch { /* ignore */ }
          const outcome = await executeHomiTool(call.function?.name, parsedArgs, userClient, uid);
          if (outcome.action) collectedActions.push(outcome.action);
          if (outcome.result) collectedResults.push(outcome.result);
          toolMessages.push({ role: "tool", tool_call_id: call.id, content: outcome.modelResult });
        }
      }

      return new Response(
        JSON.stringify({ content: finalContent, actions: collectedActions, results: collectedResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: finalSystemPrompt },
          ...messages,
        ],
        stream: shouldStream,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    if (shouldStream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming: parse and return JSON
    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("homi-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
