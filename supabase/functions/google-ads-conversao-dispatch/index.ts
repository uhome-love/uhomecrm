// Envia ao Google Ads a conversão "Visita realizada (CRM)" para leads com gclid.
// Fila: google_ads_conversoes (1 por lead, preenchida por trigger em visitas).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CUSTOMER_ID = "1041226095";
const CONVERSION_ACTION_ID = "7903119344";
const GATEWAY = "https://connector-gateway.lovable.dev/google_ads";

/** timestamptz → "yyyy-mm-ddThh:mm:ss-03:00" em BRT (RFC 3339) */
export function formatarDataBRT(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}-03:00`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  // Apenas agendamento (x-cron-secret, mesmo segredo do CAPI), service role ou admin
  const cronSecret = Deno.env.get("CAPI_CRON_SECRET");
  const porCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (!porCron && auth !== `Bearer ${serviceKey}`) {
    const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const adsKey = Deno.env.get("GOOGLE_ADS_API_KEY");
  if (!lovableKey || !adsKey) return json({ error: "credenciais ausentes" }, 500);

  let validateOnly = false;
  try { validateOnly = (await req.json())?.validate_only === true; } catch { /* sem body */ }

  const { data: fila, error } = await sb.from("google_ads_conversoes")
    .select("id, pipeline_lead_id, visita_id, gclid, conversao_em, valor, tentativas")
    .eq("status", "pendente").lt("tentativas", 5).order("created_at").limit(50);
  if (error) return json({ error: error.message }, 500);

  const resultados: unknown[] = [];
  for (const item of fila ?? []) {
    // Google exige a Data Manager API para novas integrações de conversão offline.
    const body = {
      destinations: [{ operatingAccount: { accountType: "GOOGLE_ADS", accountId: CUSTOMER_ID }, productDestinationId: CONVERSION_ACTION_ID }],
      events: [{
        transactionId: `visita-${item.pipeline_lead_id}`,
        eventTimestamp: formatarDataBRT(item.conversao_em),
        eventSource: "OTHER",
        adIdentifiers: { gclid: item.gclid },
        conversionValue: Number(item.valor),
        currency: "BRL",
      }],
      validateOnly,
    };
    const resp = await fetch(`${GATEWAY}/datamanager/v1/events:ingest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": adsKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const texto = await resp.text();
    let parsed: any = texto; try { parsed = JSON.parse(texto); } catch { /* texto */ }
    const falha = !resp.ok;
    const motivo = falha ? (parsed?.error?.message ?? `HTTP ${resp.status}`) : null;
    resultados.push({ id: item.id, ok: !falha, motivo, validateOnly });
    if (validateOnly) continue;

    const tentativas = item.tentativas + 1;
    const recusado = falha && ((resp.status >= 400 && resp.status < 500 && resp.status !== 429) || tentativas >= 5); // recusa do Google não se resolve sozinha
    await sb.from("google_ads_conversoes").update({
      status: !falha ? "enviado" : recusado ? "erro" : "pendente",
      tentativas, resposta: parsed, enviado_em: !falha ? new Date().toISOString() : null,
    }).eq("id", item.id);

    if (!falha || recusado) {
      const { data: lead } = await sb.from("pipeline_leads").select("corretor_id").eq("id", item.pipeline_lead_id).maybeSingle();
      let autor = lead?.corretor_id ?? null;
      if (!autor && item.visita_id) {
        const { data: v } = await sb.from("visitas").select("corretor_id").eq("id", item.visita_id).maybeSingle();
        autor = v?.corretor_id ?? null;
      }
      if (autor) {
        await sb.from("pipeline_anotacoes").insert({
          pipeline_lead_id: item.pipeline_lead_id, autor_id: autor, autor_nome: "Google Ads", fixada: false,
          conteudo: !falha ? "📈 Conversão de visita enviada ao Google Ads" : `⚠️ Google Ads recusou a conversão de visita: ${motivo}`,
        });
      }
      if (falha) {
        await sb.from("ops_events").insert({ fn: "google-ads-conversao-dispatch", level: "error", category: "integration",
          message: "Google Ads recusou conversão", ctx: { lead_id: item.pipeline_lead_id }, error_detail: String(motivo) });
      }
    }
  }
  return json({ processados: resultados.length, resultados });
});
