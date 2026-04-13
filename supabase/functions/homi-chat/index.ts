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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const { messages, empreendimento, stream: wantStream = true, system: customSystem } = await req.json();
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
