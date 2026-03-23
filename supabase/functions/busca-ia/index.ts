import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um assistente de busca de imóveis. O usuário vai descrever em linguagem natural o que procura.
Extraia filtros estruturados a partir da descrição.

REGRAS:
- tipo: "apartamento" | "casa" | "cobertura" | "terreno" | "comercial" | "loft" | "kitnet" | null
- quartos_min: número inteiro ou null
- banheiros_min: número inteiro ou null  
- vagas_min: número inteiro ou null
- preco_min: número ou null (valor em reais)
- preco_max: número ou null (valor em reais)
- area_min: número ou null (m²)
- area_max: número ou null (m²)
- bairros: array de strings com bairros de Porto Alegre ou null
- cidade: string ou null (default "Porto Alegre")
- palavras_chave: array de strings extras para busca textual ou null
- ordem: "preco_asc" | "preco_desc" | "area_desc" | "recentes" | null

Quando o usuário mencionar valores como "até 800k", converta para 800000.
Quando mencionar "perto do Iguatemi", infira bairros próximos como "Três Figueiras", "Chácara das Pedras", "Boa Vista".
Quando mencionar "perto do Barra", infira "Petrópolis", "Bela Vista", "Jardim Botânico".
Quando mencionar "zona sul", infira "Tristeza", "Ipanema", "Cavalhada", "Cristal", "Camaquã".
Quando mencionar "centro", infira "Centro Histórico", "Cidade Baixa", "Bom Fim".
Se não conseguir determinar um campo, use null.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Query muito curta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "aplicar_filtros",
              description: "Aplica filtros estruturados de busca de imóveis",
              parameters: {
                type: "object",
                properties: {
                  tipo: { type: "string", enum: ["apartamento", "casa", "cobertura", "terreno", "comercial", "loft", "kitnet"], nullable: true },
                  quartos_min: { type: "integer", nullable: true },
                  banheiros_min: { type: "integer", nullable: true },
                  vagas_min: { type: "integer", nullable: true },
                  preco_min: { type: "number", nullable: true },
                  preco_max: { type: "number", nullable: true },
                  area_min: { type: "number", nullable: true },
                  area_max: { type: "number", nullable: true },
                  bairros: { type: "array", items: { type: "string" }, nullable: true },
                  cidade: { type: "string", nullable: true },
                  palavras_chave: { type: "array", items: { type: "string" }, nullable: true },
                  ordem: { type: "string", enum: ["preco_asc", "preco_desc", "area_desc", "recentes"], nullable: true },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "aplicar_filtros" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas buscas. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na busca IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Não foi possível interpretar a busca" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let filters: Record<string, unknown>;
    try {
      filters = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ filters, query }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("busca-ia error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
