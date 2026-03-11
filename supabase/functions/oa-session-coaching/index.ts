import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_metrics, corretor_nome } = await req.json();

    if (!session_metrics) {
      return new Response(JSON.stringify({ error: "session_metrics required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const m = session_metrics;

    const systemPrompt = `Você é o HOMI, coach de vendas imobiliárias da Uhome. 
Após cada sessão de ligações do corretor, você analisa os resultados e dá um feedback personalizado.

Regras:
- Seja direto, motivacional e prático
- Use no máximo 4-5 parágrafos
- Comece elogiando algo concreto (se possível)
- Identifique 1-2 pontos de melhoria específicos
- Compare com médias quando disponível
- Termine com uma dica acionável para a próxima sessão
- Use emojis com moderação
- Tom: coach experiente, não robô

IMPORTANTE: Responda em português do Brasil.`;

    const userPrompt = `Analise esta sessão de ligações do corretor ${corretor_nome || ""}:

📊 MÉTRICAS DA SESSÃO:
- Duração: ${m.duracao_min || 0} minutos
- Total de tentativas: ${m.total_tentativas || 0}
- Atenderam: ${m.total_atenderam || 0} (taxa: ${m.taxa_atendimento || 0}%)
- Aproveitados: ${m.total_aproveitados || 0} (taxa: ${m.taxa_aproveitamento || 0}%)
- Ligações: ${m.ligacoes || 0} | WhatsApp: ${m.whatsapps || 0} | Email: ${m.emails || 0}
- Pontos ganhos: ${m.pontos || 0}
- Empreendimento principal: ${m.empreendimento || "N/A"}

📈 MÉDIA DO CORRETOR (últimos 30 dias):
- Tentativas/sessão: ${m.media_corretor_tentativas || "N/A"}
- Taxa aproveitamento: ${m.media_corretor_aproveitamento || "N/A"}%

👥 MÉDIA DO TIME HOJE:
- Tentativas: ${m.media_time_tentativas || "N/A"}
- Aproveitados: ${m.media_time_aproveitados || "N/A"}

${m.detalhes_por_hora ? `⏰ DESEMPENHO POR HORA:\n${m.detalhes_por_hora}` : ""}

${m.leads_quentes_pendentes ? `🔥 Leads quentes sem contato: ${m.leads_quentes_pendentes}` : ""}

Gere o feedback de coaching personalizado.`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const feedback = result.choices?.[0]?.message?.content || "Sem feedback disponível.";

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("oa-session-coaching error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
