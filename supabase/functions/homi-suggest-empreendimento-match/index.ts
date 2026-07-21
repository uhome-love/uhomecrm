import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { texto } = await req.json();
    if (!texto || typeof texto !== "string" || texto.trim().length < 2) {
      return new Response(JSON.stringify({ error: "texto_invalido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: emps } = await supabase
      .from("empreendimentos_canonicos")
      .select("id, nome, segmento_id, ativo, roleta_segmentos(nome)")
      .eq("ativo", true);

    const lista = (emps || []).map((e: any) => ({
      id: e.id,
      nome: e.nome,
      segmento: e.roleta_segmentos?.nome || null,
    }));

    if (lista.length === 0) {
      return new Response(JSON.stringify({ empreendimento_id: null, confianca: "baixa", motivo: "sem_canonicos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um sistema de match entre strings brutas de campanhas/anúncios do Meta Ads e empreendimentos canônicos de uma imobiliária. Retorne apenas um match se tiver confiança razoável. Se o texto for genérico ("a", "casa", "apto 3 quartos") ou não bater com nenhum empreendimento, retorne empreendimento_id null com confianca baixa.`;

    const userPrompt = `Texto bruto: "${texto}"

Empreendimentos canônicos disponíveis:
${lista.map((e, i) => `${i + 1}. ${e.nome}${e.segmento ? ` [${e.segmento}]` : ""} (id: ${e.id})`).join("\n")}

Retorne JSON: { "empreendimento_id": "uuid_ou_null", "confianca": "alta|media|baixa", "motivo": "breve explicação" }`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: "ai_gateway_error", detail: errText }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const validId = parsed.empreendimento_id && lista.some((e) => e.id === parsed.empreendimento_id)
      ? parsed.empreendimento_id
      : null;

    const nome = validId ? lista.find((e) => e.id === validId)?.nome ?? null : null;

    return new Response(
      JSON.stringify({
        empreendimento_id: validId,
        empreendimento_nome: nome,
        confianca: ["alta", "media", "baixa"].includes(parsed.confianca) ? parsed.confianca : "baixa",
        motivo: typeof parsed.motivo === "string" ? parsed.motivo.slice(0, 200) : "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "server_error", message: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
