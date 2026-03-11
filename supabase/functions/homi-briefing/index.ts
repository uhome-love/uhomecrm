import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Verify admin role
    const { data: roleCheck } = await adminClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Acesso restrito" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dashboardData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é o HOMI, co-CEO inteligente da Uhome Negócios Imobiliários. 
Analise os dados do dia e gere um briefing executivo conciso e estratégico para o CEO. 
Seja direto, use dados reais, identifique padrões e sugira ações concretas. Não seja genérico.

RESPONDA EXCLUSIVAMENTE com um JSON válido no formato abaixo (sem markdown, sem backticks, apenas JSON puro):
{
  "status_geral": "🟢 No caminho" ou "🟡 Atenção" ou "🔴 Crítico",
  "frase_do_dia": "uma frase motivacional ou estratégica curta e relevante para o cenário atual",
  "destaques": ["ponto positivo 1", "ponto positivo 2", "ponto positivo 3"],
  "alertas": ["ponto de atenção 1", "ponto de atenção 2", "ponto de atenção 3"],
  "acao_prioritaria": "A ação mais importante e concreta que o CEO deve tomar hoje",
  "previsao": "Projeção do mês baseada no ritmo atual dos dados"
}

Regras:
- Máximo 3 itens em destaques e alertas
- Cada item deve ter no máximo 80 caracteres
- Frase do dia: máximo 60 caracteres
- Ação prioritária: máximo 120 caracteres  
- Previsão: máximo 150 caracteres
- Use dados concretos nos textos (números, nomes, percentuais)
- status_geral deve ser baseado na performance real`;

    const userPrompt = `Dados do dashboard CEO de hoje:
${JSON.stringify(dashboardData, null, 2)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Strip markdown code fences if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    let briefing;
    try {
      briefing = JSON.parse(content);
    } catch {
      // Fallback
      briefing = {
        status_geral: "🟡 Atenção",
        frase_do_dia: "Dados em análise.",
        destaques: ["Briefing gerado com dados parciais"],
        alertas: ["Não foi possível processar todos os dados"],
        acao_prioritaria: "Revisar o dashboard manualmente",
        previsao: "Projeção indisponível neste momento",
      };
    }

    const today = new Date().toISOString().slice(0, 10);

    // Upsert briefing
    const { error: upsertError } = await adminClient
      .from("homi_briefing_diario")
      .upsert({
        data: today,
        user_id: user.id,
        status_geral: briefing.status_geral,
        frase_do_dia: briefing.frase_do_dia,
        destaques: briefing.destaques,
        alertas: briefing.alertas,
        acao_prioritaria: briefing.acao_prioritaria,
        previsao: briefing.previsao,
        dados_contexto: dashboardData,
        gerado_em: new Date().toISOString(),
      }, { onConflict: "data,user_id" });

    if (upsertError) console.error("Upsert error:", upsertError);

    return new Response(JSON.stringify({ briefing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("homi-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
