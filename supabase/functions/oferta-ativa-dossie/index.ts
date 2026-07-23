// oferta-ativa-dossie — gera dossiê rápido do lead descartado para o Mutirão Inteligente.
// Não depende de histórico de conversa. Usa Lovable AI Gateway (Gemini).
// Corretor. requireAuth via header Bearer.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const pipeline_lead_id: string | undefined = body?.pipeline_lead_id;
    if (!pipeline_lead_id) return errorResponse("pipeline_lead_id required", 400);

    const { data: lead, error } = await admin
      .from("pipeline_leads")
      .select(
        "id, nome, empreendimento, motivo_descarte, tipo_descarte, reengajamento_status, stage_changed_at, lead_score, lead_temperatura, origem, campanha, objetivo_cliente, bairro_regiao, forma_pagamento, observacoes, created_at",
      )
      .eq("id", pipeline_lead_id)
      .maybeSingle();
    if (error) return errorResponse(error.message, 500);
    if (!lead) return errorResponse("lead não encontrado", 404);

    // Dias desde descarte em BRT
    let diasDesdeDescarte: number | null = null;
    if (lead.stage_changed_at) {
      const brtOffsetMs = -3 * 60 * 60 * 1000;
      const toBrtDay = (d: Date) => Math.floor((d.getTime() + brtOffsetMs) / 86_400_000);
      diasDesdeDescarte = Math.max(
        0,
        toBrtDay(new Date()) - toBrtDay(new Date(lead.stage_changed_at)),
      );
    }

    const linhas = [
      `Nome: ${lead.nome ?? "—"}`,
      `Empreendimento: ${lead.empreendimento ?? "—"}`,
      `Origem/Campanha: ${lead.origem ?? "—"}${lead.campanha ? " / " + lead.campanha : ""}`,
      `Motivo do descarte: ${lead.motivo_descarte ?? "—"}${lead.tipo_descarte ? " (" + lead.tipo_descarte + ")" : ""}`,
      `Status reengajamento: ${lead.reengajamento_status ?? "—"}`,
      `Tempo desde descarte: ${diasDesdeDescarte !== null ? diasDesdeDescarte + " dias" : "—"}`,
      `Score: ${lead.lead_score ?? "—"} / Temperatura: ${lead.lead_temperatura ?? "—"}`,
      `Objetivo do cliente: ${lead.objetivo_cliente ?? "—"}`,
      `Região de interesse: ${lead.bairro_regiao ?? "—"}`,
      `Forma de pagamento: ${lead.forma_pagamento ?? "—"}`,
      `Observações: ${lead.observacoes ?? "—"}`,
    ].join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return errorResponse("LOVABLE_API_KEY ausente", 500);

    const prompt = `Você é um consultor de vendas imobiliárias. Gere um DOSSIÊ CURTO (máx. 6 linhas) para um corretor
retomar contato com um lead descartado no "Mutirão Inteligente".
Estrutura:
1) 1 frase de contexto (empreendimento, tempo desde descarte, temperatura).
2) 1 frase sobre o motivo do descarte e como abordar.
3) 1 sugestão prática de abertura de conversa (máx. 2 linhas).
Tom objetivo, sem clichês. Se algum dado for "—", ignore em silêncio.

DADOS DO LEAD:
${linhas}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (resp.status === 429) return errorResponse("Limite de uso da IA atingido. Tente em instantes.", 429);
    if (resp.status === 402) return errorResponse("Créditos de IA esgotados no workspace.", 402);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[dossie] gateway error", resp.status, text);
      return errorResponse(`gateway ${resp.status}`, 502);
    }

    const data = await resp.json();
    const texto: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!texto) return errorResponse("resposta vazia da IA", 502);

    return jsonResponse({ ok: true, texto });
  } catch (e) {
    console.error("[dossie] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
