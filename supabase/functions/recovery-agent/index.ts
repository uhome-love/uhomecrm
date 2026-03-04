import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { leads_summary } = await req.json();

    if (!leads_summary) {
      return new Response(JSON.stringify({ error: "leads_summary is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é o Recovery AI Agent — um agente de inteligência especializado em recuperação de leads imobiliários.

Analise os dados consolidados abaixo e gere:

1. **INSIGHTS** (5-8 insights estratégicos)
   - Cada insight deve ser uma frase curta e direta com dados concretos
   - Foque em oportunidades de recuperação
   - Use números reais dos dados

2. **CAMPANHAS SUGERIDAS** (3-5 campanhas)
   - Nome da campanha
   - Descrição curta (1 frase)
   - Público-alvo (quantidade estimada de leads)
   - Prioridade (alta/média/baixa)
   - Canal recomendado (whatsapp/email/sms)

3. **AÇÕES PRIORITÁRIAS** (3-5 ações imediatas)
   - O que fazer agora para maximizar conversão
   - Ordenadas por impacto

DADOS CONSOLIDADOS:
${leads_summary}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você é o Recovery AI Agent, um agente de inteligência para recuperação de leads imobiliários. Responda sempre em português brasileiro. Seja direto e use dados concretos.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recovery_analysis",
              description: "Return the complete recovery analysis with insights, campaigns and actions",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        emoji: { type: "string", description: "Emoji representing the insight type" },
                        text: { type: "string", description: "The insight text with concrete data" },
                        type: { type: "string", enum: ["opportunity", "warning", "info"], description: "Type of insight" },
                      },
                      required: ["emoji", "text", "type"],
                      additionalProperties: false,
                    },
                  },
                  campaigns: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        target_count: { type: "number", description: "Estimated number of leads to target" },
                        priority: { type: "string", enum: ["alta", "media", "baixa"] },
                        channel: { type: "string", enum: ["whatsapp", "email", "sms"] },
                      },
                      required: ["name", "description", "target_count", "priority", "channel"],
                      additionalProperties: false,
                    },
                  },
                  actions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string", description: "What to do" },
                        impact: { type: "string", enum: ["alto", "medio", "baixo"] },
                        reason: { type: "string", description: "Why this action matters" },
                      },
                      required: ["action", "impact", "reason"],
                      additionalProperties: false,
                    },
                  },
                  summary: {
                    type: "string",
                    description: "A 1-2 sentence executive summary of the analysis",
                  },
                },
                required: ["insights", "campaigns", "actions", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "recovery_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
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
      result = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { insights: [], campaigns: [], actions: [], summary: content };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recovery-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
