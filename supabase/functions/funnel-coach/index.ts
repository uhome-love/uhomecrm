import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { entry, previousEntry } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    // Build comparison text
    let comparativo = "Não há dados do período anterior para comparação.";
    if (previousEntry) {
      const variacao = (atual: number, anterior: number) => {
        if (anterior === 0) return atual > 0 ? "+∞%" : "0%";
        const pct = ((atual - anterior) / anterior * 100).toFixed(1);
        return `${Number(pct) > 0 ? "+" : ""}${pct}%`;
      };
      comparativo = `COMPARATIVO COM PERÍODO ANTERIOR:
- Leads: ${previousEntry.leads_gerados} → ${entry.leads_gerados} (${variacao(entry.leads_gerados, previousEntry.leads_gerados)})
- Propostas: ${previousEntry.propostas_geradas} → ${entry.propostas_geradas} (${variacao(entry.propostas_geradas, previousEntry.propostas_geradas)})
- Vendas: ${previousEntry.vendas_fechadas} → ${entry.vendas_fechadas} (${variacao(entry.vendas_fechadas, previousEntry.vendas_fechadas)})
- VGV: R$${previousEntry.vgv_vendido} → R$${entry.vgv_vendido} (${variacao(entry.vgv_vendido, previousEntry.vgv_vendido)})
- Investimento: R$${previousEntry.investimento_midia} → R$${entry.investimento_midia} (${variacao(entry.investimento_midia, previousEntry.investimento_midia)})`;
    }

    const taxaProposta = entry.leads_gerados > 0 ? ((entry.propostas_geradas / entry.leads_gerados) * 100).toFixed(1) : "0";
    const taxaVenda = entry.leads_gerados > 0 ? ((entry.vendas_fechadas / entry.leads_gerados) * 100).toFixed(1) : "0";
    const taxaFechamento = entry.propostas_geradas > 0 ? ((entry.vendas_fechadas / entry.propostas_geradas) * 100).toFixed(1) : "0";
    const cplReal = entry.leads_gerados > 0 ? (entry.investimento_midia / entry.leads_gerados).toFixed(2) : "N/A";
    const cacEstimado = entry.vendas_fechadas > 0 ? (entry.investimento_midia / entry.vendas_fechadas).toFixed(2) : "N/A";
    const invPorProposta = entry.propostas_geradas > 0 ? (entry.investimento_midia / entry.propostas_geradas).toFixed(2) : "N/A";

    const prompt = `Você é o "UHOME IA – Funil Coach", especialista em análise de funil de vendas imobiliárias.

DADOS DO PERÍODO (${entry.periodo_inicio} a ${entry.periodo_fim}):
- Leads gerados: ${entry.leads_gerados}
- Propostas geradas: ${entry.propostas_geradas}
- Vendas fechadas: ${entry.vendas_fechadas}
- VGV vendido: R$ ${entry.vgv_vendido}
- Investimento em mídia: R$ ${entry.investimento_midia}
- Custo médio por lead configurado: R$ ${entry.custo_medio_lead}

TAXAS DO FUNIL:
- Lead → Proposta: ${taxaProposta}%
- Lead → Venda: ${taxaVenda}%
- Proposta → Venda (fechamento): ${taxaFechamento}%

MÉTRICAS FINANCEIRAS:
- CPL real: R$ ${cplReal}
- CAC estimado: R$ ${cacEstimado}
- Investimento por proposta: R$ ${invPorProposta}

${comparativo}

OBSERVAÇÕES DO GERENTE: ${entry.observacoes || "Nenhuma observação."}

Produza uma análise completa com EXATAMENTE estas seções (use ## para cada):

## Resumo do Período
5-8 linhas com visão geral.

## Diagnóstico do Gargalo
Onde o funil está travando? (leads→propostas ou propostas→vendas). Seja específico.

## Leitura de Eficiência
Analise CPL, CAC e investimento por proposta. Diga se estão saudáveis ou preocupantes.

## Insights
Considerando as observações do gerente, o que podemos inferir?

## Recomendações Práticas
6-10 ações objetivas, mensuráveis e executáveis. Exemplos:
- "Aumentar foco em conversão de proposta"
- "Rever qualidade dos leads se leads altos e propostas baixas"
- "Melhorar follow-up se propostas existem mas vendas não avançam"

## Meta Sugerida para o Próximo Período
Sugira metas de leads, propostas e vendas para o próximo período com justificativa.

Seja direto, prático e orientado a resultado. Fale como um consultor de vendas imobiliárias experiente.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content || "Erro ao gerar análise.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("funnel-coach error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
