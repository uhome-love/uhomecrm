/**
 * rh-vaga-disponibilidade — Público (página /vaga).
 * Retorna os horários JÁ OCUPADOS (rh_entrevistas com status 'agendada')
 * dentro de uma janela de dias úteis futuros, para a página calcular os livres.
 *
 * POST body (opcional): { dias?: number }  // default 14 dias corridos à frente
 * Resposta: { ocupados: string[] (ISO UTC), regras: {...} }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let dias = 14;
    try {
      const body = await req.json();
      if (body && Number.isFinite(Number(body.dias))) {
        dias = Math.min(60, Math.max(1, Number(body.dias)));
      }
    } catch (_e) {
      // sem body — usa default
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const agora = new Date();
    const fim = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("rh_entrevistas")
      .select("data_entrevista")
      .eq("status", "agendada")
      .gte("data_entrevista", agora.toISOString())
      .lte("data_entrevista", fim.toISOString());

    if (error) throw error;

    return new Response(
      JSON.stringify({
        ocupados: (data || []).map((r: any) => new Date(r.data_entrevista).toISOString()),
        regras: {
          dias_uteis: [1, 2, 3, 4, 5],
          inicio: "09:00",
          fim: "17:00",
          almoco: ["12:00", "13:00"],
          bloco_min: 30,
          timezone: "America/Sao_Paulo",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[rh-vaga-disponibilidade]", e);
    return new Response(JSON.stringify({ error: "Erro ao buscar disponibilidade" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
