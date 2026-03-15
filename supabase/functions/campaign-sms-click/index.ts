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

const WHATSAPP_REDIRECT = "https://wa.me/5551992597097?text=Quero%20saber%20mais%20sobre%20o%20Melnick%20Day";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Remove country code 55
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

// Build all normalized variants for matching (with/without 55, with/without 9th digit)
function phoneVariants(normalized: string): string[] {
  const variants = new Set<string>();
  variants.add(normalized);
  variants.add(`55${normalized}`);
  
  // Handle 9th digit: DDD(2) + 9 + number(8) = 11 digits
  // If has 9th digit (11 digits, 3rd char is 9), also try without it
  if (normalized.length === 11 && normalized[2] === "9") {
    const without9 = normalized.slice(0, 2) + normalized.slice(3);
    variants.add(without9);
    variants.add(`55${without9}`);
  }
  // If missing 9th digit (10 digits), also try with it
  if (normalized.length === 10) {
    const with9 = normalized.slice(0, 2) + "9" + normalized.slice(2);
    variants.add(with9);
    variants.add(`55${with9}`);
  }

  return [...variants];
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
      bloco = "",
      user_agent,
    } = body;

    const telefoneNormalizado = normalizePhone(phone);
    const tags = ["MELNICK_DAY", "SMS", "Brevo"];
    const blocoLabel = bloco ? ` - bloco ${bloco}` : "";
    const obsText = `Lead veio do email Melnick Day 2026${blocoLabel} (${new Date().toLocaleDateString("pt-BR")})`;

    log("info", "Click received", { phone, telefoneNormalizado, nome, email, canal, origem, bloco });

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

    // ─── Enrich from brevo_contacts if name/email missing ───
    let enrichedNome = nome;
    let enrichedEmail = email;
    let interesseBrevo: string | null = null;

    if (telefoneNormalizado || email) {
      let brevoContact: Record<string, unknown> | null = null;

      if (telefoneNormalizado) {
        const variants = phoneVariants(telefoneNormalizado);
        const { data } = await supabase
          .from("brevo_contacts")
          .select("nome_completo, email, conversao_recente")
          .in("telefone_normalizado", variants)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        brevoContact = data;
      }

      if (!brevoContact && email) {
        const { data } = await supabase
          .from("brevo_contacts")
          .select("nome_completo, email, conversao_recente")
          .eq("email", email.toLowerCase().trim())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        brevoContact = data;
      }

      if (brevoContact) {
        if (!enrichedNome && brevoContact.nome_completo) enrichedNome = brevoContact.nome_completo as string;
        if (!enrichedEmail && brevoContact.email) enrichedEmail = brevoContact.email as string;
        if (brevoContact.conversao_recente) interesseBrevo = brevoContact.conversao_recente as string;
        log("info", "Enriched from brevo_contacts", { enrichedNome, enrichedEmail, interesseBrevo });
      }
    }

    // ─── Try to find existing lead by phone OR email ───
    let existingLead: Record<string, unknown> | null = null;

    if (telefoneNormalizado) {
      const variants = phoneVariants(telefoneNormalizado);
      const { data } = await supabase
        .from("pipeline_leads")
        .select("id, nome, email, tags, stage_id, corretor_id")
        .in("telefone_normalizado", variants)
        .not("aceite_status", "eq", "descartado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingLead = data;
    }

    if (!existingLead && (enrichedEmail || email)) {
      const searchEmail = enrichedEmail || email;
      const { data } = await supabase
        .from("pipeline_leads")
        .select("id, nome, email, tags, stage_id, corretor_id")
        .eq("email", searchEmail)
        .not("aceite_status", "eq", "descartado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingLead = data;
    }

    // If no phone AND no email (even after enrichment), still log click and redirect
    if (!telefoneNormalizado && !email && !enrichedEmail) {
      log("warn", "No valid phone or email, logging click only", { phone, email });
      await insertClick({ ...clickBase, status: "click_no_contact", lead_action: "none", redirected: true });
      return jsonResponse({ success: true, action: "redirect_only", redirect_url: WHATSAPP_REDIRECT });
    }

    if (existingLead) {
      // ─── UPDATE existing lead ───
      log("info", "Lead exists, updating", { leadId: existingLead.id });

      const currentTags: string[] = (existingLead.tags as string[]) || [];
      const newTags = [...new Set([...currentTags, ...tags])];

      const updateData: Record<string, unknown> = {
        tags: newTags,
        campanha: campanha,
        observacoes: interesseBrevo
          ? `${obsText} | Interesse: ${interesseBrevo}`
          : obsText,
      };
      // Update name if we have one and existing is generic
      const bestNome = enrichedNome || nome;
      if (bestNome && (!existingLead.nome || existingLead.nome === "Lead Melnick Day")) {
        updateData.nome = bestNome;
      }
      // Update email if we have one and existing doesn't
      const bestEmail = enrichedEmail || email;
      if (bestEmail && !existingLead.email) {
        updateData.email = bestEmail;
      }

      await supabase.from("pipeline_leads").update(updateData).eq("id", existingLead.id);

      // ─── Notify the responsible corretor ───
      const corretorId = existingLead.corretor_id as string | null;
      if (corretorId) {
        const leadNome = (enrichedNome || nome || existingLead.nome || "Lead") as string;
        const interesseMsg = interesseBrevo ? `\nInteresse detectado: ${interesseBrevo}` : "";
        await supabase.from("notifications").insert({
          user_id: corretorId,
          titulo: `🔥 ${leadNome} clicou no Melnick Day!`,
          mensagem: `Seu lead "${leadNome}" demonstrou interesse clicando na campanha Melnick Day 2026${blocoLabel}. Entre em contato agora!${interesseMsg}`,
          tipo: "lead_reengajado",
          categoria: "leads",
          dados: { pipeline_lead_id: existingLead.id, campanha, bloco, origem, interesse: interesseBrevo },
        });
        log("info", "Corretor notified", { corretorId, leadId: existingLead.id });
      }

      // Log progression
      await supabase.from("lead_progressao").insert({
        lead_id: existingLead.id,
        modulo_origem: "campanha_email",
        modulo_destino: "pipeline",
        fase_origem: "email_click",
        fase_destino: "lead_reengaged",
        triggered_by: "campaign-sms-click",
      });

      // Analytics
      await supabase.from("melnick_campaign_analytics").insert({
        tipo: "reactivated",
        pipeline_lead_id: existingLead.id,
        telefone: telefoneNormalizado,
        origem_canal: canal,
        rule_applied: "existing_lead_notified",
      });

      await insertClick({
        ...clickBase,
        status: "lead_updated",
        lead_action: "updated",
        pipeline_lead_id: existingLead.id,
        redirected: true,
      });

      log("info", "Lead updated & corretor notified", { leadId: existingLead.id, corretorId });
      return jsonResponse({
        success: true,
        action: "updated",
        lead_id: existingLead.id,
        redirect_url: WHATSAPP_REDIRECT,
      });
    }

    // ─── CREATE new lead ───
    log("info", "Creating new lead", { telefoneNormalizado, enrichedNome, enrichedEmail, interesseBrevo });

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

    const leadNome = enrichedNome || nome || "Lead Melnick Day";
    const leadEmail = enrichedEmail || email;
    const obsComInteresse = interesseBrevo
      ? `${obsText} | Interesse: ${interesseBrevo}`
      : obsText;

    const { data: newLead, error: insertErr } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: leadNome,
        telefone: phone || null,
        telefone_normalizado: telefoneNormalizado,
        email: leadEmail || null,
        origem: origem,
        campanha: campanha,
        stage_id: firstStage.id,
        aceite_status: "pendente_distribuicao",
        tags,
        observacoes: obsComInteresse,
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
