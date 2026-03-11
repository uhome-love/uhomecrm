import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { template, lead, corretor_nome } = await req.json();

    if (!template || !lead) {
      return new Response(JSON.stringify({ error: "Missing template or lead data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Personalize esta mensagem para o lead." },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const mensagem = aiData.choices?.[0]?.message?.content || template;

    return new Response(JSON.stringify({ mensagem }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
