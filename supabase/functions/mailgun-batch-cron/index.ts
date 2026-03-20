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
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY")!;

const BATCH_SIZE = 80;
const SEND_DELAY_MS = 250;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: campaigns } = await admin
      .from("email_campaigns")
      .select("*")
      .eq("status", "enviando")
      .limit(1);

    if (!campaigns || campaigns.length === 0) {
      return jsonResponse({ message: "No active campaign", sent: 0 });
    }

    const campaign = campaigns[0];
    const settings = await getEmailSettings(admin);
    const recipients = await claimCampaignRecipients(admin, campaign.id, BATCH_SIZE);

    if (!recipients || recipients.length === 0) {
      const totals = await updateCampaignProgress(admin, campaign.id);
      return jsonResponse({ message: totals.totalPendentes === 0 ? "Campaign complete" : "No recipients available", sent: 0, remaining: totals.totalPendentes });
    }

    let sent = 0;
    let errors = 0;

    for (const r of recipients) {
      const { data: suppressed } = await admin
        .from("email_suppression_list").select("id").eq("email", r.email).limit(1);
      if (suppressed && suppressed.length > 0) {
        await admin.from("email_campaign_recipients")
          .update({ status: "suprimido", erro: "Suprimido", processing_started_at: null })
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
        campaign_id: campaign.id,
        to: r.email,
        to_name: r.nome || undefined,
        subject,
        html,
        lead_id: r.lead_id || undefined,
        recipient_id: r.id,
        tags: ["campaign", campaign.nome],
      });

      if (result.success) {
        await admin.from("email_campaign_recipients")
          .update({ status: "enviado", mailgun_message_id: result.messageId, enviado_at: new Date().toISOString(), processing_started_at: null })
          .eq("id", r.id);
        sent++;
      } else {
        await admin.from("email_campaign_recipients")
          .update({ status: "erro", erro: result.error, processing_started_at: null })
          .eq("id", r.id);
        errors++;
        if (isRateLimitError(result.error)) {
          console.log("Rate limited, stopping batch early");
          break;
        }
      }

      await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
    }

    const totals = await updateCampaignProgress(admin, campaign.id);
    console.log(`Batch done: ${sent} sent, ${errors} errors, ${totals.totalPendentes} remaining`);
    return jsonResponse({ sent, errors, remaining: totals.totalPendentes, status: totals.status });
  } catch (err: any) {
    console.error("mailgun-batch-cron error:", err);
    return errorResponse(err.message || "Erro interno", 500);
  }
});
