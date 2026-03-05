import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREENDIMENTOS_INFO: Record<string, string> = {
  "Casa Tua": "Condomínio fechado de casas, Encorp, Alto Petrópolis/Morro Santana. Casas 2-3 dorms (99-176m²). Pátio privativo, lazer completo. Para famílias que querem sair de apto.",
  "Open Bosque": "Open Construtora (Melnick), Passo d'Areia. Condomínio-parque com 7.500m² de lazer. Aptos 2-3 dorms (47-80m²). Conceito de parque dentro do condomínio.",
  "Shift": "Vanguard (Plaenge), Auxiliadora. Studios e 1 dorm (24-108m²). Conceito Life on Demand. Localização premium esquina Silva Jardim com 24 de Outubro.",
  "Casa Bastian": "ABF Developments, Menino Deus. Lofts e studios (14-36m²). Arquitetura moderna + preservação histórica. Alta liquidez para locação.",
  "Melnick Day": "EVENTO DE VENDAS anual da Melnick. 21/março/2026. Descontos até ~30%. Condições exclusivas que não se repetem. Urgência real.",
  "Alto Lindóia": "Florença Incorporadora, Sarandi. Resort urbano com +25 espaços de lazer (~7.298m²). Aptos 1-3 dorms (36-78m²). Melhor custo-benefício.",
  "Lake Eyre": "Construtora referência. Conceito de alto padrão com localização premium.",
  "Orygem": "Empreendimento moderno com conceito inovador.",
  "Las Casas": "Bairro planejado, lotes em condomínio fechado em POA. Para famílias que querem casa com segurança, espaço e natureza.",
};

const ALL_EMPREENDIMENTOS = Object.entries(EMPREENDIMENTOS_INFO)
  .map(([name, info]) => `• ${name}: ${info}`)
  .join("\n");

const systemPrompt = `Você é o HOMI, o assistente de inteligência comercial da Uhome.

SOBRE A UHOME: Imobiliária especializada em venda de imóveis de construtora em Porto Alegre, médio e alto padrão. Leads vindos de Meta Ads, TikTok Ads, portais e site.

SEU PAPEL: Treinador de vendas, estrategista comercial, especialista em conversão de leads, geração de visitas e negociação. Você é o cérebro comercial da Uhome.

EMPREENDIMENTOS QUE VOCÊ CONHECE:
${ALL_EMPREENDIMENTOS}

FUNIL DE VENDAS:
sem resposta → gerar resposta → qualificar → visita → proposta → fechamento

COMO RESPONDER:
- Respostas DIRETAS, comerciais, simples de aplicar, focadas em conversão
- Entregue scripts, mensagens, perguntas estratégicas, quebras de objeção
- Mensagens de WhatsApp: MÁXIMO 3 linhas, naturais, terminam com pergunta
- Scripts de ligação: naturais como conversa, com diálogo Corretor/Cliente
- Use gatilhos: oportunidade, escassez, valorização, qualidade de vida, investimento
- SEMPRE conduza para VISITA
- Use linguagem natural brasileira, nunca robótica
- Quando possível, sugira perguntas inteligentes que façam o cliente falar mais

PERSONALIDADE: Confiante, consultivo, comercial, estratégico, natural, direto. Fala como gerente comercial experiente.

IMPORTANTE: No chat livre, responda de forma conversacional e direta. Não precisa seguir formato rígido de seções. Adapte a resposta ao que o corretor pedir. Se pedir mensagem, dê mensagem curta. Se pedir estratégia, dê estratégia. Se perguntar sobre empreendimento, use seu conhecimento.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("homi-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
