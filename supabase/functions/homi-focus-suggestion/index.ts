/**
 * homi-focus-suggestion — Generates personalized follow-up message + insight
 * for the Focus Mode feature. Uses Lovable AI Gateway.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireApiKey, callAI } from "../_shared/ai-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const apiKey = requireApiKey();
    const { lead } = await req.json();

    if (!lead?.name) {
      return errorResponse("Lead data is required", 400);
    }

    const historicoTexto = (lead.historico_atividades || []).length > 0
      ? lead.historico_atividades.join("\n")
      : "Nenhuma atividade registrada";

    const tarefasTexto = (lead.tarefas || []).length > 0
      ? lead.tarefas.join("\n")
      : "Nenhuma tarefa registrada";

    const systemPrompt = `Você é a HOMI, assistente de vendas da Uhome Imóveis em Porto Alegre.
Sua função é analisar o HISTÓRICO REAL do lead e sugerir:
1. Uma mensagem de follow up personalizada baseada no que já aconteceu
2. Um insight estratégico de abordagem baseado no comportamento e contexto real

REGRAS:
- Use os dados reais do histórico para personalizar — cite interações anteriores
- A mensagem deve ser pronta para envio via WhatsApp
- Tom informal mas profissional, máximo 3 frases
- Finalize com uma pergunta aberta relacionada ao contexto real
- O insight deve ser uma análise prática do momento do lead (2-3 frases)
- Se houve ligações sem sucesso, sugira outro canal
- Se o lead demonstrou interesse em algo específico, retome esse ponto
- NUNCA dê respostas genéricas como "tente uma abordagem empática"`;

    const userPrompt = `Lead: ${lead.name}
Etapa atual: ${lead.stage || "Não definida"}
Dias na etapa: ${lead.days_in_stage ?? "Desconhecido"}
Origem: ${lead.origin || "Não informada"}
Interesse/Empreendimento: ${lead.interest || "Não informado"}
Dias sem contato: ${lead.days_without_contact ?? "Desconhecido"}
Motivos de alerta: ${(lead.alert_reasons || []).join(", ") || "Nenhum"}
Tags: ${(lead.tags || []).join(", ") || "Nenhuma"}

HISTÓRICO DE ATIVIDADES (mais recentes primeiro):
${historicoTexto}

TAREFAS:
${tarefasTexto}`;

    const content = await callAI(apiKey, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      fnName: "homi-focus-suggestion",
      tools: [{
        type: "function",
        function: {
          name: "focus_suggestion",
          description: "Return the follow-up message and sales insight",
          parameters: {
            type: "object",
            properties: {
              mensagem: { type: "string", description: "WhatsApp follow-up message ready to send" },
              insight: { type: "string", description: "Quick sales approach tip for the broker" },
            },
            required: ["mensagem", "insight"],
            additionalProperties: false,
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "focus_suggestion" } },
    });

    // Parse tool call result
    let result = { mensagem: "", insight: "" };
    try {
      const parsed = JSON.parse(content);
      // Handle both direct JSON and tool_calls format
      if (parsed.mensagem) {
        result = parsed;
      } else if (parsed.tool_calls?.[0]?.function?.arguments) {
        result = JSON.parse(parsed.tool_calls[0].function.arguments);
      }
    } catch {
      // If tool calling worked, content might be the arguments directly
      try {
        result = JSON.parse(content);
      } catch {
        result = { mensagem: content, insight: "Tente uma abordagem empática e direta." };
      }
    }

    return jsonResponse(result);
  } catch (err) {
    // If it's already a Response (from handleAIError), return it
    if (err instanceof Response) return err;
    console.error("homi-focus-suggestion error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});
