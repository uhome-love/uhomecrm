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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { leads_summary, mode } = await req.json();

    if (!leads_summary) {
      return new Response(JSON.stringify({ error: "leads_summary is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é o Recovery Manager AI — um agente de inteligência especializado em recuperação de leads imobiliários que foram perdidos, não aproveitados ou esquecidos.

Regras importantes:
- NUNCA trate leads como novos. Eles JÁ existiam e pararam de responder.
- Foque em RETOMAR o interesse, trazer novidades, oferecer ajuda, gerar resposta e marcar visita.
- Seja direto, use dados concretos e priorize ações de alto impacto.
- Responda sempre em português brasileiro.
- Classifique o tipo de situação de cada grupo: lead sem contato, lead que parou de responder, lead que pediu info e sumiu, lead antigo, lead pós-visita sem retorno.`;

    const prompt = `Analise os dados consolidados da base de leads não aproveitados abaixo e gere:

1. **INSIGHTS** (5-8 insights estratégicos)
   - Cada insight deve ser uma frase curta e direta com dados concretos
   - Foque em oportunidades de recuperação
   - Identifique padrões: quais empreendimentos têm mais potencial, quais origens geram leads mais qualificados
   - Use números reais dos dados

2. **CAMPANHAS SUGERIDAS** (3-5 campanhas de recuperação)
   - Nome da campanha
   - Descrição curta com abordagem de REATIVAÇÃO (retomar interesse, trazer novidade, oferecer ajuda)
   - Público-alvo (quantidade estimada de leads)
   - Prioridade (alta/média/baixa)
   - Canal recomendado (whatsapp/email/sms/ligacao)
   - Tipo de mensagem sugerida (retomar_interesse/novidade/ajuda/marcar_visita)

3. **AÇÕES PRIORITÁRIAS** (3-5 ações imediatas)
   - O que fazer agora para maximizar recuperação
   - Ordenadas por impacto
   - Cada ação deve ser específica e mensurável

4. **ESTRATÉGIA DE RECUPERAÇÃO**
   - Quais leads atacar primeiro e por quê
   - Quais empreendimentos têm maior potencial de recuperação
   - Sugestão de sequência de contato (1º WhatsApp, 2º ligação, etc.)

DADOS CONSOLIDADOS:
${leads_summary}`;

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
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recovery_analysis",
              description: "Return the complete recovery analysis with insights, campaigns, actions and strategy",
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
                        channel: { type: "string", enum: ["whatsapp", "email", "sms", "ligacao"] },
                        approach_type: { type: "string", enum: ["retomar_interesse", "novidade", "ajuda", "marcar_visita"], description: "Type of recovery approach" },
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
                        action: { type: "string", description: "What to do - specific and measurable" },
                        impact: { type: "string", enum: ["alto", "medio", "baixo"] },
                        reason: { type: "string", description: "Why this action matters for recovery" },
                      },
                      required: ["action", "impact", "reason"],
                      additionalProperties: false,
                    },
                  },
                  strategy: {
                    type: "object",
                    properties: {
                      attack_first: { type: "string", description: "Which leads to attack first and why" },
                      top_empreendimentos: { type: "string", description: "Which empreendimentos have most recovery potential" },
                      contact_sequence: { type: "string", description: "Suggested contact sequence (1st WhatsApp, 2nd call, etc.)" },
                    },
                    required: ["attack_first", "top_empreendimentos", "contact_sequence"],
                    additionalProperties: false,
                  },
                  summary: {
                    type: "string",
                    description: "A 2-3 sentence executive summary of the recovery analysis",
                  },
                },
                required: ["insights", "campaigns", "actions", "strategy", "summary"],
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
        : { insights: [], campaigns: [], actions: [], strategy: {}, summary: content };
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
