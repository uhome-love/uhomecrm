/**
 * receive-tiktok-lead — Public webhook for TikTok Ads lead forms.
 * Receives leads from TikTok via Make.com/Zapier integrations.
 * Applies dedup (phone), resolves empreendimento via campaign mapping,
 * and distributes through the roleta.
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

/**
 * Attempt to extract structured field/value pairs from a stringified
 * TikTok Answers array that Make.com sometimes dumps into a single field.
 */
function extractFieldValuePairs(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const wrapped = `[${raw.replace(/}\s*,\s*{/g, "},{")}]`;
    const arr = JSON.parse(wrapped);
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item.field && item.value) {
          result[String(item.field).toLowerCase().trim()] = String(item.value).trim();
        }
      }
    }
  } catch {
    const regex = /"field"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]*)"/g;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      result[match[1].toLowerCase().trim()] = match[2].trim();
    }
  }
  return result;
}

function normalizeLower(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

function isLikelyTestLead(name: string, email: string, message: string): boolean {
  const combined = `${normalizeLower(name)} ${normalizeLower(email)} ${normalizeLower(message)}`;
  if (combined.includes("<test lead:")) return true;
  if (combined.includes("dummy data")) return true;
  if (combined.includes("test@")) return true;
  const testTokens = [" lead teste ", " teste make ", " qa ", " sandbox "];
  return testTokens.some((token) => combined.includes(token));
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
  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

  const L = {
    info: (msg: string, ctx?: Record<string, unknown>) => console.info(JSON.stringify({ fn: "receive-tiktok-lead", level: "info", msg, traceId, ctx, ts: new Date().toISOString() })),
    warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(JSON.stringify({ fn: "receive-tiktok-lead", level: "warn", msg, traceId, ctx, ts: new Date().toISOString() })),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => console.error(JSON.stringify({ fn: "receive-tiktok-lead", level: "error", msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() })),
  };

  const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
    supabase.from("ops_events").insert({ fn: "receive-tiktok-lead", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
  };

  try {
    const body = await req.json();
    L.info("Raw body received", { hasData: !!body.data });

    // ── Auth: simple secret ──
    const webhookSecret = Deno.env.get("TIKTOK_WEBHOOK_SECRET") || Deno.env.get("META_WEBHOOK_SECRET");
    if (webhookSecret) {
      const provided = body.secret || req.headers.get("x-webhook-secret") || "";
      if (provided !== webhookSecret) {
        L.warn("Auth failed");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Parse fields ──
    const v = (...keys: string[]): string => {
      for (const k of keys) {
        const r = extractStr(body[k]);
        if (r) return r;
      }
      return "";
    };

    let name = v("name", "full_name", "nome", "Nome");
    let email = v("email", "Email");
    let phone = v("phone", "phone_number", "telefone", "cel", "celular", "whatsapp");
    let campaignId = v("campaign_id", "campaignId");
    let campaignName = v("campaign_name", "campaignName", "campanha");
    let message = v("message", "mensagem", "observacao");
    let formName = v("form_name", "formName", "formulario");
    let adName = v("ad_name", "adName", "adId");
    let adsetName = v("adset_name", "adsetName", "adgroup_name", "adgroupId");
    let propertyCode = v("property_code", "propertyCode", "codigo_imovel");
    let externalLeadId = v("lead_id", "leadId", "tiktok_lead_id", "id");

    // ── Make.com data object ──
    if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
      const d = body.data;
      if (!name) name = extractStr(d.full_name) || extractStr(d.name) || extractStr(d.nome);
      if (!phone) phone = extractStr(d.phone_number) || extractStr(d.phone) || extractStr(d.telefone) || extractStr(d.celular) || extractStr(d.whatsapp);
      if (!email) email = extractStr(d.email);
      if (!campaignId) campaignId = extractStr(d.campaign_id);
      if (!message) message = extractStr(d.message) || extractStr(d.mensagem);
      if (!propertyCode) propertyCode = extractStr(d.property_code) || extractStr(d.codigo_imovel);
      if (!externalLeadId) externalLeadId = extractStr(d.lead_id) || extractStr(d.tiktok_lead_id) || extractStr(d.id);
    }

    // ── Make.com mappable_field_data ──
    if (body.mappable_field_data && Array.isArray(body.mappable_field_data)) {
      for (const field of body.mappable_field_data) {
        const val = extractStr(field.value) || extractStr(field.values);
        if (!val) continue;
        const fn = (field.name || "").toLowerCase();
        if (!name && (fn === "full_name" || fn === "nome" || fn === "name")) name = val;
        else if (!email && fn.includes("email")) email = val;
        else if (!phone && (fn.includes("phone") || fn.includes("telefone") || fn.includes("celular") || fn.includes("whatsapp"))) phone = val;
        else if (!campaignId && fn === "campaign_id") campaignId = val;
        else if (!message && fn === "message") message = val;
        else if (!propertyCode && (fn === "property_code" || fn === "codigo_imovel")) propertyCode = val;
        else if (!externalLeadId && (fn === "lead_id" || fn === "tiktok_lead_id")) externalLeadId = val;
      }
    }

    // ── Fallback: detect stringified field/value pairs ──
    const allRawValues = [name, email, phone, message].join(" ");
    if (allRawValues.includes('"field"') && allRawValues.includes('"value"')) {
      const candidates = [name, email, phone, message].filter(v => v.includes('"field"'));
      const longestRaw = candidates.sort((a, b) => b.length - a.length)[0] || "";
      if (longestRaw) {
        const parsed = extractFieldValuePairs(longestRaw);
        L.info("Fallback parse applied", { parsed });
        if (parsed.name || parsed.full_name || parsed.nome) {
          name = parsed.name || parsed.full_name || parsed.nome || name;
        }
        if (parsed.email) email = parsed.email;
        if (parsed.phone_number || parsed.phone || parsed.telefone || parsed.celular || parsed.whatsapp) {
          phone = parsed.phone_number || parsed.phone || parsed.telefone || parsed.celular || parsed.whatsapp || phone;
        }
        if (parsed.message || parsed.mensagem) message = parsed.message || parsed.mensagem || message;
      }
    }

    const telefone = normalizePhone(phone);
    const isTestLead = isLikelyTestLead(name, email, message);
    const platform = "tiktok_ads";

    L.info("Parsed", { name, telefone, campaignId, externalLeadId, isTestLead });

    if (isTestLead) {
      L.info("Ignored test payload", { name, email, externalLeadId });
      return new Response(
        JSON.stringify({ success: true, action: "ignored_test_payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!telefone) {
      L.warn("Missing phone", { name, email, campaignId });
      return new Response(
        JSON.stringify({ success: true, action: "ignored_missing_phone", reason: "telefone obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve empreendimento ──
    let empreendimento: string | null = null;
    let segmentoFromMap: string | null = null;

    if (propertyCode) {
      const cleanCode = propertyCode.replace(/-UH$/i, "").trim();
      const codeWithSuffix = cleanCode.includes("-") ? cleanCode : `${cleanCode}-UH`;
      const { data: overrideRow } = await supabase
        .from("empreendimento_overrides")
        .select("nome")
        .or(`codigo.eq.${codeWithSuffix},codigo.eq.${cleanCode}`)
        .limit(1)
        .maybeSingle();
      if (overrideRow) empreendimento = overrideRow.nome;

      if (!empreendimento) {
        const { data: rcByCode } = await supabase
          .from("roleta_campanhas")
          .select("empreendimento, segmento_id")
          .ilike("empreendimento", `%${cleanCode}%`)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (rcByCode) empreendimento = rcByCode.empreendimento;
      }
    }

    if (!empreendimento && campaignId) {
      const { data: mapRow } = await supabase
        .from("jetimob_campaign_map")
        .select("empreendimento, segmento")
        .eq("campaign_id", String(campaignId))
        .maybeSingle();
      if (mapRow) {
        empreendimento = mapRow.empreendimento;
        if (!segmentoFromMap) segmentoFromMap = mapRow.segmento;
      }
    }

    if (!empreendimento && campaignName) empreendimento = campaignName;
    if (!empreendimento && formName) empreendimento = formName;
    if (!empreendimento) empreendimento = "Avulso - TikTok Ads";

    // Normalize empreendimento: strip common suffixes like " - Uhome", " - Venda", etc.
    if (empreendimento) {
      empreendimento = empreendimento.replace(/\s*-\s*(Uhome|Venda|Locação|Locacao)$/i, "").trim();
    }

    // ── Dedup ──
    const dedupRegistryId = externalLeadId ? `tiktok:${externalLeadId}` : `tiktok-phone:${telefone}`;

    if (externalLeadId) {
      const { data: existingExternal } = await supabase
        .from("jetimob_processed")
        .select("jetimob_lead_id")
        .eq("jetimob_lead_id", `tiktok:${externalLeadId}`)
        .maybeSingle();
      if (existingExternal) {
        L.info("Dedup: external id already processed", { externalLeadId });
        return new Response(
          JSON.stringify({ success: true, action: "skipped_external_id_dedup" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: alreadyProcessed } = await supabase
      .from("jetimob_processed")
      .select("jetimob_lead_id, telefone")
      .eq("telefone", telefone)
      .limit(1)
      .maybeSingle();

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
        return new Response(
          JSON.stringify({ success: true, action: "skipped_duplicate_pending", lead_id: existing.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const todayStamp = new Date().toISOString().slice(0, 10);
      const interestLabel = empreendimento || existing.empreendimento || "mesmo imóvel";

      await supabase.from("pipeline_leads").update({
        updated_at: new Date().toISOString(),
        observacoes: `[NOVO INTERESSE ${todayStamp}] ${interestLabel} (TikTok Ads)${message ? ` — "${message}"` : ""}`,
      }).eq("id", existing.id);

      await Promise.all([
        supabase.from("notifications").insert({
          user_id: existing.corretor_id,
          tipo: "lead",
          categoria: "lead_retorno",
          titulo: `🔄 Lead reativado! ${existing.nome || name}`,
          mensagem: `${existing.nome || name} demonstrou novo interesse em ${interestLabel} (TikTok Ads).`,
          dados: { pipeline_lead_id: existing.id, lead_nome: existing.nome || name, novo_empreendimento: interestLabel },
          agrupamento_key: `lead_retorno_${existing.id}_${todayStamp}`,
        }),
        supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: existing.id,
          tipo: "entrada",
          titulo: `🔄 Novo interesse via TikTok Ads`,
          descricao: `Lead demonstrou novo interesse em ${interestLabel} (TikTok Ads).${message ? `\nMensagem: "${message}"` : ""}`,
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
      } catch (e) { L.warn("Push error", { leadId: existing.id }, e); }

      L.info("Reactivated existing lead", { telefone, leadId: existing.id });
      return new Response(
        JSON.stringify({ success: true, action: "reactivated", lead_id: existing.id, trace_id: traceId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (alreadyProcessed) {
      L.info("Dedup: permanent registry", { telefone });
      return new Response(
        JSON.stringify({ success: true, action: "skipped_permanent_dedup" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        .ilike("empreendimento", `%${empreendimento}%`)
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

    // ── Stage novo_lead ──
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

    const obsLines: string[] = [];
    if (message) obsLines.push(message);
    if (propertyCode) obsLines.push(`Cód. Imóvel: ${propertyCode}`);
    const obsText = obsLines.length > 0 ? obsLines.join(" | ") : null;

    // ── Register in permanent dedup BEFORE insert (prevents race condition) ──
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

    // ── Insert lead ──
    const { data: insertedLead, error: insertError } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: name || "Lead TikTok Ads",
        telefone,
        email: email || null,
        empreendimento,
        segmento_id: segmentoId,
        stage_id: stageData.id,
        origem: "TikTok Ads",
        origem_detalhe: campaignName || formName || null,
        campanha: campaignName || (message ? message.slice(0, 100) : null),
        campanha_id: campaignId || null,
        conjunto_anuncio: adsetName || null,
        anuncio: adName || null,
        formulario: formName || null,
        plataforma: platform,
        observacoes: obsText,
        corretor_id: null,
        aceite_status: "pendente_distribuicao",
        prioridade_lead: message && message.length > 10 ? "alta" : "media",
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

    L.info("Lead created", { leadId: insertedLead.id, name, empreendimento, campaignId });
    logOps("info", "business", "Lead created via TikTok Ads", { lead_id: insertedLead.id, name, empreendimento, campaign_id: campaignId });

    // ── Register entry activity with form info ──
    const entradaParts: string[] = ["TikTok Ads"];
    if (formName) entradaParts.push(`Formulário: ${formName}`);
    if (campaignName && campaignName !== formName) entradaParts.push(`Campanha: ${campaignName}`);
    if (empreendimento) entradaParts.push(`Empreendimento: ${empreendimento}`);

    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: insertedLead.id,
      tipo: "entrada",
      titulo: `Lead gerado via TikTok Ads${formName ? ` — ${formName}` : ""}`,
      descricao: entradaParts.join(" • "),
      status: "concluida",
      created_by: "00000000-0000-0000-0000-000000000000",
    }).then(r => { if (r.error) L.warn("Entry activity insert failed", {}, r.error); });

    // ── Auto-distribute (with retry) ──
    const distributed = await distributeWithRetry(supabaseUrl, serviceKey, insertedLead.id, traceId, L);
    if (!distributed) {
      logOps("error", "integration", "Distribution failed after retries — lead orphaned", { lead_id: insertedLead.id, name, empreendimento });
    }

    // ── Audit ──
    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      modulo: "pipeline",
      acao: "tiktok_ads_webhook",
      descricao: `Lead TikTok Ads: ${name} — ${empreendimento} (campaign_id: ${campaignId})`,
      origem: "webhook",
      request_id: traceId,
    });

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
