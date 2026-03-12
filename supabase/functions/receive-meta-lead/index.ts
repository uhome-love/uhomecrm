/**
 * receive-meta-lead — Public webhook for Meta Ads (Facebook/Instagram) lead forms.
 * Receives leads directly from Meta Ads webhooks or Zapier/Make integrations.
 * Applies dedup (phone + jetimob_processed), resolves empreendimento via
 * jetimob_campaign_map, and distributes through the roleta.
 *
 * POST body (flexible — supports Meta Ads webhook format + flat JSON):
 * {
 *   name: "João Silva",
 *   email: "joao@email.com",
 *   phone: "51999001234",
 *   campaign_id: "3199",      // maps to empreendimento via jetimob_campaign_map
 *   campaign_name: "Casa Bastian",  // fallback if campaign_id not mapped
 *   message: "Quero saber mais",
 *   platform: "facebook",
 *   form_name: "Formulário Casa Bastian",
 *   ad_name: "Video 01",
 *   adset_name: "Público frio",
 *   source: "meta_ads",       // optional
 *   secret: "<WEBHOOK_SECRET>" // simple auth for webhook callers
 * }
 *
 * Also supports Meta Ads native format with field_data array.
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
  // Remove country code 55 if present and phone has 12-13 digits
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    console.log("META-LEAD RAW BODY:", JSON.stringify(body));

    // ── Auth: simple secret or Authorization header ──
    const webhookSecret = Deno.env.get("META_WEBHOOK_SECRET");
    if (webhookSecret) {
      const provided = body.secret || req.headers.get("x-webhook-secret") || "";
      if (provided !== webhookSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Parse fields (support flat JSON, Meta Ads field_data, and nested formats) ──
    // Helper: treat empty strings as null
    const v = (...keys: string[]): string => {
      for (const k of keys) {
        const val = body[k];
        if (typeof val === "string" && val.trim()) return val.trim();
      }
      return "";
    };

    let name = v("name", "full_name", "nome", "Nome", "NOME");
    let email = v("email", "Email", "EMAIL");
    let phone = v("phone", "telefone", "Telefone", "TELEFONE", "cel", "celular", "Celular", "whatsapp", "Whatsapp");
    let campaignId = v("campaign_id", "campaignId", "CampaignId");
    let campaignName = v("campaign_name", "campaignName", "campanha", "Campanha");
    let message = v("message", "mensagem", "Mensagem", "observacao");
    let platform = v("platform", "source", "origem") || "meta_ads";
    let formName = v("form_name", "formName", "formulario", "Formulario");
    let adName = v("ad_name", "adName");
    let adsetName = v("adset_name", "adsetName");

    // Meta Ads native format: field_data array
    if (body.field_data && Array.isArray(body.field_data)) {
      for (const field of body.field_data) {
        const val = Array.isArray(field.values) ? field.values[0] : field.values;
        if (!val) continue;
        const fn = (field.name || "").toLowerCase();
        if (fn.includes("full_name") || fn.includes("nome") || fn === "name") name = val;
        else if (fn.includes("email")) email = val;
        else if (fn.includes("phone") || fn.includes("telefone") || fn.includes("cel") || fn.includes("whatsapp")) phone = val;
      }
      campaignId = body.campaign_id || campaignId;
      campaignName = body.campaign_name || campaignName;
      formName = body.form_name || formName;
    }

    // Try to extract from nested objects (Make.com sometimes nests data)
    if (!name && !phone && typeof body === "object") {
      for (const key of Object.keys(body)) {
        const val = body[key];
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          if (!name) name = val.name || val.full_name || val.nome || val.Nome || "";
          if (!phone) phone = val.phone || val.telefone || val.Telefone || val.celular || val.whatsapp || "";
          if (!email) email = val.email || val.Email || "";
        }
      }
    }

    const telefone = normalizePhone(phone);
    if (!name && !telefone) {
      console.error("META-LEAD VALIDATION FAIL — no name or phone found in body:", JSON.stringify(body));
      return new Response(
        JSON.stringify({ error: "Nome ou telefone obrigatório", received_keys: Object.keys(body) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve empreendimento from campaign_id via jetimob_campaign_map ──
    let empreendimento: string | null = null;
    let segmentoFromMap: string | null = null;

    if (campaignId) {
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

    // Fallback: use campaign_name or form_name
    if (!empreendimento && campaignName) empreendimento = campaignName;
    if (!empreendimento && formName) empreendimento = formName;
    if (!empreendimento) empreendimento = "Avulso - Meta Ads";

    // ── Dedup: check phone ──
    if (telefone) {
      const { data: existing } = await supabase
        .from("pipeline_leads")
        .select("id, corretor_id, nome, empreendimento")
        .eq("telefone", telefone)
        .not("corretor_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Re-entry: notify corretor, don't create new lead
        const todayStamp = new Date().toISOString().slice(0, 10);
        const interestLabel = empreendimento || existing.empreendimento || "mesmo imóvel";

        await supabase.from("pipeline_leads").update({
          updated_at: new Date().toISOString(),
          observacoes: `[NOVO INTERESSE ${todayStamp}] ${interestLabel} (Meta Ads direto)${message ? ` — "${message}"` : ""}`,
        }).eq("id", existing.id);

        await supabase.from("notifications").insert({
          user_id: existing.corretor_id,
          tipo: "lead",
          categoria: "lead_retorno",
          titulo: `🔄 Lead reativado! ${existing.nome || name}`,
          mensagem: `${existing.nome || name} demonstrou novo interesse em ${interestLabel} (Meta Ads direto).`,
          dados: { pipeline_lead_id: existing.id, lead_nome: existing.nome || name, novo_empreendimento: interestLabel },
          agrupamento_key: `lead_retorno_${existing.id}_${todayStamp}`,
        });

        // Push notification
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
        } catch (e) { console.warn("Push error:", e); }

        console.log(`META-LEAD DEDUP: ${telefone} already exists (lead ${existing.id}), notified corretor`);
        return new Response(
          JSON.stringify({ success: true, action: "reactivated", lead_id: existing.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Resolve segmento ──
    // Map segmento name to pipeline_segmentos UUID
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
    // Also try via roleta_campanhas mapping
    if (!segmentoId && empreendimento) {
      const { data: rc } = await supabase
        .from("roleta_campanhas")
        .select("segmento_id")
        .ilike("empreendimento", empreendimento)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (rc?.segmento_id) {
        // Resolve roleta_segmentos → pipeline_segmentos
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
      return new Response(
        JSON.stringify({ error: "Estágio novo_lead não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Insert lead ──
    const { data: insertedLead, error: insertError } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: name || "Lead Meta Ads",
        telefone,
        email: email || null,
        empreendimento,
        segmento_id: segmentoId,
        stage_id: stageData.id,
        origem: platform || "Meta Ads",
        origem_detalhe: campaignName || formName || null,
        campanha: campaignName || null,
        campanha_id: campaignId || null,
        conjunto_anuncio: adsetName || null,
        anuncio: adName || null,
        formulario: formName || null,
        plataforma: platform || null,
        observacoes: message || null,
        corretor_id: null,
        aceite_status: "pendente_distribuicao",
        prioridade_lead: message && message.length > 10 ? "alta" : "media",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError.message);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`META-LEAD: Created lead ${insertedLead.id} — ${name} — ${empreendimento}`);

    // ── Auto-distribute via roleta ──
    try {
      await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "distribute_single",
          pipeline_lead_id: insertedLead.id,
        }),
      });
    } catch (distErr) {
      console.warn("Auto-distribute failed:", distErr);
    }

    // ── Audit ──
    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      modulo: "pipeline",
      acao: "meta_ads_webhook",
      descricao: `Lead direto Meta Ads: ${name} — ${empreendimento} (campaign_id: ${campaignId})`,
      origem: "webhook",
    }).then(r => { if (r.error) console.warn("audit:", r.error.message); });

    return new Response(
      JSON.stringify({ success: true, lead_id: insertedLead.id, empreendimento, distributed: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("receive-meta-lead error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
