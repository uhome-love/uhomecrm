import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { csvData, fileName } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const prompt = `Analise os dados abaixo de um relatório de marketing imobiliário (arquivo: ${fileName}).

Identifique e extraia os campos relevantes. Os campos possíveis são:
- campanha (nome da campanha)
- anuncio (nome do anúncio, se houver)
- empreendimento (produto/empreendimento imobiliário)
- investimento (valor em R$)
- impressoes (número de impressões)
- cliques (número de cliques)
- leads_gerados (quantidade de leads)
- conversoes (conversões)
- periodo (período do dado, se identificável)

Identifique também o canal de marketing provável:
- meta_ads (Facebook/Instagram Ads)
- tiktok_ads
- portal_zap (Zap Imóveis)
- portal_imovelweb
- portal_vivareal
- site_uhome
- google_ads
- outros

Retorne APENAS um JSON válido no formato:
{
  "canal": "meta_ads",
  "entries": [
    {
      "campanha": "...",
      "anuncio": "...",
      "empreendimento": "...",
      "investimento": 0,
      "impressoes": 0,
      "cliques": 0,
      "leads_gerados": 0,
      "conversoes": 0,
      "periodo": "..."
    }
  ]
}

Se algum campo não existir nos dados, use null ou 0.
Dados do relatório:
${csvData}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um parser de dados de marketing. Responda APENAS com JSON válido, sem markdown, sem explicações." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      parsed = { canal: "outros", entries: [], error: "Não foi possível interpretar o relatório." };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-marketing-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
