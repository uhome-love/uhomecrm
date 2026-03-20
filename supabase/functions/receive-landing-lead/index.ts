/**
 * receive-landing-lead — Public webhook for Lovable landing pages (other projects).
 * Any external landing page can POST leads here and they'll enter the pipeline + roleta.
 *
 * POST body:
 * {
 *   name: "Maria Santos",
 *   email: "maria@email.com",
 *   phone: "51988887777",
 *   empreendimento: "Casa Tua",       // optional, helps segmentation
 *   campaign_id: "3199",              // optional, resolved via jetimob_campaign_map
 *   source: "landing_melnick_day",    // identifies the landing page
 *   message: "Quero saber mais",
 *   utm_source: "instagram",
 *   utm_medium: "cpc",
 *   utm_campaign: "casa-tua-marco",
 *   secret: "<WEBHOOK_SECRET>"        // simple auth
 * }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Structured logger with trace support
function _emit(level: string, msg: string, traceId?: string, ctx?: Record<string, unknown>, err?: unknown) {
  const payload = { fn: "receive-landing-lead", level, msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() };
  level === "error" ? console.error(JSON.stringify(payload)) : level === "warn" ? console.warn(JSON.stringify(payload)) : console.info(JSON.stringify(payload));
}

function extractTraceId(req: Request): string {
  return req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

function makeLogger(traceId: string) {
  return {
    info: (msg: string, ctx?: Record<string, unknown>) => _emit("info", msg, traceId, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => _emit("warn", msg, traceId, ctx, err),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => _emit("error", msg, traceId, ctx, err),
  };
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

/** Retry distribute-lead call with exponential backoff */
async function distributeWithRetry(
  supabaseUrl: string, serviceKey: string, leadId: string, traceId: string,
  L: { warn: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => void },
  maxRetries = 2
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "x-trace-id": traceId,
        },
        body: JSON.stringify({ action: "distribute_single", pipeline_lead_id: leadId }),
      });
      if (resp.ok) return true;
      const body = await resp.text().catch(() => "");
      L.warn(`Distribute attempt ${attempt + 1} failed`, { leadId, status: resp.status, body: body.slice(0, 200) });
    } catch (err) {
      L.warn(`Distribute attempt ${attempt + 1} exception`, { leadId, attempt }, err);
    }
    if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const traceId = extractTraceId(req);
  const L = makeLogger(traceId);

  const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
    supabase.from("ops_events").insert({ fn: "receive-landing-lead", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
  };

  try {
    const body = await req.json();

    // ── Auth ──
    const webhookSecret = Deno.env.get("LANDING_WEBHOOK_SECRET");
    if (webhookSecret) {
      const provided = body.secret || req.headers.get("x-webhook-secret") || "";
      if (provided !== webhookSecret) {
        L.warn("Auth failed — invalid webhook secret", { source: body.source });
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Parse fields ──
    const name = body.name || body.nome || body.full_name || "";
    const email = body.email || "";
    const telefone = normalizePhone(body.phone || body.telefone || "");
    const source = body.source || body.origem || "Landing Page";
    const message = body.message || body.mensagem || "";
    const campaignId = body.campaign_id || "";
    let empreendimento = body.empreendimento || "";
    const utmSource = body.utm_source || "";
    const utmMedium = body.utm_medium || "";
    const utmCampaign = body.utm_campaign || "";

    if (!name && !telefone) {
      L.warn("Validation failed — missing name and phone", { source, body: { name: body.name, phone: body.phone } });
      return new Response(
        JSON.stringify({ error: "Nome ou telefone obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve empreendimento from campaign_id if not provided ──
    let segmentoFromMap: string | null = null;
    if (!empreendimento && campaignId) {
      const { data: mapRow } = await supabase
        .from("jetimob_campaign_map")
        .select("empreendimento, segmento")
        .eq("campaign_id", String(campaignId))
        .maybeSingle();
      if (mapRow) {
        empreendimento = mapRow.empreendimento;
        segmentoFromMap = mapRow.segmento;
      }
    }
    if (!empreendimento) {
      const isMelnick = source?.toLowerCase().includes("melnick_day") || source?.toLowerCase().includes("melnick-day");
      empreendimento = isMelnick ? "Melnick Day 2026" : "Avulso - Landing Page";
    }

    // ── Dedup by phone (including permanent registry) ──
    if (telefone) {
      // Check permanent dedup registry first
      const { data: alreadyProcessed } = await supabase
        .from("jetimob_processed")
        .select("jetimob_lead_id")
        .eq("telefone", telefone)
        .limit(1)
        .maybeSingle();

      const { data: existing } = await supabase
        .from("pipeline_leads")
        .select("id, corretor_id, nome, empreendimento")
        .eq("telefone", telefone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        if (!existing.corretor_id) {
          L.info("Dedup: pending distribution", { telefone, leadId: existing.id });
          return new Response(
            JSON.stringify({ success: true, action: "skipped_duplicate_pending", lead_id: existing.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const todayStamp = new Date().toISOString().slice(0, 10);
        const interestLabel = empreendimento || existing.empreendimento || "mesmo imóvel";

        await supabase.from("pipeline_leads").update({
          updated_at: new Date().toISOString(),
          observacoes: `[NOVO INTERESSE ${todayStamp}] ${interestLabel} (Landing Page)${message ? ` — "${message}"` : ""}`,
        }).eq("id", existing.id);

        await Promise.all([
          supabase.from("notifications").insert({
            user_id: existing.corretor_id,
            tipo: "lead",
            categoria: "lead_retorno",
            titulo: `🔄 Lead reativado! ${existing.nome || name}`,
            mensagem: `${existing.nome || name} demonstrou novo interesse em ${interestLabel} (Landing Page).`,
            dados: { pipeline_lead_id: existing.id, lead_nome: existing.nome || name, novo_empreendimento: interestLabel },
            agrupamento_key: `lead_retorno_${existing.id}_${todayStamp}`,
          }),
          supabase.from("pipeline_atividades").insert({
            pipeline_lead_id: existing.id,
            tipo: "entrada",
            titulo: `🔄 Novo interesse via Landing Page`,
            descricao: `Lead demonstrou novo interesse em ${interestLabel} (Landing Page).${message ? `\nMensagem: "${message}"` : ""}`,
            data: todayStamp,
            prioridade: "alta",
            status: "completed",
            created_by: existing.corretor_id,
          }),
        ]);

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: existing.corretor_id,
              title: "🔄 Lead reativado!",
              body: `${existing.nome || name} — ${interestLabel}`,
              url: `/pipeline-leads?lead=${existing.id}`,
            }),
          });
        } catch (e) { L.warn("Push error", {}, e); }

        L.info("Reactivated existing lead", { telefone, leadId: existing.id });
        return new Response(
          JSON.stringify({ success: true, action: "reactivated", lead_id: existing.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Skip if phone was ever processed before (permanent dedup)
      if (alreadyProcessed) {
        L.info("Dedup: permanent registry", { telefone });
        return new Response(
          JSON.stringify({ success: true, action: "skipped_permanent_dedup" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Resolve segmento ──
    let segmentoId: string | null = null;
    if (segmentoFromMap) {
      const { data: seg } = await supabase
        .from("pipeline_segmentos")
        .select("id")
        .ilike("nome", segmentoFromMap)
        .limit(1)
        .maybeSingle();
      if (seg) segmentoId = seg.id;
    }
    if (!segmentoId && empreendimento) {
      const { data: rc } = await supabase
        .from("roleta_campanhas")
        .select("segmento_id")
        .ilike("empreendimento", empreendimento)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (rc?.segmento_id) {
        const { data: rs } = await supabase
          .from("roleta_segmentos")
          .select("id, nome")
          .eq("id", rc.segmento_id)
          .maybeSingle();
        if (rs) {
          const { data: ps } = await supabase
            .from("pipeline_segmentos")
            .select("id")
            .ilike("nome", rs.nome)
            .limit(1)
            .maybeSingle();
          if (ps) segmentoId = ps.id;
        }
      }
    }

    // ── Stage ──
    const { data: stageData } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("tipo", "novo_lead")
      .eq("ativo", true)
      .limit(1)
      .single();

    if (!stageData) {
      return new Response(
        JSON.stringify({ error: "Estágio novo_lead não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Register in permanent dedup BEFORE insert (prevents race condition) ──
    if (telefone) {
      const dedupRegistryId = `landing-phone:${telefone}`;
      const { error: registryError } = await supabase
        .from("jetimob_processed")
        .upsert({ jetimob_lead_id: dedupRegistryId, telefone }, { onConflict: "jetimob_lead_id" });

      if (registryError) {
        if (registryError.code === "23505") {
          L.info("Dedup: race condition caught by registry", { dedupRegistryId, telefone });
          return new Response(
            JSON.stringify({ success: true, action: "skipped_race_dedup" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        L.warn("Registry upsert warn", { dedupRegistryId }, registryError);
      }
    }

    // ── Insert ──
    const origemDetalhe = [utmSource, utmMedium, utmCampaign].filter(Boolean).join(" / ") || source;

    const isMelnickDay = source?.toLowerCase().includes("melnick_day") || source?.toLowerCase().includes("melnick-day");
    const campanha = body.campaign_name || (isMelnickDay ? "Melnick Day - Landing Page" : source) || "Landing Page";
    const plataforma = body.platform || (isMelnickDay ? "Landing Page Melnick Day" : "Landing Page");

    const { data: insertedLead, error: insertError } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: name || "Lead Landing Page",
        telefone,
        email: email || null,
        empreendimento,
        segmento_id: segmentoId,
        stage_id: stageData.id,
        origem: "Landing Page",
        origem_detalhe: origemDetalhe,
        campanha,
        plataforma,
        observacoes: message || null,
        corretor_id: null,
        aceite_status: "pendente_distribuicao",
        prioridade_lead: "media",
      })
      .select("id")
      .single();

    if (insertError) {
      L.error("Lead insert failed", { name, telefone, empreendimento }, insertError);
      logOps("error", "system", "Lead insert failed", { name, telefone, empreendimento }, insertError.message);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    L.info("Lead created", { leadId: insertedLead.id, name, empreendimento, source });
    logOps("info", "business", "Lead created via Landing Page", { lead_id: insertedLead.id, name, empreendimento, source });

    // ── Auto-distribute (with retry + trace propagation) ──
    const distributed = await distributeWithRetry(supabaseUrl, serviceKey, insertedLead.id, traceId, L);
    if (!distributed) {
      logOps("error", "integration", "Distribution failed after retries — lead orphaned", { lead_id: insertedLead.id, name, empreendimento });
    }

    // ── Register entry activity ──
    const entryTitle = isMelnickDay
      ? `🏠 Lead gerado Landing Page Melnick Day`
      : `🟢 Lead gerado via Landing Page — ${empreendimento}`;
    const entryDesc = [
      isMelnickDay ? "Lead recebido via Landing Page Melnick Day" : `Lead recebido via Landing Page`,
      empreendimento ? `Empreendimento: ${empreendimento}` : null,
      message ? `Mensagem: ${message}` : null,
      email ? `E-mail: ${email}` : null,
      telefone ? `Telefone: ${telefone}` : null,
      source ? `Origem: ${source}` : null,
    ].filter(Boolean).join("\n");

    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: insertedLead.id,
      tipo: "entrada",
      titulo: entryTitle,
      descricao: entryDesc,
      status: "concluida",
      created_by: "00000000-0000-0000-0000-000000000000",
    }).then(r => { if (r.error) L.warn("Entry activity insert failed", {}, r.error); });

    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      modulo: "pipeline",
      acao: "landing_page_lead",
      descricao: `Lead via Landing Page: ${name} — ${empreendimento} (source: ${source})`,
      origem: "webhook",
      request_id: traceId,
    }).then(r => { if (r.error) L.warn("Audit insert failed", {}, r.error); });

    return new Response(
      JSON.stringify({ success: true, lead_id: insertedLead.id, empreendimento, distributed, trace_id: traceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    L.error("Unhandled exception", {}, err);
    logOps("error", "system", "Unhandled exception", {}, err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
