import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireApiKey, callAI, withCorsAndErrorHandling } from "../_shared/ai-helpers.ts";

Deno.serve(withCorsAndErrorHandling("homi-copilot", async (req) => {
  // JWT validation
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Unauthorized", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return errorResponse("Unauthorized", 401);
  }

  const { lead_id, ultima_mensagem } = await req.json();
  if (!lead_id || !ultima_mensagem) {
    return errorResponse("lead_id e ultima_mensagem são obrigatórios", 400);
  }

  // Parallel queries
  const [mensagensRes, leadRes] = await Promise.all([
    supabase
      .from("whatsapp_mensagens")
      .select("body, direction, timestamp")
      .eq("lead_id", lead_id)
      .order("timestamp", { ascending: false })
      .limit(15),
    supabase
      .from("pipeline_leads")
      .select("nome, empreendimento, valor_estimado, stage_id, pipeline_stages(nome)")
      .eq("id", lead_id)
      .single(),
  ]);

  if (leadRes.error) {
    console.error("Lead not found:", leadRes.error);
    return errorResponse("Lead não encontrado", 404);
  }

  const lead = leadRes.data;
  const mensagens = mensagensRes.data || [];

  // Format history
  const historico = mensagens
    .reverse()
    .map((m: any) => {
      const d = new Date(m.timestamp);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const role = m.direction === "sent" ? "Corretor" : "Lead";
      return `[${hh}:${mm}] ${role}: ${m.body}`;
    })
    .join("\n");

  const nome = lead.nome || "Desconhecido";
  const etapa = (lead as any).pipeline_stages?.nome || "Não definida";
  const empreendimento = lead.empreendimento || "Não informado";
  const orcamento = lead.valor_estimado ? `R$ ${Number(lead.valor_estimado).toLocaleString("pt-BR")}` : "Não informado";

  const prompt = `Você é HOMI, assistente de vendas imobiliárias da Uhome Negócios Imobiliários em Porto Alegre, Brasil.

Objetivo principal: ajudar o corretor a converter este lead em uma visita presencial.

Perfil do lead:
- Nome: ${nome}
- Etapa: ${etapa}
- Interesse: ${empreendimento}
- Budget: ${orcamento}

Histórico da conversa (mais recente primeiro):
${historico || "(sem histórico)"}

Última mensagem recebida do lead:
'${ultima_mensagem}'

Responda APENAS com JSON válido, sem markdown, sem explicação:
{
  "sugestao_resposta": string (resposta natural e consultiva, máx 3 frases, objetivo: agendar visita presencial),
  "briefing": string (resumo do momento do lead em máx 12 palavras),
  "tom_detectado": "interessado" | "hesitante" | "frio" | "pronto",
  "sugestao_followup": string | null (título de tarefa sugerida ou null),
  "sugestao_etapa": string | null (nome da próxima etapa sugerida ou null)
}`;

  const apiKey = requireApiKey();
  const raw = await callAI(apiKey, [
    { role: "user", content: prompt },
  ], {
    model: "google/gemini-2.5-flash",
    fnName: "homi-copilot",
    temperature: 0.4,
  });

  // Parse JSON from response (strip markdown fences if present)
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return jsonResponse(parsed);
  } catch {
    console.error("homi-copilot: failed to parse AI response:", cleaned);
    return jsonResponse({
      sugestao_resposta: raw.trim(),
      briefing: "Resposta gerada sem estrutura",
      tom_detectado: "hesitante",
      sugestao_followup: null,
      sugestao_etapa: null,
    });
  }
}));
