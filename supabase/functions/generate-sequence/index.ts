import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { produto, etapa, objetivo } = await req.json();

    const systemPrompt = `Você é um especialista em vendas imobiliárias e automação de CRM. 
Gere uma sequência de nutrição de leads para um corretor de imóveis.

REGRAS:
- Crie entre 3 e 6 passos
- Cada passo deve ter: dias_apos_inicio (começando de 0), tipo (mensagem|material|lembrete), titulo, conteudo, canal (whatsapp|email|ligacao)
- As mensagens devem ser naturais, personalizadas e usar variáveis {{nome}} e {{empreendimento}}
- Adapte o tom e frequência conforme a etapa do funil
- Foque no objetivo informado
- Mensagens curtas (máx 2-3 frases)
- Sempre termine mensagens com uma pergunta ou call-to-action`;

    const userPrompt = `Gere uma sequência de nutrição para:
- Produto/Empreendimento: ${produto}
- Etapa do funil: ${etapa}
- Objetivo: ${objetivo}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_sequence",
            description: "Create a lead nurturing sequence with steps",
            parameters: {
              type: "object",
              properties: {
                nome: { type: "string", description: "Nome da sequência" },
                descricao: { type: "string", description: "Breve descrição do objetivo" },
                passos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      dias_apos_inicio: { type: "number" },
                      tipo: { type: "string", enum: ["mensagem", "material", "lembrete"] },
                      titulo: { type: "string" },
                      conteudo: { type: "string" },
                      canal: { type: "string", enum: ["whatsapp", "email", "ligacao"] },
                    },
                    required: ["dias_apos_inicio", "tipo", "titulo", "conteudo", "canal"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["nome", "descricao", "passos"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_sequence" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result;
    if (toolCall) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { nome: `Sequência ${produto}`, descricao: objetivo, passos: [] };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-sequence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
