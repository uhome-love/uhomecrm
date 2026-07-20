/**
 * homi-next-task-suggestion — Extrai sugestão de próxima tarefa a partir de
 * uma observação em português coloquial. Mesmo padrão de `homi-focus-suggestion`:
 * Lovable AI Gateway via _shared/ai-helpers.ts, tool calling forçado.
 *
 * Input:  { texto: string, dataReferencia: "YYYY-MM-DD" }
 * Output: { tipo, vence_em, hora_vencimento, confianca: "alta"|"baixa" }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireApiKey, callAIRaw } from "../_shared/ai-helpers.ts";

const TIPOS = ["ligacao", "whatsapp", "follow_up", "visita", "proposta", "email"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const apiKey = requireApiKey();
    const { texto, dataReferencia } = await req.json();

    if (typeof texto !== "string" || texto.trim().length < 10) {
      return jsonResponse({ confianca: "baixa" });
    }
    if (typeof dataReferencia !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dataReferencia)) {
      return errorResponse("dataReferencia inválida (YYYY-MM-DD)", 400);
    }

    const systemPrompt = `Você é a HOMI, assistente de vendas da Uhome Imóveis.
Analise a observação de um corretor sobre um contato com o lead e extraia a próxima tarefa que deve ser agendada.

INTERPRETE português coloquial brasileiro relativo à data de referência ${dataReferencia}:
- "amanhã", "depois de amanhã", "hoje à tarde"
- "semana que vem", "próxima terça", "terça de manhã/tarde/noite"
- "daqui a X dias", "no dia X", "às 14h"
- Manhã = 10:00, Tarde = 14:00, Noite = 19:00 (default 10:00 se não mencionado)
- Fins de semana permitidos apenas se explicitamente mencionados
- Se disser "semana que vem" sem dia → segunda-feira da próxima semana

CLASSIFIQUE o tipo de ação mencionada em UMA destas opções:
- ligacao: ligar, chamar, telefonar
- whatsapp: mandar zap, whats, mensagem
- email: e-mail
- visita: visitar, mostrar imóvel, agendar visita
- proposta: enviar proposta, contra-proposta
- follow_up: acompanhar, dar retorno, follow, genérico

CONFIANÇA:
- "alta": texto tem referência temporal EXPLÍCITA e razoavelmente clara (data, dia da semana, "amanhã", "semana que vem", etc.)
- "baixa": ambiguidade — "depois", "mais pra frente", "quando puder", sem menção temporal
  Nesse caso vence_em e hora_vencimento podem vir vazios ("").

NUNCA agende data no passado. Se a interpretação cair no passado, marque confianca="baixa".`;

    const userPrompt = `Observação do corretor:\n"""${texto.trim()}"""`;

    const raw: any = await callAIRaw(apiKey, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      fnName: "homi-next-task-suggestion",
      tools: [{
        type: "function",
        function: {
          name: "sugerir_proxima_tarefa",
          description: "Retorna a próxima tarefa sugerida com base na observação",
          parameters: {
            type: "object",
            properties: {
              tipo: { type: "string", enum: [...TIPOS] },
              vence_em: { type: "string", description: "YYYY-MM-DD ou string vazia" },
              hora_vencimento: { type: "string", description: "HH:mm ou string vazia" },
              confianca: { type: "string", enum: ["alta", "baixa"] },
            },
            required: ["tipo", "vence_em", "hora_vencimento", "confianca"],
            additionalProperties: false,
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "sugerir_proxima_tarefa" } },
    });

    let result: any = { tipo: "follow_up", vence_em: "", hora_vencimento: "", confianca: "baixa" };
    const message = raw?.choices?.[0]?.message;
    const args = message?.tool_calls?.[0]?.function?.arguments;
    if (args) {
      try { result = { ...result, ...JSON.parse(args) }; } catch { /* keep default */ }
    }

    // Validação: vence_em precisa ser data válida e não no passado
    if (result.confianca === "alta") {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(result.vence_em);
      if (!ok) {
        result.confianca = "baixa";
      } else {
        // Comparação lexicográfica funciona para YYYY-MM-DD
        if (result.vence_em < dataReferencia) {
          result.confianca = "baixa";
        }
      }
      if (!/^\d{2}:\d{2}$/.test(result.hora_vencimento)) {
        result.hora_vencimento = "10:00";
      }
      if (!TIPOS.includes(result.tipo)) result.tipo = "follow_up";
    }

    if (result.confianca === "baixa") {
      result.vence_em = "";
      result.hora_vencimento = "";
    }

    return jsonResponse(result);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("homi-next-task-suggestion error:", err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error");
  }
});
