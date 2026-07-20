// Fecha o dia da roleta: marca 'falta' em todos os credenciamentos aprovados
// sem presença validada. Idempotente. Chamado por pg_cron 22:00 BRT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = requireCronAuth(req);
  if (denied) return denied;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let data_alvo: string | null = null;
    try {
      const body = await req.json();
      if (body?.data) data_alvo = body.data;
    } catch (_) { /* body opcional */ }

    const { data, error } = await supabase.rpc("roleta_fechar_dia", {
      p_data: data_alvo,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, faltas_criadas: data ?? 0, data: data_alvo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[roleta-fechamento-dia]", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? "erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
