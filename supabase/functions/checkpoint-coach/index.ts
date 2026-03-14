/**
 * checkpoint-coach — Análise IA do checkpoint semanal
 * 
 * Migrated to shared helpers (Phase 1).
 * No hardcoded enterprise data — clean function.
 */
import { withCorsAndErrorHandling, requireApiKey, callAI } from "../_shared/ai-helpers.ts";
import { jsonResponse } from "../_shared/cors.ts";

Deno.serve(withCorsAndErrorHandling("checkpoint-coach", async (req) => {
  const { summary, mode } = await req.json();

  const systemPrompt = mode === "jetimob_analysis"
    ? `Você é um analista de dados imobiliários da UHome. Analise os dados colados do Jetimob e:
1. Identifique métricas relevantes (leads, contatos, visitas, propostas, VGV)
2. Gere um resumo executivo
3. Aponte divergências ou pontos de atenção
4. Gere 3-5 insights acionáveis
Responda em português, formatado em markdown.`
    : `Você é o "Coach de Performance UHome", um consultor de gestão comercial imobiliária.

Analise os dados de metas vs resultados do time e produza OBRIGATORIAMENTE em português:

## A) Resumo da Semana (3-5 linhas)
## B) Top 3 Destaques Positivos
Nome do corretor + motivo concreto
## C) Top 3 Alertas
Nome do corretor + motivo concreto + ação sugerida
## D) Diagnóstico do Funil
Identifique onde está travando: Ligações→Visitas, Visitas→Propostas, Propostas→VGV
## E) Plano de Ação para Próxima Semana (5 itens práticos)
Ações específicas e executáveis como:
- "Fazer 1h de blitz de ligação 14:00-15:00"
- "Focar nos leads 7-30 dias"
- "Revisar pitch de visita"
- "Cobrar relatório de visitas até 17:30"
## F) Sugestões de Abordagem
Follow-up, reativação, convite de visita
## G) Sugestão de Microtreinamento
Tema de 10 minutos para o time

Seja direto, prático e use dados concretos dos resultados fornecidos.`;

  const apiKey = requireApiKey();
  const analysis = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: summary },
  ], { fnName: "checkpoint-coach" });

  return jsonResponse({ analysis: analysis || "Sem análise." });
}));
