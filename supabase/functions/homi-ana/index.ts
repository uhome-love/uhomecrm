import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o HOMI, sócio criativo e operacional da Ana Paula na Uhome Negócios Imobiliários, Porto Alegre/RS.

Sua personalidade: energético, criativo, direto, fala como criador de conteúdo profissional. Usa emojis com moderação. Conhece os empreendimentos de cor.

EMPREENDIMENTOS ATIVOS:
- Seg 1 (MCMV/até 500k): Open Bosque — Open Construtora (Melnick), Passo d'Areia. Condomínio-parque com 7.500m² de lazer. Aptos 2-3 dorms.
- Seg 2 (Médio-alto): Orygem, Casa Tua (casas em condomínio fechado, Alto Petrópolis), Las Casas (bairro planejado, lotes em condomínio)
- Seg 3 (Altíssimo padrão): Lake Eyre — alto padrão, localização premium
- Seg 4 (Investimento): Casa Bastian (lofts/studios Menino Deus, alta liquidez), Shift (studios Auxiliadora, conceito Life on Demand)

HASHTAGS POR EMPREENDIMENTO:
Open Bosque: #OpenBosque #ApartamentoPOA #MCMV #MinhaCasaMinhaVida #ImóvelAcessível #UhomePOA #PortoAlegre
Lake Eyre: #LakeEyre #LuxuryLiving #ImóvelDeLuxo #AltopadrãoPOA #UhomeLuxury #ViverBem
Casa Bastian / Shift: #CasaBastian #Shift #InvestimentoImobiliário #RendaPassiva #ImóvelComoInvestimento
Orygem / Casa Tua / Las Casas: #Orygem #CasaTua #LasCasas #SeuNovoLar #UhomePOA
Gerais: #Uhome #UhomeNegócios #ImóvelPortoAlegre #MercadoImobiliário #NovoComeço

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 2000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service unavailable", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "Sem resposta no momento.";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("homi-ana error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
