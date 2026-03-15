/**
 * campaign-sms-click — Public endpoint for Brevo SMS campaign clicks
 * 
 * Receives click data from the /melnickday landing page,
 * creates/updates leads in pipeline_leads, logs everything to campaign_clicks.
 * 
 * POST body: { phone, nome, email, utm_source, utm_medium, utm_campaign, canal, origem, campanha, user_agent }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const WHATSAPP_REDIRECT = "https://wa.me/5551992597097?text=Quero%20saber%20mais%20Melnick%20Day";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

  const log = (level: string, msg: string, ctx?: Record<string, unknown>) =>
    console[level === "error" ? "error" : "info"](
      JSON.stringify({ fn: "campaign-sms-click", level, msg, traceId, ctx, ts: new Date().toISOString() })
    );

  // Helper: insert click record
  async function insertClick(data: Record<string, unknown>) {
    const { error } = await supabase.from("campaign_clicks").insert(data);
    if (error) log("error", "Failed to insert click", { error: error.message });
  }

  try {
    const body = await req.json();
    const {
      phone, nome, email,
      utm_source, utm_medium, utm_campaign,
      canal = "brevo", origem = "SMS_MELNICK_DAY",
      campanha = "MELNICK_DAY_POA_2026",
      user_agent,
    } = body;

    const telefoneNormalizado = normalizePhone(phone);
    const tags = ["MELNICK_DAY", "SMS", "Brevo"];

    log("info", "Click received", { phone, telefoneNormalizado, nome, canal, origem });

    // Base click record
    const clickBase: Record<string, unknown> = {
      telefone: phone || null,
      telefone_normalizado: telefoneNormalizado,
      nome: nome || null,
      email: email || null,
      origem,
      canal,
      campanha,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      tags,
      redirect_url: WHATSAPP_REDIRECT,
      user_agent: user_agent || null,
    };

    // If no phone, still log click and redirect
    if (!telefoneNormalizado) {
      log("warn", "No valid phone, logging click only", { phone });
      await insertClick({ ...clickBase, status: "click_no_phone", lead_action: "none", redirected: true });
      return jsonResponse({ success: true, action: "redirect_only", redirect_url: WHATSAPP_REDIRECT });
    }

    // ─── Check existing lead by phone ───
    const { data: existingLead } = await supabase
      .from("pipeline_leads")
      .select("id, nome, tags, stage_id, corretor_id")
      .eq("telefone_normalizado", telefoneNormalizado)
      .not("aceite_status", "eq", "descartado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      // ─── UPDATE existing lead ───
      log("info", "Lead exists, updating", { leadId: existingLead.id });

      const currentTags: string[] = existingLead.tags || [];
      const newTags = [...new Set([...currentTags, ...tags])];

      await supabase.from("pipeline_leads").update({
        tags: newTags,
        campanha: campanha,
        observacoes: `Lead entrou via campanha de SMS do Brevo - Melnick Day Porto Alegre (${new Date().toLocaleDateString("pt-BR")})`,
      }).eq("id", existingLead.id);

      // Log progression
      await supabase.from("lead_progressao").insert({
        lead_id: existingLead.id,
        modulo_origem: "campanha_sms",
        modulo_destino: "pipeline",
        fase_origem: "sms_click",
        fase_destino: "lead_updated",
        triggered_by: "campaign-sms-click",
      });

      // Analytics
      await supabase.from("melnick_campaign_analytics").insert({
        tipo: "reactivated",
        pipeline_lead_id: existingLead.id,
        telefone: telefoneNormalizado,
        origem_canal: canal,
        rule_applied: "sms_existing",
      });

      await insertClick({
        ...clickBase,
        status: "lead_updated",
        lead_action: "updated",
        pipeline_lead_id: existingLead.id,
        redirected: true,
      });

      log("info", "Lead updated successfully", { leadId: existingLead.id });
      return jsonResponse({
        success: true,
        action: "updated",
        lead_id: existingLead.id,
        redirect_url: WHATSAPP_REDIRECT,
      });
    }

    // ─── CREATE new lead ───
    log("info", "Creating new lead", { telefoneNormalizado, nome });

    // Get first pipeline stage
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_tipo", "leads")
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!firstStage) {
      log("error", "No pipeline stages found");
      await insertClick({ ...clickBase, status: "error", error_message: "No pipeline stages", lead_action: "none", redirected: true });
      return jsonResponse({ success: false, error: "No pipeline stages", redirect_url: WHATSAPP_REDIRECT }, 500);
    }

    const { data: newLead, error: insertErr } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: nome || "Lead SMS Melnick Day",
        telefone: phone,
        telefone_normalizado: telefoneNormalizado,
        email: email || null,
        origem: origem,
        campanha: campanha,
        stage_id: firstStage.id,
        aceite_status: "pendente_distribuicao",
        tags,
        observacoes: `Lead entrou via campanha de SMS do Brevo - Melnick Day Porto Alegre (${new Date().toLocaleDateString("pt-BR")})`,
      })
      .select("id")
      .single();

    if (insertErr || !newLead) {
      log("error", "Failed to create lead", { error: insertErr?.message });
      await insertClick({ ...clickBase, status: "error", error_message: insertErr?.message || "Insert failed", lead_action: "none", redirected: true });
      return jsonResponse({ success: false, error: "Failed to create lead", redirect_url: WHATSAPP_REDIRECT }, 500);
    }

    log("info", "Lead created", { leadId: newLead.id });

    // Distribute via roleta
    try {
      await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", "x-trace-id": traceId },
        body: JSON.stringify({ action: "distribute_single", pipeline_lead_id: newLead.id }),
      });
      log("info", "Lead sent to roleta", { leadId: newLead.id });
    } catch (e) {
      log("error", "Roleta failed", { leadId: newLead.id, error: e instanceof Error ? e.message : String(e) });
    }

    // Analytics
    await supabase.from("melnick_campaign_analytics").insert([
      { tipo: "new_lead", pipeline_lead_id: newLead.id, telefone: telefoneNormalizado, origem_canal: canal, rule_applied: "sms_new" },
      { tipo: "sent_to_roleta", pipeline_lead_id: newLead.id, telefone: telefoneNormalizado, origem_canal: canal, rule_applied: "sms_new" },
    ]);

    await insertClick({
      ...clickBase,
      status: "lead_created",
      lead_action: "created",
      pipeline_lead_id: newLead.id,
      redirected: true,
    });

    return jsonResponse({
      success: true,
      action: "created",
      lead_id: newLead.id,
      redirect_url: WHATSAPP_REDIRECT,
    });

  } catch (err) {
    log("error", "Unhandled error", { error: err instanceof Error ? err.message : String(err) });

    // Still try to log the click
    try {
      await supabase.from("campaign_clicks").insert({
        status: "error",
        error_message: err instanceof Error ? err.message : String(err),
        lead_action: "none",
        redirected: true,
        redirect_url: WHATSAPP_REDIRECT,
      });
    } catch (_) { /* ignore */ }

    // Always return redirect URL even on error
    return jsonResponse({
      success: false,
      error: "Internal error",
      redirect_url: WHATSAPP_REDIRECT,
    }, 500);
  }
});
