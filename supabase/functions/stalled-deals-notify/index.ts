import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

    // Get stalled deals (15+ days without stage change)
    const { data: stalledDeals } = await supabase
      .from("pipeline_leads")
      .select("id, nome, empreendimento, stage_changed_at, gerente_id")
      .lt("stage_changed_at", fifteenDaysAgo)
      .order("stage_changed_at", { ascending: true });

    if (!stalledDeals || stalledDeals.length === 0) {
      return new Response(JSON.stringify({ message: "No stalled deals" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group by gerente
    const byGerente = new Map<string, typeof stalledDeals>();
    for (const deal of stalledDeals) {
      if (!deal.gerente_id) continue;
      const list = byGerente.get(deal.gerente_id) || [];
      list.push(deal);
      byGerente.set(deal.gerente_id, list);
    }

    let notificationsCreated = 0;

    for (const [gerenteId, deals] of byGerente) {
      const top5 = deals.slice(0, 5);
      const listText = top5.map(d => `• ${d.nome}${d.empreendimento ? ` (${d.empreendimento})` : ""}`).join("\n");
      const extra = deals.length > 5 ? `\n... e mais ${deals.length - 5} negócios` : "";

      await supabase.from("notifications").insert({
        user_id: gerenteId,
        titulo: "🚨 Negócios parados há 15+ dias",
        mensagem: `${deals.length} negócios parados há mais de 15 dias precisam de ação.\n\n${listText}${extra}`,
        tipo: "negocios_parados",
        categoria: "pipeline",
        dados: { deal_ids: top5.map(d => d.id), total: deals.length },
      });
      notificationsCreated++;
    }

    return new Response(JSON.stringify({ success: true, notificationsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
