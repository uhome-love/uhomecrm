// capi-health-alert — vigilância do rastreamento de conversão (Meta CAPI).
//
// Roda de hora em hora e dispara alertas, todos com notificação in-app
// (o push sai automático via trigger trg_push_on_notification):
//
//   1. Evento silencioso — evento que vinha chegando e ficou >6h sem chegar.
//      (Venda NÃO entra aqui: é vigiado por realidade, na regra 4.)
//   2. Campanha gastando sem lead — campanha com gasto hoje e zero lead em 6h.
//   3. Guarda barrando lead recente — bloqueios de lead criado nos últimos
//      7 dias e de origem Meta acima de 3 em 24h (isso é bug de ingestão;
//      lead antigo barrado é o comportamento esperado e fica silencioso).
//      Linhas sintéticas do autoteste (ctx.selftest = true) são ignoradas.
//   4. Venda sem evento — ganho elegível (lead com meta_lead_id) nos últimos
//      7 dias sem evento Venda correspondente, com tolerância de 6h de fila.
//   5. Autoteste da guarda — 1x por dia prova que a guarda ainda barra.
//
// Auth: requireCronAuth (x-cron-secret ou bearer = service role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireCronAuth } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Venda fica fora: silêncio de 6h em venda é normal. Ver regra 4.
const EVENTOS_ESCADA = [
  "LeadQualificado",
  "VisitaMarcada",
  "VisitaRealizada",
];

const SILENCIO_HORAS = 6;
const DEDUP_HORAS = 24;
const GASTO_MINIMO_BRL = 20;
const GUARDA_LIMITE_24H = 3;
// Evento so e considerado "silencioso" se tinha cadencia real antes (>=10 em 7 dias).
const MIN_EVENTOS_7D = 10;
const AD_ACCOUNT = "act_901395618608094";

const ORIGENS_META = ["ig", "fb", "meta_ads", "meta_backfill", "facebook leads ads"];


