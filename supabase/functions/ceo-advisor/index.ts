import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { data } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const systemPrompt = `Você é o "UHOME IA – CEO Advisor", um assistente estratégico de alto nível para o CEO de uma imobiliária.
Analise os dados consolidados de performance comercial e gere um relatório executivo COMPLETO e PRÁTICO.

ESTRUTURA OBRIGATÓRIA DA SUA RESPOSTA:

## 📊 Resumo do Período
(5-8 linhas resumindo o período analisado)

## 🏆 Top 3 Vitórias
(Principais conquistas do período)

## ⚠️ Top 3 Gargalos
(Principais problemas identificados)

## 👔 Diagnóstico por Gerente
(1 parágrafo por gerente: pontos fortes e pontos críticos)

## 🏅 Diagnóstico por Corretor
**Top 5 Melhores:** (nome + motivo)
**Top 5 em Alerta:** (nome + motivo)

## 🎯 Ações Recomendadas
(8-12 ações práticas e específicas. Ex: "Blitz de follow-up diária 14h-15h para equipe X")

## 💡 Decisões Estratégicas
- Onde cobrar mais
- Onde treinar
- Onde redistribuir esforços
- Quais corretores precisam de acompanhamento 1:1
- Quais metas ajustar
- Quais rotinas reforçar

REGRAS:
- Seja PRÁTICO e DIRETO. Foco em execução.
- Use dados concretos (números, percentuais, nomes).
- Sugira ações com impacto real e mensurável.
- Use emojis para facilitar leitura rápida.
- Métricas importantes: ligações, visitas marcadas, visitas realizadas, propostas, VGV gerado, VGV assinado.
- Score de 0-100 considera: ligações (10%), visitas marcadas (15%), visitas realizadas (25%), propostas (25%), VGV assinado (25%).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise os seguintes dados consolidados e gere o relatório CEO Advisor:\n\n${JSON.stringify(data, null, 2)}` },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content || "Sem resposta.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ceo-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
