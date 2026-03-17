/**
 * receive-rdstation-lead — Public webhook for RD Station Marketing conversions.
 * Receives leads from RD Station webhook integrations (conversões, oportunidades).
 * Applies dedup (phone), resolves empreendimento, and distributes through the roleta.
 *
 * RD Station webhook payload format:
 * { leads: [{ id, email, name, personal_phone, mobile_phone, job_title, tags, 
 *   first_conversion: { content: { ... }, source, ... },
 *   last_conversion: { content: { ... }, source, ... } }] }
 *
 * Also supports flat format for flexibility:
 * { name, email, phone, empreendimento, ... }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

function extractStr(val: any): string {
  if (typeof val === "string" && val.trim()) return val.trim();
  if (Array.isArray(val) && val.length > 0 && val[0]) return String(val[0]).trim();
  return "";
}

function normalizeLower(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

function isLikelyTestLead(name: string, email: string): boolean {
  const combined = `${normalizeLower(name)} ${normalizeLower(email)}`;
  if (combined.includes("test@") || combined.includes("teste@")) return true;
  if (combined.includes("lead teste") || combined.includes("dummy")) return true;
  return false;
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
  const traceId = req.headers.get("x-trace-id") || `rd-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

  const L = {
    info: (msg: string, ctx?: Record<string, unknown>) => console.info(JSON.stringify({ fn: "receive-rdstation-lead", level: "info", msg, traceId, ctx, ts: new Date().toISOString() })),
    warn: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => console.warn(JSON.stringify({ fn: "receive-rdstation-lead", level: "warn", msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : undefined, ts: new Date().toISOString() })),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => console.error(JSON.stringify({ fn: "receive-rdstation-lead", level: "error", msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() })),
  };

  const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
    supabase.from("ops_events").insert({ fn: "receive-rdstation-lead", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
  };

  try {
    const body = await req.json();
    L.info("Raw body received", { hasLeads: !!body.leads, keys: Object.keys(body).slice(0, 10) });

    // ── Auth: validate RD Station private token if configured ──
    const rdPrivateToken = Deno.env.get("RDSTATION_PRIVATE_TOKEN");
    if (rdPrivateToken) {
      const provided = req.headers.get("x-webhook-secret") || body.secret || body.token || "";
      // RD Station doesn't send auth by default — skip validation if not provided
      // The private token is mainly used for API calls TO RD Station
    }

    // ── Parse leads: RD Station sends { leads: [...] } or we accept flat format ──
    const leads: any[] = [];

    if (body.leads && Array.isArray(body.leads)) {
      // Native RD Station webhook format
      leads.push(...body.leads);
    } else if (body.email || body.phone || body.telefone || body.nome || body.name) {
      // Flat format (Zapier, Make.com, custom)
      leads.push(body);
    } else {
      L.warn("Unknown payload format", { keys: Object.keys(body) });
      return new Response(
        JSON.stringify({ error: "Formato não reconhecido. Esperado: { leads: [...] } ou campos flat" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const lead of leads) {
      try {
        const result = await processLead(lead, supabase, supabaseUrl, serviceKey, traceId, L, logOps);
        results.push(result);
      } catch (err) {
        L.error("Error processing lead", { lead_email: lead.email }, err);
        results.push({ success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results, trace_id: traceId }),
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

async function processLead(
  lead: any, supabase: any, supabaseUrl: string, serviceKey: string,
  traceId: string,
  L: { info: Function; warn: Function; error: Function },
  logOps: Function
) {
  // ── Debug: log all lead keys to find phone field ──
  L.info("Lead raw keys", { keys: Object.keys(lead), sample: JSON.stringify(lead).slice(0, 1500) });

  // ── Extract fields from RD Station lead format ──
  // RD Station may send phone in custom_fields or cf_ prefixed fields
  const customFields = lead.custom_fields || {};
  const cfPhone = customFields.Telefone || customFields.telefone || customFields.Celular || customFields.celular || customFields.Phone || customFields.phone || "";
  
  const name = lead.name || lead.nome || lead.full_name || "";
  const email = lead.email || "";
  const phone = lead.personal_phone || lead.mobile_phone || lead.phone || lead.telefone || lead.celular || cfPhone || "";
  const rdLeadId = lead.id || lead.rd_lead_id || "";
  const tags = lead.tags || [];
  const jobTitle = lead.job_title || "";

  // Extract conversion info
  const lastConversion = lead.last_conversion || {};
  const firstConversion = lead.first_conversion || {};
  const conversionContent = lastConversion.content || firstConversion.content || {};

  // Try to extract empreendimento from various RD Station fields
  let empreendimento = lead.empreendimento 
    || lead.company 
    || conversionContent.identificador 
    || conversionContent.empreendimento
    || lastConversion.conversion_identifier
    || firstConversion.conversion_identifier
    || "";

  // Extract campaign info
  const campaignName = lead.campaign_name || lead.campanha 
    || conversionContent.campanha 
    || conversionContent.campaign 
    || "";

  // Custom fields from RD Station (cf_xxx)
  const customFields = lead.custom_fields || {};
  if (!empreendimento && customFields.cf_empreendimento) {
    empreendimento = customFields.cf_empreendimento;
  }
  if (!empreendimento && customFields.cf_imovel) {
    empreendimento = customFields.cf_imovel;
  }

  // Message/observations
  const message = lead.message || lead.mensagem || conversionContent.mensagem || conversionContent.message || "";

  const telefone = normalizePhone(phone);
  const isTest = isLikelyTestLead(name, email);

  L.info("Parsed RD lead", { name, email, telefone, rdLeadId, empreendimento, tags, isTest });

  if (isTest) {
    L.info("Ignored test lead", { name, email });
    return { action: "ignored_test", name };
  }

  if (!telefone) {
    L.warn("Missing phone", { name, email, rdLeadId });
    return { action: "ignored_missing_phone", name, email };
  }

  // ── Resolve empreendimento via roleta_campanhas if available ──
  if (empreendimento) {
    const { data: rc } = await supabase
      .from("roleta_campanhas")
      .select("empreendimento")
      .ilike("empreendimento", `%${empreendimento}%`)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    if (rc) empreendimento = rc.empreendimento;
  }

  if (!empreendimento) {
    // Try campaign name
    if (campaignName) {
      const { data: rc } = await supabase
        .from("roleta_campanhas")
        .select("empreendimento")
        .ilike("empreendimento", `%${campaignName}%`)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (rc) empreendimento = rc.empreendimento;
      else empreendimento = campaignName;
    }
  }

  if (!empreendimento) empreendimento = "Avulso - RD Station";

  // ── Dedup: check by phone ──
  const dedupRegistryId = rdLeadId ? `rd:${rdLeadId}` : `rd-phone:${telefone}`;

  if (rdLeadId) {
    const { data: existingExternal } = await supabase
      .from("jetimob_processed")
      .select("jetimob_lead_id")
      .eq("jetimob_lead_id", `rd:${rdLeadId}`)
      .maybeSingle();

    if (existingExternal) {
      L.info("Dedup: RD lead id already processed", { rdLeadId });
      return { action: "skipped_external_dedup", rdLeadId };
    }
  }

  const { data: existing } = await supabase
    .from("pipeline_leads")
    .select("id, corretor_id, nome, empreendimento, aceite_status")
    .eq("telefone", telefone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (!existing.corretor_id) {
      L.info("Dedup: pending distribution", { telefone, leadId: existing.id });
      return { action: "skipped_duplicate_pending", lead_id: existing.id };
    }

    // Lead exists with corretor — reactivate
    const todayStamp = new Date().toISOString().slice(0, 10);
    const interestLabel = empreendimento || existing.empreendimento || "mesmo imóvel";

    await supabase.from("pipeline_leads").update({
      updated_at: new Date().toISOString(),
      observacoes: `[NOVO INTERESSE ${todayStamp}] ${interestLabel} (RD Station)${message ? ` — "${message}"` : ""}`,
    }).eq("id", existing.id);

    await supabase.from("notifications").insert({
      user_id: existing.corretor_id,
      tipo: "lead",
      categoria: "lead_retorno",
      titulo: `🔄 Lead reativado! ${existing.nome || name}`,
      mensagem: `${existing.nome || name} demonstrou novo interesse em ${interestLabel} (RD Station).`,
      dados: { pipeline_lead_id: existing.id, lead_nome: existing.nome || name, novo_empreendimento: interestLabel },
      agrupamento_key: `lead_retorno_${existing.id}_${todayStamp}`,
    });

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
    } catch (e) { L.warn("Push error", { leadId: existing.id }, e); }

    L.info("Reactivated existing lead", { telefone, leadId: existing.id });
    return { action: "reactivated", lead_id: existing.id };
  }

  // Check permanent dedup registry
  const { data: alreadyProcessed } = await supabase
    .from("jetimob_processed")
    .select("jetimob_lead_id")
    .eq("telefone", telefone)
    .limit(1)
    .maybeSingle();

  if (alreadyProcessed) {
    L.info("Dedup: permanent registry", { telefone });
    return { action: "skipped_permanent_dedup" };
  }

  // ── Resolve segmento ──
  let segmentoId: string | null = null;
  if (empreendimento) {
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

  // ── Get novo_lead stage ──
  const { data: stageData } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("tipo", "novo_lead")
    .eq("ativo", true)
    .limit(1)
    .single();

  if (!stageData) {
    return { action: "error", error: "Estágio novo_lead não configurado" };
  }

  // Build observacoes
  const obsLines: string[] = [];
  if (message) obsLines.push(message);
  if (tags.length > 0) obsLines.push(`Tags: ${tags.join(", ")}`);
  if (jobTitle) obsLines.push(`Cargo: ${jobTitle}`);
  const obsText = obsLines.length > 0 ? obsLines.join(" | ") : null;

  // ── Register in permanent dedup BEFORE insert ──
  const { error: registryError } = await supabase
    .from("jetimob_processed")
    .upsert(
      { jetimob_lead_id: dedupRegistryId, telefone },
      { onConflict: "jetimob_lead_id" }
    );

  if (registryError) {
    if (registryError.code === "23505") {
      L.info("Dedup: race condition caught", { dedupRegistryId, telefone });
      return { action: "skipped_race_dedup" };
    }
    L.warn("Registry upsert warn", { dedupRegistryId }, registryError);
  }

  // ── Insert lead ──
  const { data: insertedLead, error: insertError } = await supabase
    .from("pipeline_leads")
    .insert({
      nome: name || "Lead RD Station",
      telefone,
      email: email || null,
      empreendimento,
      segmento_id: segmentoId,
      stage_id: stageData.id,
      origem: "rdstation",
      origem_detalhe: campaignName || lastConversion.conversion_identifier || null,
      campanha: campaignName || null,
      observacoes: obsText,
      corretor_id: null,
      aceite_status: "pendente_distribuicao",
      prioridade_lead: message && message.length > 10 ? "alta" : "media",
    })
    .select("id")
    .single();

  if (insertError) {
    L.error("Lead insert failed", { name, telefone, empreendimento }, insertError);
    logOps("error", "system", "Lead insert failed", { name, telefone }, insertError.message);
    return { action: "error", error: insertError.message };
  }

  L.info("Lead created", { leadId: insertedLead.id, name, empreendimento });
  logOps("info", "business", "Lead created via RD Station", { lead_id: insertedLead.id, name, empreendimento });

  // ── Register entry activity ──
  await supabase.from("pipeline_atividades").insert({
    pipeline_lead_id: insertedLead.id,
    tipo: "entrada",
    titulo: `Lead gerado via RD Station${campaignName ? ` — ${campaignName}` : ""}`,
    descricao: `RD Station • ${empreendimento}${tags.length ? ` • Tags: ${tags.join(", ")}` : ""}`,
    status: "concluida",
    created_by: "00000000-0000-0000-0000-000000000000",
  }).then(r => { if (r.error) L.warn("Entry activity insert failed", {}, r.error); });

  // ── Auto-distribute via roleta ──
  const distributed = await distributeWithRetry(supabaseUrl, serviceKey, insertedLead.id, traceId, L as any);
  if (!distributed) {
    logOps("error", "integration", "Distribution failed — lead orphaned", { lead_id: insertedLead.id });
  }

  // ── Audit ──
  await supabase.from("audit_log").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    modulo: "pipeline",
    acao: "rdstation_webhook",
    descricao: `Lead RD Station: ${name} — ${empreendimento}`,
    origem: "webhook",
    request_id: traceId,
  }).then(r => { if (r.error) L.warn("Audit insert failed", {}, r.error); });

  return { action: "created", lead_id: insertedLead.id, empreendimento, distributed };
}
