/**
 * campaign-activation — Public webhook for Melnick Day Campaign Activation
 * 
 * Receives campaign responses from SMS, WhatsApp, AI calls, Email
 * and routes leads according to rules:
 * - Rule 1: Lead exists in pipeline_leads → tag + notify broker
 * - Rule 2: Lead exists in oferta_ativa_leads → create pipeline_lead + roleta
 * - Rule 3: Lead not found → create new + roleta
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

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

  const L = {
    info: (msg: string, ctx?: Record<string, unknown>) => console.info(JSON.stringify({ fn: "campaign-activation", level: "info", msg, traceId, ctx, ts: new Date().toISOString() })),
    warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(JSON.stringify({ fn: "campaign-activation", level: "warn", msg, traceId, ctx, ts: new Date().toISOString() })),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => console.error(JSON.stringify({ fn: "campaign-activation", level: "error", msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() })),
  };

  const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>) => {
    supabase.from("ops_events").insert({ fn: "campaign-activation", level, category, message, trace_id: traceId, ctx: ctx || {} }).then(() => {});
  };

  try {
    const body = await req.json();
    const { phone, name, email, channel, message } = body;

    const telefone = normalizePhone(phone);
    if (!telefone) {
      L.warn("No valid phone", { phone });
      return errorResponse("Phone number required", 400);
    }

    const nome = name || "Lead Campanha Melnick";
    const canal = channel || "unknown";

    L.info("Campaign response received", { telefone, canal, nome });

    // ─── RULE 1: Check pipeline_leads ───
    const { data: existingLead } = await supabase
      .from("pipeline_leads")
      .select("id, nome, corretor_id, tags, stage_id")
      .eq("telefone_normalizado", telefone)
      .not("aceite_status", "eq", "descartado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      L.info("Rule 1 — Lead exists in pipeline", { leadId: existingLead.id });

      // Add MELNICK_DAY tag if not present
      const currentTags: string[] = existingLead.tags || [];
      if (!currentTags.includes("MELNICK_DAY")) {
        await supabase.from("pipeline_leads").update({
          tags: [...currentTags, "MELNICK_DAY"],
        }).eq("id", existingLead.id);
      }

      // Create progression record
      await supabase.from("lead_progressao").insert({
        lead_id: existingLead.id,
        modulo_origem: "campanha",
        modulo_destino: "pipeline",
        fase_origem: "campanha_ativacao",
        fase_destino: "campanha_response",
        triggered_by: "campaign-activation",
      });

      // Notify broker if assigned
      if (existingLead.corretor_id) {
        // Get broker's auth_user_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("auth_user_id")
          .eq("id", existingLead.corretor_id)
          .maybeSingle();

        if (profile?.auth_user_id) {
          await supabase.from("homi_alerts").insert({
            destinatario_id: profile.auth_user_id,
            tipo: "campanha_response",
            mensagem: `🔥 Seu cliente ${existingLead.nome} respondeu à Campanha de Ativação Melnick Day`,
            prioridade: "alta",
            dedup_key: `melnick_response_${existingLead.id}_${new Date().toISOString().slice(0, 10)}`,
            contexto: { lead_id: existingLead.id, canal, campaign: "MELNICK_DAY_2026" },
          });

          // Send push notification
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-push`, {
              method: "POST",
              headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: profile.auth_user_id,
                title: `🔥 Campanha Melnick Day`,
                body: `${existingLead.nome} respondeu à campanha de ativação`,
                data: { url: `/pipeline?lead=${existingLead.id}` },
              }),
            });
          } catch (e) {
            L.warn("Push notification failed", {}, e);
          }
        }
      }

      // Track analytics
      await supabase.from("melnick_campaign_analytics").insert({
        tipo: "reactivated",
        pipeline_lead_id: existingLead.id,
        telefone,
        origem_canal: canal,
        rule_applied: "rule_1",
      });

      logOps("info", "campaign", "Lead reactivated (Rule 1)", { leadId: existingLead.id, canal });
      return jsonResponse({ rule: 1, action: "reactivated", lead_id: existingLead.id });
    }

    // ─── RULE 2: Check oferta_ativa_leads ───
    const { data: oaLead } = await supabase
      .from("oferta_ativa_leads")
      .select("id, nome, email, empreendimento, origem")
      .eq("telefone_normalizado", telefone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (oaLead) {
      L.info("Rule 2 — Lead exists in oferta_ativa", { oaLeadId: oaLead.id });

      // Get the first pipeline stage
      const { data: firstStage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_tipo", "leads")
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstStage) {
        L.error("No pipeline stages found");
        return errorResponse("No pipeline stages configured", 500);
      }

      // Create new pipeline_lead
      const { data: newLead, error: insertErr } = await supabase
        .from("pipeline_leads")
        .insert({
          nome: oaLead.nome || nome,
          telefone: phone,
          telefone_normalizado: telefone,
          email: oaLead.email || email || null,
          empreendimento: oaLead.empreendimento || null,
          origem: "campanha_melnick_day",
          stage_id: firstStage.id,
          aceite_status: "pendente_distribuicao",
          tags: ["MELNICK_DAY"],
          observacoes: `Lead reativado via Campanha Melnick Day (${canal}). Origem OA: ${oaLead.origem || "—"}`,
        })
        .select("id")
        .single();

      if (insertErr || !newLead) {
        L.error("Failed to create pipeline lead from OA", {}, insertErr);
        return errorResponse("Failed to create lead", 500);
      }

      // Distribute via roleta
      try {
        await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", "x-trace-id": traceId },
          body: JSON.stringify({ action: "distribute_single", pipeline_lead_id: newLead.id }),
        });
      } catch (e) {
        L.warn("Roleta distribution failed", { leadId: newLead.id }, e);
      }

      // Track analytics
      await supabase.from("melnick_campaign_analytics").insert([
        { tipo: "reactivated", pipeline_lead_id: newLead.id, telefone, origem_canal: canal, rule_applied: "rule_2" },
        { tipo: "sent_to_roleta", pipeline_lead_id: newLead.id, telefone, origem_canal: canal, rule_applied: "rule_2" },
      ]);

      logOps("info", "campaign", "Lead from OA sent to roleta (Rule 2)", { leadId: newLead.id, oaLeadId: oaLead.id });
      return jsonResponse({ rule: 2, action: "created_from_oa", lead_id: newLead.id });
    }

    // ─── RULE 3: New lead ───
    L.info("Rule 3 — New lead", { telefone, nome });

    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_tipo", "leads")
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!firstStage) {
      return errorResponse("No pipeline stages configured", 500);
    }

    const { data: newLead, error: insertErr } = await supabase
      .from("pipeline_leads")
      .insert({
        nome,
        telefone: phone,
        telefone_normalizado: telefone,
        email: email || null,
        origem: "campanha_melnick_day",
        stage_id: firstStage.id,
        aceite_status: "pendente_distribuicao",
        tags: ["MELNICK_DAY"],
        observacoes: `Novo lead via Campanha de Ativação Melnick Day (${canal})`,
      })
      .select("id")
      .single();

    if (insertErr || !newLead) {
      L.error("Failed to create new lead", {}, insertErr);
      return errorResponse("Failed to create lead", 500);
    }

    // Distribute via roleta
    try {
      await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", "x-trace-id": traceId },
        body: JSON.stringify({ action: "distribute_single", pipeline_lead_id: newLead.id }),
      });
    } catch (e) {
      L.warn("Roleta distribution failed", { leadId: newLead.id }, e);
    }

    // Track analytics
    await supabase.from("melnick_campaign_analytics").insert([
      { tipo: "new_lead", pipeline_lead_id: newLead.id, telefone, origem_canal: canal, rule_applied: "rule_3" },
      { tipo: "sent_to_roleta", pipeline_lead_id: newLead.id, telefone, origem_canal: canal, rule_applied: "rule_3" },
    ]);

    logOps("info", "campaign", "New lead created (Rule 3)", { leadId: newLead.id });
    return jsonResponse({ rule: 3, action: "new_lead_created", lead_id: newLead.id });

  } catch (err) {
    L.error("Unhandled error", {}, err);
    logOps("error", "campaign", "Unhandled error", { error: err instanceof Error ? err.message : String(err) });
    return errorResponse("Internal error", 500);
  }
});
