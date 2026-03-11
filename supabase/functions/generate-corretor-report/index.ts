import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      corretor_nome,
      gerente_nome,
      periodo_inicio,
      periodo_fim,
      periodo_tipo,
      metricas,
      taxas_conversao,
      score_performance,
      tendencia,
      contexto_gerente,
      observacoes,
    } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const systemPrompt = `Você é o "UHOME IA – Relatório 1:1 Coach", um especialista em gestão comercial imobiliária.

Sua função é gerar relatórios profissionais de performance individual para reuniões one-a-one entre gerente e corretor.

O relatório deve ser CLARO, PROFISSIONAL, DIRETO e PRÁTICO.

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

# 📊 RELATÓRIO DE PERFORMANCE — ${corretor_nome}
**Período:** ${periodo_inicio} a ${periodo_fim} (${periodo_tipo})
**Gerente:** ${gerente_nome}
**Data de geração:** ${new Date().toLocaleDateString("pt-BR")}

---

## 1. RESUMO EXECUTIVO
(5 a 8 linhas com visão geral do período — direto ao ponto)

## 2. PAINEL DE NÚMEROS
(Tabela markdown com: Métrica | Meta | Realizado | % Atingimento — para cada KPI)

## 3. EFICIÊNCIA DO FUNIL
(Diagnóstico de onde está travando no funil de vendas:
- Ligações → Visitas Marcadas (taxa)
- Visitas Marcadas → Visitas Realizadas (taxa)
- Visitas Realizadas → Propostas (taxa)
- Propostas → VGV Assinado (taxa)
Identificar o gargalo principal)

## 4. PONTOS FORTES
(3 a 5 bullet points com base nos números + contexto do gerente)

## 5. PONTOS DE ATENÇÃO
(3 a 5 bullet points com base nos números + contexto do gerente)

## 6. DIAGNÓSTICO
(1 parágrafo respondendo: "O que está impedindo o próximo nível de resultado?")

## 7. PLANO DE MELHORIA

### Próximos 7 dias (ações diárias)
(3-5 ações objetivas, mensuráveis e executáveis)

### Próximos 30 dias (ações semanais)
(3-5 ações objetivas, mensuráveis e executáveis)

## 8. METAS RECOMENDADAS PARA O PRÓXIMO PERÍODO
(Metas ajustadas com justificativa curta)

## 9. COMPROMISSOS DO ONE A ONE

### Compromissos do Corretor
(3 a 6 compromissos)

### Compromissos do Gerente
(1 a 3 compromissos de suporte/acompanhamento)

---

REGRAS:
- Seja direto e prático, sem enrolação
- As ações do plano devem ser específicas (ex: "Blitz de ligações 14:00–15:00, mínimo 25/dia")
- Use dados concretos para justificar cada ponto
- O diagnóstico deve ser honesto mas construtivo
- Adapte a intensidade ao contexto do gerente
- Use emojis com moderação para organização visual`;

    const userPrompt = `Gere o relatório 1:1 com os seguintes dados:

CORRETOR: ${corretor_nome}
PERÍODO: ${periodo_inicio} a ${periodo_fim} (${periodo_tipo})

MÉTRICAS DO PERÍODO:
${JSON.stringify(metricas, null, 2)}

TAXAS DE CONVERSÃO DO FUNIL:
${JSON.stringify(taxas_conversao, null, 2)}

SCORE DE PERFORMANCE: ${score_performance}/100

${tendencia ? `TENDÊNCIA (comparação com período anterior):\n${JSON.stringify(tendencia, null, 2)}` : "Sem dados de período anterior para comparação."}

CONTEXTO DO GERENTE SOBRE O CORRETOR:
${contexto_gerente}

${observacoes ? `OBSERVAÇÕES ADICIONAIS:\n${observacoes}` : ""}`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "Sem resposta.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-corretor-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
