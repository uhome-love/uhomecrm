/**
 * lead-intelligence-insights — Análise de dados de leads com IA
 * 
 * Migrated to shared helpers (Phase 1).
 * No hardcoded enterprise data — clean function.
 */
import { withCorsAndErrorHandling, requireApiKey, streamAI } from "../_shared/ai-helpers.ts";
import { errorResponse } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `Você é um analista de inteligência comercial imobiliária. Analise os dados de leads e gere insights acionáveis em português brasileiro.

Formato da resposta:
## 🎯 Principais Insights
- 3-5 insights estratégicos sobre campanhas, formulários e segmentos

## 📊 Destaques de Performance  
- Melhor campanha e por quê
- Formulário com melhor conversão
- Segmento mais promissor

## ⚠️ Pontos de Atenção
- Campanhas com baixa conversão
- Segmentos que precisam de ajuste
- Corretores que precisam de suporte

## 💡 Recomendações
- 3-5 ações práticas e específicas para melhorar resultados

Seja direto, use números e percentuais dos dados fornecidos. Máximo 400 palavras.`;

Deno.serve(withCorsAndErrorHandling("lead-intelligence-insights", async (req) => {
  const { summary } = await req.json();
  if (!summary) return errorResponse("summary is required", 400);

  const apiKey = requireApiKey();
  return await streamAI(apiKey, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Dados de leads do período "${summary.periodo}":\n\n${JSON.stringify(summary, null, 2)}` },
  ], { fnName: "lead-intelligence-insights", model: "google/gemini-3-flash-preview" });
}));
