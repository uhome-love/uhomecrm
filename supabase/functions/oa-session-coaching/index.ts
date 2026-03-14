/**
 * oa-session-coaching — Feedback pós-sessão de Oferta Ativa
 * 
 * Migrated to shared helpers (Phase 1).
 * No hardcoded enterprise data — clean function.
 */
import { withCorsAndErrorHandling, requireApiKey, callAI } from "../_shared/ai-helpers.ts";
import { jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(withCorsAndErrorHandling("oa-session-coaching", async (req) => {
  const { session_metrics, corretor_nome } = await req.json();

  if (!session_metrics) {
    return errorResponse("session_metrics required", 400);
  }

  const m = session_metrics;

  const systemPrompt = `Você é o HOMI, coach de vendas imobiliárias da Uhome. 
Após cada sessão de ligações do corretor, você analisa os resultados e dá um feedback personalizado.

Regras:
- Seja direto, motivacional e prático
- Use no máximo 4-5 parágrafos
- Comece elogiando algo concreto (se possível)
- Identifique 1-2 pontos de melhoria específicos
- Compare com médias quando disponível
- Termine com uma dica acionável para a próxima sessão
- Use emojis com moderação
- Tom: coach experiente, não robô

IMPORTANTE: Responda em português do Brasil.`;

  const userPrompt = `Analise esta sessão de ligações do corretor ${corretor_nome || ""}:

📊 MÉTRICAS DA SESSÃO:
- Duração: ${m.duracao_min || 0} minutos
- Total de tentativas: ${m.total_tentativas || 0}
- Atenderam: ${m.total_atenderam || 0} (taxa: ${m.taxa_atendimento || 0}%)
- Aproveitados: ${m.total_aproveitados || 0} (taxa: ${m.taxa_aproveitamento || 0}%)
- Ligações: ${m.ligacoes || 0} | WhatsApp: ${m.whatsapps || 0} | Email: ${m.emails || 0}
- Pontos ganhos: ${m.pontos || 0}
- Empreendimento principal: ${m.empreendimento || "N/A"}

📈 MÉDIA DO CORRETOR (últimos 30 dias):
- Tentativas/sessão: ${m.media_corretor_tentativas || "N/A"}
- Taxa aproveitamento: ${m.media_corretor_aproveitamento || "N/A"}%

👥 MÉDIA DO TIME HOJE:
- Tentativas: ${m.media_time_tentativas || "N/A"}
- Aproveitados: ${m.media_time_aproveitados || "N/A"}

${m.detalhes_por_hora ? `⏰ DESEMPENHO POR HORA:\n${m.detalhes_por_hora}` : ""}

${m.leads_quentes_pendentes ? `🔥 Leads quentes sem contato: ${m.leads_quentes_pendentes}` : ""}

Gere o feedback de coaching personalizado.`;

  const apiKey = requireApiKey();
  const feedback = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { fnName: "oa-session-coaching" });

  return jsonResponse({ feedback: feedback || "Sem feedback disponível." });
}));
