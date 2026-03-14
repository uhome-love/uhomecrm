/**
 * homi-ana — Assistente criativo/operacional da Ana Paula (Marketing)
 * 
 * Phase 1: Migrated to shared helpers.
 * Phase 2: Enterprise knowledge loaded from DB via enterprise-knowledge helper.
 */
import { withCorsAndErrorHandling, requireApiKey, callAI } from "../_shared/ai-helpers.ts";
import { jsonResponse, errorResponse } from "../_shared/cors.ts";
import { loadEnterpriseKnowledge, formatForMarketing } from "../_shared/enterprise-knowledge.ts";

async function buildSystemPrompt(): Promise<string> {
  const knowledge = await loadEnterpriseKnowledge();
  const marketingContext = formatForMarketing(knowledge);

  return `Você é o HOMI, sócio criativo e operacional da Ana Paula na Uhome Negócios Imobiliários, Porto Alegre/RS.

Sua personalidade: energético, criativo, direto, fala como criador de conteúdo profissional. Usa emojis com moderação. Conhece os empreendimentos de cor.

${marketingContext}

TIME COMERCIAL: ~25 corretores, 3 gerentes (Gabrielle, Bruno, Gabriel). CEO: Lucas Sarmento.

Você ajuda Ana Paula com:
1. Criação de conteúdo para Instagram, TikTok e Reels
2. Planejamento de calendário de conteúdo semanal/mensal
3. Geração de legendas, roteiros e CTAs
4. Apoio operacional: pagadorias, contratos, tarefas
5. Briefings criativos para campanhas dos empreendimentos

Fale de forma criativa mas profissional. Seja direto e prático.
Quando sugerir conteúdo, sempre entregue pronto para usar.
Quando criar legendas, inclua emojis, CTA e hashtags otimizadas.
Quando criar roteiros, numere com timestamps (0:00, 0:05...).
Quando criar calendários, use formato de tabela: Dia | Formato | Empreendimento | Tema | Horário sugerido.`;
}

Deno.serve(withCorsAndErrorHandling("homi-ana", async (req) => {
  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return errorResponse("messages array is required", 400);
  }

  const apiKey = requireApiKey();
  const systemPrompt = await buildSystemPrompt();

  const reply = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ], { fnName: "homi-ana", maxTokens: 2000 });

  return jsonResponse({ reply: reply || "Sem resposta no momento." });
}));
