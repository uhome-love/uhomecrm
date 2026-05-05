import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Determine current BRT time
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hours = brt.getHours();
  const minutes = brt.getMinutes();
  const brtTime = hours * 100 + minutes; // e.g. 1200, 1830, 2330
  const today = brt.toISOString().slice(0, 10);

  // Determine which janela just ended
  let closedJanela: string | null = null;
  // Cron runs at: 12:00 BRT (close manha), 18:00 BRT (close tarde), 23:30 BRT (close noturna)
  // We give a 5-min window tolerance
  if (brtTime >= 1155 && brtTime <= 1210) {
    closedJanela = "manha";
  } else if (brtTime >= 1755 && brtTime <= 1810) {
    closedJanela = "tarde";
  } else if (brtTime >= 2325 && brtTime <= 2340) {
    closedJanela = "noturna";
  }

  // Also handle dia_todo (Sunday/holiday) — close at 23:30
  const isSunday = brt.getDay() === 0;

  if (!closedJanela && !(isSunday && brtTime >= 2325)) {
    return new Response(
      JSON.stringify({ ok: true, message: "No shift to close at this time", brtTime }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const janelasToClose = isSunday && brtTime >= 2325
    ? ["dia_todo", "manha", "tarde", "noturna"]
    : [closedJanela!];

  console.log(`[shift-cleanup] Closing janelas: ${janelasToClose.join(", ")} for ${today}`);

  // 1. Deactivate all fila entries for the closed janela(s)
  const { data: deactivated, error: deactivateError } = await supabase
    .from("roleta_fila")
    .update({ ativo: false })
    .eq("data", today)
    .in("janela", janelasToClose)
    .eq("ativo", true)
    .select("corretor_id");

  if (deactivateError) {
    console.error("[shift-cleanup] Error deactivating fila:", deactivateError);
  }

  const deactivatedCount = deactivated?.length || 0;
  console.log(`[shift-cleanup] Deactivated ${deactivatedCount} fila entries`);

  // 2. Get unique corretor_ids that were deactivated
  const corretorIds = [...new Set((deactivated || []).map((d: any) => d.corretor_id))];

  // 3. For each, check if they still have ANY active fila entry today. If not, set na_roleta=false
  let naRoletaCleared = 0;
  for (const corretorId of corretorIds) {
    const { data: stillActive } = await supabase
      .from("roleta_fila")
      .select("id")
      .eq("data", today)
      .eq("corretor_id", corretorId)
      .eq("ativo", true)
      .limit(1);

    if (!stillActive?.length) {
      // No more active entries — clear na_roleta
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", corretorId)
        .single();

      if (profile?.user_id) {
        await supabase
          .from("corretor_disponibilidade")
          .update({ na_roleta: false })
          .eq("user_id", profile.user_id);
        naRoletaCleared++;
      }
    }
  }

  // 4. Update credenciamento status to "encerrado" for those janelas
  await supabase
    .from("roleta_credenciamentos")
    .update({ status: "encerrado", saiu_em: new Date().toISOString() })
    .eq("data", today)
    .in("janela", janelasToClose)
    .in("status", ["aprovado", "pendente"]);

  // 5. Log the operation
  await supabase.from("ops_events").insert({
    tipo: "shift_cleanup",
    modulo: "roleta",
    payload: {
      janelas_closed: janelasToClose,
      date: today,
      fila_deactivated: deactivatedCount,
      na_roleta_cleared: naRoletaCleared,
      brt_time: `${hours}:${String(minutes).padStart(2, "0")}`,
    },
  });

  const summary = {
    ok: true,
    janelas_closed: janelasToClose,
    fila_deactivated: deactivatedCount,
    na_roleta_cleared: naRoletaCleared,
  };

  console.log("[shift-cleanup] Done:", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