function horaBRT(): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // Aceita o mesmo segredo do meta-capi-dispatch (CAPI_CRON_SECRET) ou o padrão de cron.
  const capiSecret = Deno.env.get("CAPI_CRON_SECRET");
  const enviado = req.headers.get("x-cron-secret");
  if (!(capiSecret && enviado && enviado === capiSecret)) {
    const denied = requireCronAuth(req);
    if (denied) return denied;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const disparados: string[] = [];

  const notificarAdmins = async (
    dedupKey: string,
    titulo: string,
    mensagem: string,
    ctx: Record<string, unknown>,
  ): Promise<boolean> => {
    const desde = new Date(Date.now() - DEDUP_HORAS * 3600_000).toISOString();
    const { data: anterior } = await supabase
      .from("ops_events")
      .select("id")
      .eq("fn", "capi-health-alert")
      .eq("category", "alert")
      .eq("message", dedupKey)
      .gte("created_at", desde)
      .limit(1);
    if ((anterior ?? []).length > 0) return false;

    const { data: adminRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const admins = adminRows ?? [];

    if (admins.length > 0) {
      await supabase.from("notifications").insert(
        admins.map((a: { user_id: string }) => ({
          user_id: a.user_id,
          tipo: "sistema",
          categoria: "sla_urgente",
          titulo,
          mensagem,
          dados: { ...ctx, link: "/admin/ingestao" },
          lida: false,
        })),
      );
    }

    await supabase.from("ops_events").insert({
      fn: "capi-health-alert",
      level: "error",
      category: "alert",
      message: dedupKey,
      ctx: { ...ctx, admins_notified: admins.length },
    });
    return true;
  };

  try {
    const agora = Date.now();
    const corteSilencio = new Date(agora - SILENCIO_HORAS * 3600_000).toISOString();
    const corte7d = new Date(agora - 7 * 24 * 3600_000).toISOString();

    // ── 1. Evento silencioso ────────────────────────────────────────────
    for (const evento of EVENTOS_ESCADA) {
      const { count: recentes } = await supabase
        .from("meta_capi_queue")
        .select("event_id", { count: "exact", head: true })
        .eq("event_name", evento)
        .gte("created_at", corteSilencio);
      if ((recentes ?? 0) > 0) continue;

      const { count: anteriores } = await supabase
        .from("meta_capi_queue")
        .select("event_id", { count: "exact", head: true })
        .eq("event_name", evento)
        .gte("created_at", corte7d)
        .lt("created_at", corteSilencio);
      if ((anteriores ?? 0) < MIN_EVENTOS_7D) continue; // sem cadência: silêncio é normal

      const ok = await notificarAdmins(
        `capi_evento_silencioso:${evento}`,
        `🚨 Evento ${evento} parou de chegar`,
        `Nenhum ${evento} nas últimas ${SILENCIO_HORAS}h, sendo que ` +
          `${anteriores} foram registrados nos 7 dias anteriores. ` +
          `Abra /admin/ingestao para investigar.`,
        {
          rule: "capi_evento_silencioso",
          event_name: evento,
          eventos_7d: anteriores,
          horas_sem_evento: SILENCIO_HORAS,
        },
      );
      if (ok) disparados.push(`silencioso:${evento}`);
    }

    // ── 2. Campanha gastando sem lead ───────────────────────────────────
    const hora = horaBRT();
    const token = Deno.env.get("META_GRAPH_API_TOKEN");
    if (token && hora >= 9 && hora < 20) {
      try {
        const url =
          `https://graph.facebook.com/v21.0/${AD_ACCOUNT}/insights` +
          `?level=campaign&fields=campaign_id,campaign_name,spend` +
          `&date_preset=today&limit=200&access_token=${token}`;
        const resp = await fetch(url);
        const body = await resp.json();
        const linhas: { campaign_id: string; campaign_name: string; spend: string }[] =
          body?.data ?? [];

        for (const linha of linhas) {
          const gasto = Number(linha.spend || 0);
          if (gasto < GASTO_MINIMO_BRL) continue;

          const { count: leads } = await supabase
            .from("pipeline_leads")
            .select("id", { count: "exact", head: true })
            .eq("campanha_id", linha.campaign_id)
            .gte("created_at", corteSilencio);
          if ((leads ?? 0) > 0) continue;

          const ok = await notificarAdmins(
            `capi_campanha_sem_lead:${linha.campaign_id}`,
            `🚨 Campanha gastando sem lead: ${linha.campaign_name}`,
            `A campanha "${linha.campaign_name}" gastou R$ ${gasto.toFixed(2)} hoje ` +
              `e não entrou nenhum lead nas últimas ${SILENCIO_HORAS}h. ` +
              `Pode ser webhook ou formulário quebrado.`,
            {
              rule: "capi_campanha_sem_lead",
              campaign_id: linha.campaign_id,
              campaign_name: linha.campaign_name,
              spend_hoje: gasto,
            },
          );
          if (ok) disparados.push(`campanha:${linha.campaign_id}`);
        }
      } catch (e) {
        console.error("[capi-health-alert] insights falhou", e);
      }
    }

    // ── 3. Guarda barrando lead recente de origem Meta ──────────────────
    const corte24h = new Date(agora - 24 * 3600_000).toISOString();
    const { data: bloqueios } = await supabase
      .from("ops_events")
      .select("ctx,created_at")
      .eq("category", "capi_bloqueado_sem_lead_id")
      .gte("created_at", corte24h)
      .limit(2000);

    // Linhas sintéticas do autoteste NUNCA entram em contador nem em alerta.
    const bloqueiosReais = (bloqueios ?? []).filter(
      (b: { ctx: Record<string, unknown> | null }) =>
        String((b.ctx ?? {}).selftest ?? "") !== "true",
    );

    const recentesMeta = bloqueiosReais.filter((b: { ctx: Record<string, unknown> | null }) => {
      const ctx = b.ctx ?? {};
      const origem = String(ctx.origem ?? "").toLowerCase();
      const criado = ctx.lead_created_at ? new Date(String(ctx.lead_created_at)).getTime() : 0;
      const ehMeta = ORIGENS_META.some((o) => origem === o || origem.includes(o));
      return ehMeta && criado > agora - 7 * 24 * 3600_000;
    });

    if (recentesMeta.length > GUARDA_LIMITE_24H) {
      const ok = await notificarAdmins(
        "capi_guarda_lead_recente",
        "🚨 Conversão barrada em lead novo do Meta",
        `${recentesMeta.length} lead(s) criados nos últimos 7 dias e de origem Meta ` +
          `tiveram a conversão barrada por falta do identificador do anúncio nas últimas 24h. ` +
          `Lead antigo barrado é esperado; lead novo é bug de ingestão.`,
        {
          rule: "capi_guarda_lead_recente",
          bloqueios_24h: recentesMeta.length,
          amostras: recentesMeta.slice(0, 3).map((b) => b.ctx),
        },
      );
      if (ok) disparados.push("guarda_lead_recente");
    }

    // ── 4. Venda vigiada por realidade (ganho elegível x evento enviado) ──
    let cobertura: Record<string, unknown> | null = null;
    try {
      const { data: cob } = await supabase.rpc("capi_venda_cobertura_7d");
      cobertura = (cob ?? null) as Record<string, unknown> | null;
      const maduros = Number(cobertura?.ganhos_elegiveis_maduros ?? 0);
      const semEvento = (cobertura?.sem_evento ?? []) as Record<string, unknown>[];

      if (maduros > 0 && semEvento.length > 0) {
        // Se algum desses leads foi barrado pela guarda, o alerta diz isso.
        const { data: barrados } = await supabase
          .from("ops_events")
          .select("ctx")
          .eq("category", "capi_bloqueado_sem_lead_id")
          .gte("created_at", corte7d)
          .limit(500);
        const barradosVenda = (barrados ?? []).filter(
          (b: { ctx: Record<string, unknown> | null }) =>
            String((b.ctx ?? {}).selftest ?? "") !== "true" &&
            String((b.ctx ?? {}).event_name ?? "") === "Venda",
        ).length;

        const nomes = semEvento
          .slice(0, 5)
          .map((n) => String(n.cliente ?? n.negocio_id))
          .join(", ");

        const ok = await notificarAdmins(
          "capi_venda_sem_evento",
          "🚨 Venda no CRM sem conversão enviada",
          `${semEvento.length} de ${maduros} venda(s) elegível(is) dos últimos 7 dias ` +
            `não têm evento Venda enviado ao Meta: ${nomes}. ` +
            (barradosVenda > 0
              ? `${barradosVenda} evento(s) de Venda foram barrados por falta do identificador do anúncio — corrija a ingestão.`
              : `Verifique o gatilho de Venda.`),
          {
            rule: "capi_venda_sem_evento",
            ganhos_total: cobertura?.ganhos_total ?? null,
            ganhos_elegiveis: cobertura?.ganhos_elegiveis ?? null,
            ganhos_elegiveis_maduros: maduros,
            eventos_venda_7d: cobertura?.eventos_venda_7d ?? null,
            sem_evento: semEvento.slice(0, 10),
            barrados_venda_7d: barradosVenda,
          },
        );
        if (ok) disparados.push("venda_sem_evento");
      }
    } catch (e) {
      console.error("[capi-health-alert] cobertura de venda falhou", e);
    }

    // ── 5. Autoteste da guarda (1x por dia) ─────────────────────────────
    let selftest: Record<string, unknown> | null = null;
    const { data: testeHoje } = await supabase
      .from("ops_events")
      .select("id")
      .eq("fn", "capi_guarda_selftest")
      .gte("created_at", new Date(agora - 24 * 3600_000).toISOString())
      .limit(1);

    if ((testeHoje ?? []).length === 0) {
      const { data: res, error: errSelf } = await supabase.rpc("capi_guarda_selftest");
      selftest = (res ?? null) as Record<string, unknown> | null;
      if (errSelf) console.error("[capi-health-alert] selftest erro", errSelf.message);
      if (String(selftest?.resultado ?? "") === "falhou") {
        const ok = await notificarAdmins(
          "capi_guarda_falhou",
          "🚨 A guarda do rastreamento parou de barrar",
          `O autoteste diário enviou um evento de teste em um lead sem identificador de anúncio ` +
            `e ele NÃO foi barrado. Conversões inválidas podem estar indo ao Meta.`,
          { rule: "capi_guarda_falhou", ...(selftest ?? {}) },
        );
        if (ok) disparados.push("guarda_falhou");
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        disparados,
        bloqueios_recentes_meta_24h: recentesMeta.length,
        bloqueios_total_24h: bloqueiosReais.length,
        cobertura_venda: cobertura,
        selftest,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[capi-health-alert] error", msg);
    await supabase.from("ops_events").insert({
      fn: "capi-health-alert",
      level: "error",
      category: "system",
      message: `capi-health-alert run failed: ${msg}`,
      ctx: { error: msg },
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
