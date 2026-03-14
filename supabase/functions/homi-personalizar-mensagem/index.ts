/**
 * homi-personalizar-mensagem — Personalização de templates com IA
 * 
 * Migrated to shared helpers (Phase 1).
 * No hardcoded enterprise data — clean function.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCorsAndErrorHandling, requireApiKey, callAI } from "../_shared/ai-helpers.ts";
import { jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(withCorsAndErrorHandling("homi-personalizar-mensagem", async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errorResponse("Unauthorized", 401);

  const { template, lead, corretor_nome } = await req.json();
  if (!template || !lead) return errorResponse("Missing template or lead data", 400);

  const systemPrompt = `Você é um especialista em vendas imobiliárias da Uhome. Personalize esta mensagem para o lead específico, tornando-a mais natural e persuasiva.

Dados do lead:
- Nome: ${lead.nome || "Cliente"}
- Empreendimento: ${lead.empreendimento || "não especificado"}
- Score: ${lead.score || "não disponível"}
- Última interação: ${lead.ultima_interacao || "não disponível"}
- Fase atual: ${lead.fase || "não disponível"}

Template base:
${template}

Regras:
- Manter tom profissional mas próximo
- Personalizar com contexto do lead
- Máximo 5 linhas para WhatsApp
- Incluir CTA claro
- Não inventar dados que não foram fornecidos
- O nome do corretor é: ${corretor_nome || "Corretor"}
- Retorne APENAS a mensagem personalizada, sem explicações`;

  const apiKey = requireApiKey();
  const mensagem = await callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Personalize esta mensagem para o lead." },
  ], { fnName: "homi-personalizar-mensagem", maxTokens: 500, temperature: 0.7 });

  return jsonResponse({ mensagem: mensagem || template });
}));
