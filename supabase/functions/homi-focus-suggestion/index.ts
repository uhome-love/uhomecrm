/**
 * homi-focus-suggestion — Generates personalized follow-up message + insight
 * for the Focus Mode feature. Uses Lovable AI Gateway.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireApiKey, callAIRaw } from "../_shared/ai-helpers.ts";
import { requireRealUser } from "../_shared/ai-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  const _auth = await requireRealUser(req, {});
  if (_auth.error) return _auth.error;

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
Sua função é analisar o contexto completo do lead e sugerir:
1. Uma mensagem de follow up personalizada
2. Um insight estratégico de abordagem

REGRAS:
- Use TODOS os dados disponíveis para personalizar (origem, empreendimento, etapa, tempo parado, histórico)
- A mensagem deve ser pronta para envio via WhatsApp
- Tom informal mas profissional, máximo 3 frases
- Finalize com uma pergunta aberta relacionada ao interesse do lead
- O insight deve ser uma análise prática e específica do momento do lead (2-3 frases)
- Se o lead veio de Facebook Ads, mencione o empreendimento de interesse na mensagem
- Se há histórico de ligações sem sucesso, sugira WhatsApp como canal
- Se o lead está há muito tempo na mesma etapa, o insight deve abordar isso
- Se não há histórico, use a origem e interesse para criar uma primeira abordagem forte
- NUNCA dê respostas genéricas — sempre cite dados concretos do lead (nome do empreendimento, origem, tempo parado)`;

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

    const raw: any = await callAIRaw(apiKey, [
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

    // Extract from tool_calls or content
    let result = { mensagem: "", insight: "" };
    const message = raw?.choices?.[0]?.message;

    if (message?.tool_calls?.[0]?.function?.arguments) {
      try {
        result = JSON.parse(message.tool_calls[0].function.arguments);
      } catch {
        console.error("Failed to parse tool_calls arguments");
      }
    } else if (message?.content) {
      try {
        const parsed = JSON.parse(message.content);
        if (parsed.mensagem) result = parsed;
      } catch {
        result = { mensagem: message.content, insight: "Analise o contexto do lead antes de abordar." };
      }
    }

    // Fallback: if still empty, generate without tool calling
    if (!result.mensagem && !result.insight) {
      console.error("Empty result from AI, raw:", JSON.stringify(raw?.choices?.[0]?.message));
      result = { mensagem: "", insight: "Verifique o histórico do lead antes de abordar." };
    }

    return jsonResponse(result);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("homi-focus-suggestion error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});
