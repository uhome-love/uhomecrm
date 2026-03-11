import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIORITY_LEVELS = ["muito_quente", "quente", "morno", "frio", "perdido"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { type, lead, leads } = await req.json();

    if (type === "message") {
      const prompt = `Você é um corretor de imóveis especialista em recuperação de leads.
Gere uma mensagem de follow-up para reativar este lead.

REGRAS DA MENSAGEM:
- Máximo 2 frases
- Tom humano e natural
- Não parecer spam
- Finalizar com uma pergunta
- Ser personalizada com os dados do lead

Dados do lead:
- Nome: ${lead.nome}
- Interesse: ${lead.interesse}
- Origem: ${lead.origem}
- Último contato: ${lead.ultimoContato}
- Status: ${lead.status}

Classifique a prioridade em 5 níveis:
- "muito_quente": lead recente (<7 dias), interesse claro, dados completos
- "quente": lead moderado (7-15 dias), interesse demonstrado
- "morno": lead (15-30 dias), algum interesse
- "frio": lead antigo (30-90 dias), sem interação recente
- "perdido": lead >90 dias sem contato ou sem dados suficientes`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um assistente de vendas imobiliárias brasileiro." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "followup_result",
              description: "Return the follow-up message and priority classification",
              parameters: {
                type: "object",
                properties: {
                  message: { type: "string", description: "The personalized follow-up message (max 2 sentences, ending with a question)" },
                  priority: { type: "string", enum: [...PRIORITY_LEVELS] },
                },
                required: ["message", "priority"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "followup_result" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: content, priority: "morno" };
      }

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "classify") {
      const leadsInfo = leads.map((l: any) =>
        `ID: ${l.id} | Nome: ${l.nome} | Interesse: ${l.interesse} | Origem: ${l.origem} | Último contato: ${l.ultimoContato} | Status: ${l.status} | Tem telefone: ${l.temTelefone ? "sim" : "não"} | Tem email: ${l.temEmail ? "sim" : "não"}`
      ).join("\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um assistente de vendas imobiliárias brasileiro especialista em classificação de leads." },
            { role: "user", content: `Classifique cada lead em 5 níveis de prioridade.

CRITÉRIOS:
- "muito_quente" 🔥: lead recente (<7 dias), interesse claro em imóvel específico, dados completos
- "quente" 🟠: lead moderado (7-15 dias), interesse demonstrado, bons dados de contato
- "morno" 🟡: lead (15-30 dias), algum interesse, dados parciais
- "frio" 🔵: lead antigo (30-90 dias), sem interação recente
- "perdido" ⚫: lead >90 dias sem contato, sem dados suficientes

CONSIDERE:
- Data do último contato
- Especificidade do interesse
- Origem do lead
- Presença de telefone e email

Leads:\n${leadsInfo}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "classify_leads",
              description: "Classify all leads by recovery priority",
              parameters: {
                type: "object",
                properties: {
                  classifications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        priority: { type: "string", enum: [...PRIORITY_LEVELS] },
                      },
                      required: ["id", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["classifications"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "classify_leads" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { classifications: [] };
      }

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-followup error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
