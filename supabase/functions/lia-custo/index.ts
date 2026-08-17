/**
 * lia-custo — soma o investimento real dos anúncios que trouxeram os leads da LIA.
 *
 * Cada lead carrega, no referral, o ID do anúncio que o originou (source_id, source_type='ad').
 * A função pega os anúncios distintos, puxa o gasto (spend) de cada um no Meta (mesmo token/
 * vault do meta-ads-sync) e devolve o total. O hub calcula custo por lead / qualificado /
 * apresentação agendada dividindo esse total pelas contagens do funil.
 *
 * Só responde a chamada autenticada (role 'authenticated'), pra não expor gasto pela anon key.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const GRAPH = "https://graph.facebook.com/v21.0";

const json = (o: unknown) =>
  new Response(JSON.stringify(o), { headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // exige usuário logado (bloqueia chamada só com a anon key pública)
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    try {
      const payload = JSON.parse(atob((jwt.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role !== "authenticated") return json({ ok: false, motivo: "nao_autenticado", investimento: 0 });
    } catch { return json({ ok: false, motivo: "nao_autenticado", investimento: 0 }); }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // token do Meta: mesmo caminho do meta-ads-sync (integration_settings + vault)
    const { data: settings } = await admin
      .from("integration_settings").select("key,value").eq("key", "meta_ads_access_token");
    let token = (settings?.[0]?.value as string | undefined) ?? "";
    if (token === "vault:meta_ads_access_token") {
      const { data: v } = await admin.rpc("get_meta_ads_token_internal");
      token = (v as string | null) || "";
    }
    if (!token) return json({ ok: false, motivo: "sem_token", investimento: 0 });

    // anúncios distintos que originaram os leads da LIA
    const { data: estados } = await admin.from("lia_estado").select("referral").limit(2000);
    const adIds = new Set<string>();
    for (const e of estados ?? []) {
      const r = (e as any).referral;
      if (r && typeof r === "object" && r.source_type === "ad" && r.source_id) adIds.add(String(r.source_id));
    }
    if (!adIds.size) return json({ ok: true, investimento: 0, anuncios: 0, anuncios_com_gasto: 0 });

    let investimento = 0;
    let comGasto = 0;
    for (const id of adIds) {
      try {
        const url = `${GRAPH}/${id}/insights?fields=spend&date_preset=maximum&access_token=${token}`;
        const r = await fetch(url);
        const d = await r.json();
        const spend = parseFloat(d?.data?.[0]?.spend ?? "0") || 0;
        investimento += spend;
        if (spend > 0) comGasto++;
      } catch (_e) { /* ignora um anúncio que falhar, soma o resto */ }
    }

    return json({
      ok: true,
      investimento: Math.round(investimento * 100) / 100,
      anuncios: adIds.size,
      anuncios_com_gasto: comGasto,
      atualizado_em: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, erro: String(e), investimento: 0 });
  }
});
