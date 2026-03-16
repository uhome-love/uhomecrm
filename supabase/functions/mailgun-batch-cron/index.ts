import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

/**
 * mailgun-batch-cron — Called by pg_cron every 2 minutes
 * Sends a small batch of pending campaign emails respecting Mailgun rate limits.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY")!;

const BATCH_SIZE = 40; // ~40 per 2 min = ~1200/hour (Scale plan), or reduce for Foundation
const SEND_DELAY_MS = 500; // 500ms between emails

function replacePlaceholders(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value || "");
  }
  return result;
}

async function sendViaMailgun(
  settings: Record<string, string>,
  params: { to: string; to_name?: string; subject: string; html: string; campaign_id: string; lead_id?: string; recipient_id: string; tags: string[] }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const domain = settings.mailgun_domain || "";
  const baseUrl = settings.mailgun_base_url || "https://api.mailgun.net";
  const from = settings.mailgun_from || `UhomeSales <noreply@${domain}>`;

  const formData = new FormData();
  formData.append("from", from);
  formData.append("to", params.to_name ? `${params.to_name} <${params.to}>` : params.to);
  formData.append("subject", params.subject);
  formData.append("html", params.html);
  if (settings.mailgun_reply_to) formData.append("h:Reply-To", settings.mailgun_reply_to);
  formData.append("o:tracking", "yes");
  formData.append("o:tracking-opens", settings.tracking_opens === "true" ? "yes" : "no");
  formData.append("o:tracking-clicks", settings.tracking_clicks === "true" ? "yes" : "no");
  params.tags.forEach(t => formData.append("o:tag", t));
  formData.append("v:campaign_id", params.campaign_id);
  if (params.lead_id) formData.append("v:lead_id", params.lead_id);
  formData.append("v:recipient_id", params.recipient_id);

  const url = `${baseUrl}/v3/${domain}/messages`;
  const auth = btoa(`api:${MAILGUN_API_KEY}`);

  // Retry up to 2 times on rate limit
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: formData,
    });

    if (resp.status === 429) {
      const wait = Math.min(5000 * Math.pow(2, attempt), 30000);
      console.log(`Rate limited, waiting ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data.message || `Mailgun error ${resp.status}`;
      if (msg.includes("recipient limit exceeded") && attempt < 2) {
        const wait = Math.min(10000 * Math.pow(2, attempt), 60000);
        console.log(`Recipient limit, waiting ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      return { success: false, error: msg };
    }
    return { success: true, messageId: data.id };
  }
  return { success: false, error: "Rate limit exceeded after retries" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find active campaign (status = 'enviando')
    const { data: campaigns } = await admin
      .from("email_campaigns")
      .select("*")
      .eq("status", "enviando")
      .limit(1);

    if (!campaigns || campaigns.length === 0) {
      return jsonResponse({ message: "No active campaign", sent: 0 });
    }

    const campaign = campaigns[0];

    // Load settings
    const { data: settingsRows } = await admin.from("email_settings").select("key, value");
    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { settings[r.key] = r.value || ""; });

    // Get pending recipients
    const { data: recipients } = await admin
      .from("email_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("status", "pendente")
      .limit(BATCH_SIZE);

    if (!recipients || recipients.length === 0) {
      // No more pending — mark campaign as sent
      await admin.from("email_campaigns")
        .update({ status: "enviada", updated_at: new Date().toISOString() })
        .eq("id", campaign.id);
      return jsonResponse({ message: "Campaign complete", sent: 0 });
    }

    let sent = 0;
    let errors = 0;

    for (const r of recipients) {
      // Check suppression
      const { data: suppressed } = await admin
        .from("email_suppression_list").select("id").eq("email", r.email).limit(1);
      if (suppressed && suppressed.length > 0) {
        await admin.from("email_campaign_recipients")
          .update({ status: "suprimido", erro: "Suprimido" })
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

      const result = await sendViaMailgun(settings, {
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
          .update({ status: "enviado", mailgun_message_id: result.messageId, enviado_at: new Date().toISOString() })
          .eq("id", r.id);
        sent++;
      } else {
        await admin.from("email_campaign_recipients")
          .update({ status: "erro", erro: result.error })
          .eq("id", r.id);
        errors++;
        // Stop batch on rate limit
        if (result.error?.includes("limit") || result.error?.includes("rate")) {
          console.log("Rate limited, stopping batch early");
          break;
        }
      }

      await new Promise(r => setTimeout(r, SEND_DELAY_MS));
    }

    // Update campaign totals
    const { data: totals } = await admin
      .from("email_campaign_recipients")
      .select("status")
      .eq("campaign_id", campaign.id);

    const totalEnviados = totals?.filter(t => t.status === "enviado").length || 0;
    const totalErros = totals?.filter(t => t.status === "erro").length || 0;
    const totalPendentes = totals?.filter(t => t.status === "pendente").length || 0;

    await admin.from("email_campaigns")
      .update({
        total_enviados: totalEnviados,
        total_erros: totalErros,
        updated_at: new Date().toISOString(),
        ...(totalPendentes === 0 ? { status: "enviada" } : {}),
      })
      .eq("id", campaign.id);

    console.log(`Batch done: ${sent} sent, ${errors} errors, ${totalPendentes} remaining`);
    return jsonResponse({ sent, errors, remaining: totalPendentes });
  } catch (err: any) {
    console.error("mailgun-batch-cron error:", err);
    return errorResponse(err.message || "Erro interno", 500);
  }
});
