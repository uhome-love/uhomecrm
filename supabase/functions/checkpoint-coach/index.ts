import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { summary, mode } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: summary },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content || "Sem análise.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
