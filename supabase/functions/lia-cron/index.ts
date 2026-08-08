/**
 * lia-cron — rede de segurança da captura da Lia.
 *
 * Roda a cada minuto: consulta os formulários da campanha da Lia na Graph API
 * e cria em ia_leads o que o webhook do Meta tiver perdido. Idempotente por
 * meta_lead_id (índice único em ia_leads) — reprocessar não duplica.
 *
 * Não envia mensagem nenhuma. Envio é Fase 2 e depende de
 * ia_config.enviar_habilitado.
 *
 * Auth: header `x-lia-cron-secret` igual a LIA_CRON_SECRET (segredo próprio,
 * separado do CAPI, para manter raio de dano isolado) ou Bearer service role.
 *
 * Ação auxiliar `?action=evolution_version`: devolve a versão do servidor
 * Evolution, usada para decidir o esquema de segredo do lia-webhook.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { capturarLeadLia } from "../_shared/liaCapture.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lia-cron-secret",
};

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const JANELA_MINUTOS = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function auth(req: Request): boolean {
  const secret = Deno.env.get("LIA_CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const provided = req.headers.get("x-lia-cron-secret");
  if (secret && provided && provided === secret) return true;
  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  return !!serviceKey && bearer === serviceKey;
}

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) throw new Error(`Meta ${path}: ${JSON.stringify(body.error || body)}`);
  return body;
}

function fieldValue(fd: Array<{ name: string; values: string[] }>, ...names: string[]): string {
  for (const n of names) {
    const f = fd.find((x) => (x.name || "").toLowerCase().includes(n));
    if (f?.values?.[0]) return String(f.values[0]).trim();
  }
  return "";
}

function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!auth(req)) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const action = new URL(req.url).searchParams.get("action") || "poll";

  // ── Sonda de versão do Evolution (decide o esquema de segredo) ──
  if (action === "evolution_version") {
    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evoUrl || !evoKey) return json({ error: "evolution env ausente" }, 500);
    const r = await fetch(`${evoUrl}/`, { headers: { apikey: evoKey } });
    const body = await r.text();
    return json({ status: r.status, body: body.slice(0, 500) });
  }

  try {
    const { data: cfg } = await supabase
      .from("ia_config")
      .select("captura_lia")
      .limit(1)
      .maybeSingle();

    const formIds: string[] = ((cfg?.captura_lia as Record<string, string[]> | null)?.form_ids || []).map(String);
    if (formIds.length === 0) {
      return json({ ok: true, skipped: "captura_lia_vazia" });
    }

    const token = Deno.env.get("META_GRAPH_API_TOKEN");
    if (!token) return json({ error: "META_GRAPH_API_TOKEN ausente" }, 500);

    const sinceUnix = Math.floor(Date.now() / 1000) - JANELA_MINUTOS * 60;
    const fields = "id,created_time,campaign_id,campaign_name,adset_id,ad_id,form_id,field_data";

    let vistos = 0;
    let criados = 0;
    const erros: string[] = [];

    for (const formId of formIds) {
      try {
        const resp = await metaGet(`${formId}/leads`, token, {
          fields,
          limit: "100",
          filtering: JSON.stringify([
            { field: "time_created", operator: "GREATER_THAN", value: String(sinceUnix) },
          ]),
        });

        for (const lead of resp.data || []) {
          vistos++;
          const fd = lead.field_data || [];
          const telefone = normalizePhone(fieldValue(fd, "phone", "telefone", "celular"));
          if (!telefone) continue;

          const res = await capturarLeadLia(supabase, {
            nome: fieldValue(fd, "full_name", "nome", "name") || null,
            email: fieldValue(fd, "email", "e-mail") || null,
            telefone,
            meta_lead_id: String(lead.id),
            campaign_id: lead.campaign_id || null,
            form_id: lead.form_id || formId,
            adset_id: lead.adset_id || null,
            ad_id: lead.ad_id || null,
            origem: "meta_lia_poll",
            payload_bruto: lead,
          });
          if (res.capturado && res.motivo !== "ja_capturado") criados++;
        }
      } catch (e) {
        erros.push(`${formId}: ${(e as Error).message}`);
      }
    }

    if (criados > 0 || erros.length > 0) {
      await supabase.from("ops_events").insert({
        fn: "lia-cron",
        level: erros.length ? "warn" : "info",
        category: "business",
        message: "lia_poll_meta",
        ctx: { vistos, criados, erros } as never,
      });
    }

    return json({ ok: true, vistos, criados, erros });
  } catch (e) {
    console.error("lia-cron error:", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
