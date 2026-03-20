import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  claimCampaignRecipients,
  getEmailSettings,
  isRateLimitError,
  replacePlaceholders,
  sendViaMailgun,
  updateCampaignProgress,
} from "../_shared/mailgun-campaigns.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("mailgun-send auth error:", claimsError);
      return errorResponse("Unauthorized", 401);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const settings = await getEmailSettings(adminClient);

    const body = await req.json();
    const { mode } = body;

    if (mode === "single") {
      const { to, to_name, subject, html, text, lead_id, template_id, variables } = body;
      if (!to || !subject) return errorResponse("to e subject são obrigatórios", 400);

      let finalHtml = html || "";
      let finalSubject = subject;

      if (template_id) {
        const { data: tpl } = await adminClient
          .from("email_templates").select("*").eq("id", template_id).single();
        if (tpl) {
          finalHtml = tpl.html_content;
          finalSubject = tpl.assunto;
        }
      }

      if (variables) {
        finalHtml = replacePlaceholders(finalHtml, variables);
        finalSubject = replacePlaceholders(finalSubject, variables);
      }

      const { data: suppressed } = await adminClient
        .from("email_suppression_list").select("id").eq("email", to).limit(1);
      if (suppressed && suppressed.length > 0) {
        return jsonResponse({ success: false, error: "Email na lista de supressão" });
      }

      const result = await sendViaMailgun(settings, MAILGUN_API_KEY, {
        to, to_name, subject: finalSubject, html: finalHtml, text,
        lead_id, tags: ["individual"],
      });

      if (result.success && lead_id) {
        await adminClient.from("email_events").insert({
          lead_id,
          mailgun_message_id: result.messageId,
          event_type: "sent",
          event_data: { subject: finalSubject, to },
        });
      }

      return jsonResponse(result);
    }

    if (mode === "campaign") {
      const { campaign_id, batch_size: reqBatchSize } = body;
      if (!campaign_id) return errorResponse("campaign_id obrigatório", 400);

      const { data: campaign, error: campErr } = await adminClient
        .from("email_campaigns").select("*").eq("id", campaign_id).single();
      if (campErr || !campaign) return errorResponse("Campanha não encontrada", 404);

      await adminClient.from("email_campaigns")
        .update({ status: "enviando", updated_at: new Date().toISOString() })
        .eq("id", campaign_id);

      const batchSize = reqBatchSize || 120;
      const recipients = await claimCampaignRecipients(adminClient, campaign_id, batchSize);

      if (!recipients.length) {
        const totals = await updateCampaignProgress(adminClient, campaign_id);
        return jsonResponse({
          success: true,
          enviados: 0,
          erros: 0,
          pendentes: totals.totalPendentes,
          rate_limited: false,
          status: totals.status,
        });
      }

      let enviados = 0;
      let erros = 0;
      let rateLimited = false;

      for (const r of (recipients || [])) {
        // Check suppression
        const { data: suppressed } = await adminClient
          .from("email_suppression_list").select("id").eq("email", r.email).limit(1);
        if (suppressed && suppressed.length > 0) {
          await adminClient.from("email_campaign_recipients")
            .update({ status: "suprimido", erro: "Email na lista de supressão", processing_started_at: null })
            .eq("id", r.id);
          continue;
        }

        let html = campaign.html_content || "";
        let subject = campaign.assunto || "";
        const vars = (r.variaveis || {}) as Record<string, string>;
        vars.nome = r.nome || "";
        vars.email = r.email || "";
        html = replacePlaceholders(html, vars);
        subject = replacePlaceholders(subject, vars);

        const result = await sendViaMailgun(settings, MAILGUN_API_KEY, {
          campaign_id,
          to: r.email,
          to_name: r.nome || undefined,
          subject,
          html,
          lead_id: r.lead_id || undefined,
          recipient_id: r.id,
          tags: ["campaign", campaign.nome],
        }, 2); // 2 retries per email

        if (result.success) {
          await adminClient.from("email_campaign_recipients")
            .update({
              status: "enviado",
              mailgun_message_id: result.messageId,
              enviado_at: new Date().toISOString(),
              processing_started_at: null,
            })
            .eq("id", r.id);
          enviados++;
        } else {
          if (isRateLimitError(result.error)) {
            rateLimited = true;
          }
          await adminClient.from("email_campaign_recipients")
            .update({ status: "erro", erro: result.error, processing_started_at: null })
            .eq("id", r.id);
          erros++;

          // If rate limited even after retries, stop this batch
          if (rateLimited) {
            console.log("Rate limited after retries, stopping batch. Will resume on next invocation.");
            break;
          }
        }

        // Delay between sends — 150ms (fast enough for paid plans)
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      const totals = await updateCampaignProgress(adminClient, campaign_id);

      return jsonResponse({
        success: true,
        enviados,
        erros,
        pendentes: totals.totalPendentes,
        rate_limited: rateLimited,
        status: totals.status,
      });
    }

    return errorResponse("mode deve ser 'single' ou 'campaign'", 400);
  } catch (err: any) {
    console.error("mailgun-send error:", err);
    return errorResponse(err.message || "Erro interno", 500);
  }
});
