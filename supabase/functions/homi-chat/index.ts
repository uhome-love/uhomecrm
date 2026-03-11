import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREENDIMENTOS_INFO: Record<string, string> = {
  "Casa Tua": "Condomínio fechado de casas, Encorp, Alto Petrópolis/Morro Santana. Casas 2-3 dorms (99-176m²). Pátio privativo, lazer completo. Para famílias que querem sair de apto.",
  "Open Bosque": "Open Construtora (Melnick), Passo d'Areia. Condomínio-parque com 7.500m² de lazer. Aptos 2-3 dorms (47-80m²). Conceito de parque dentro do condomínio.",
  "Shift": "Vanguard (Plaenge), Auxiliadora. Studios e 1 dorm (24-108m²). Conceito Life on Demand. Localização premium esquina Silva Jardim com 24 de Outubro.",
  "Casa Bastian": "ABF Developments, Menino Deus. Lofts e studios (14-36m²). Arquitetura moderna + preservação histórica. Alta liquidez para locação.",
  "Melnick Day": "EVENTO DE VENDAS anual da Melnick. 21/março/2026. Descontos até ~30%. Condições exclusivas que não se repetem. Urgência real.",
  "Alto Lindóia": "Florença Incorporadora, Sarandi. Resort urbano com +25 espaços de lazer (~7.298m²). Aptos 1-3 dorms (36-78m²). Melhor custo-benefício.",
  "Lake Eyre": "Construtora referência. Conceito de alto padrão com localização premium.",
  "Orygem": "Empreendimento moderno com conceito inovador.",
  "Las Casas": "Bairro planejado, lotes em condomínio fechado em POA. Para famílias que querem casa com segurança, espaço e natureza.",
};

const ALL_EMPREENDIMENTOS = Object.entries(EMPREENDIMENTOS_INFO)
  .map(([name, info]) => `• ${name}: ${info}`)
  .join("\n");

const BASE_SYSTEM_PROMPT = `Você é o HOMI, o assistente de inteligência comercial da Uhome, uma imobiliária de Porto Alegre especializada em venda de imóveis de construtora.

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

EMPREENDIMENTOS QUE VOCÊ CONHECE:
${ALL_EMPREENDIMENTOS}

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

Seu objetivo é simples: ajudar o corretor da Uhome a vender mais imóveis.`;

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
        input: text.slice(0, 1000), // limit input size
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
    const { messages, empreendimento } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    // ── RAG: search knowledge base ──
    let ragContext = "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content;

    if (openaiKey && lastUserMsg) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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

    const systemPrompt = BASE_SYSTEM_PROMPT + ragContext;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("homi-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
