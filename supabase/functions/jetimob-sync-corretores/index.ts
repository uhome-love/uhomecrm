// Sync corretores Jetimob → tabela jetimob_corretores
// Trigger: manual ou cron diário
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
    if (!JETIMOB_API_KEY) throw new Error("JETIMOB_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    let all: any[] = [];
    const pageSize = 100;
    for (let page = 1; page <= 50; page++) {
      const url = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/corretores?v=6&page=${page}&pageSize=${pageSize}`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) {
        console.warn(`page ${page} failed: ${r.status}`);
        break;
      }
      const raw = await r.json();
      const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
      if (!items.length) break;
      all = all.concat(items);
      const totalPages = Number(raw?.totalPages || 0);
      if (totalPages > 0 && page >= totalPages) break;
      if (items.length < pageSize) break;
    }

    const rows = all
      .filter((c: any) => c?.id)
      .map((c: any) => ({
        id_jetimob: Number(c.id),
        nome: String(c.nome || "—"),
        email: c.email || null,
        telefone: c.telefone || null,
        telefone2: c.telefone2 || null,
        whatsapp: !!c.telefone_whatsapp,
        cargo: c.cargo || null,
        creci: c.creci || null,
        equipe: c.equipes || null,
        cidade: c.cidade || null,
        estado: c.estado || null,
        avatar_url: c.avatar || null,
        mostrar_site: c.mostrar_site ?? true,
        payload: c,
        synced_at: new Date().toISOString(),
      }));

    let upserted = 0;
    if (rows.length) {
      const { error } = await supabase
        .from("jetimob_corretores")
        .upsert(rows, { onConflict: "id_jetimob" });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
      upserted = rows.length;
    }

    return new Response(
      JSON.stringify({ success: true, total: all.length, upserted, duracao_ms: Date.now() - t0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[jetimob-sync-corretores] FAIL:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
