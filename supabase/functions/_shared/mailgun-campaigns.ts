export interface MailgunSendRequest {
  campaign_id?: string;
  to: string;
  to_name?: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  reply_to?: string;
  lead_id?: string;
  recipient_id?: string;
  tags?: string[];
}

export interface ClaimedCampaignRecipient {
  id: string;
  campaign_id: string;
  email: string;
  nome: string | null;
  lead_id: string | null;
  variaveis: Record<string, string>;
  status: string | null;
}

const SENT_STATUSES = ["enviado", "entregue", "aberto", "clicado", "complaint", "unsubscribe"];
const ERROR_STATUSES = ["erro", "bounce", "suprimido"];
const PENDING_STATUSES = ["pendente", "processando"];

export function replacePlaceholders(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value || "");
  }
  return result;
}

export async function getEmailSettings(adminClient: any): Promise<Record<string, string>> {
  const { data } = await adminClient.from("email_settings").select("key, value");
  const settings: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    settings[row.key] = row.value || "";
  });
  return settings;
}

export function isRateLimitError(error?: string | null) {
  const normalized = (error || "").toLowerCase();
  return normalized.includes("rate") || normalized.includes("limit") || normalized.includes("quota");
}

export async function sendViaMailgun(
  settings: Record<string, string>,
  mailgunApiKey: string,
  req: MailgunSendRequest,
  maxRetries = 3,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const domain = settings.mailgun_domain || "";
  const baseUrl = settings.mailgun_base_url || "https://api.mailgun.net";
  const from = req.from || settings.mailgun_from || `UhomeSales <noreply@${domain}>`;

  const formData = new FormData();
  formData.append("from", from);
  formData.append("to", req.to_name ? `${req.to_name} <${req.to}>` : req.to);
  formData.append("subject", req.subject);
  formData.append("html", req.html);
  if (req.text) formData.append("text", req.text);
  if (req.reply_to || settings.mailgun_reply_to) {
    formData.append("h:Reply-To", req.reply_to || settings.mailgun_reply_to);
  }

  formData.append("o:tracking", "yes");
  formData.append("o:tracking-opens", settings.tracking_opens === "true" ? "yes" : "no");
  formData.append("o:tracking-clicks", settings.tracking_clicks === "true" ? "yes" : "no");

  if (req.tags) {
    req.tags.forEach((tag) => formData.append("o:tag", tag));
  }

  if (req.campaign_id) formData.append("v:campaign_id", req.campaign_id);
  if (req.lead_id) formData.append("v:lead_id", req.lead_id);
  if (req.recipient_id) formData.append("v:recipient_id", req.recipient_id);

  const url = `${baseUrl}/v3/${domain}/messages`;
  const auth = btoa(`api:${mailgunApiKey}`);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: formData,
    });

    if (resp.status === 429) {
      const retryAfter = resp.headers.get("Retry-After");
      const waitMs = retryAfter
        ? Math.max(parseInt(retryAfter, 10) * 1000, 2000)
        : Math.min(2000 * Math.pow(2, attempt), 30000);
      console.log(`Rate limited, waiting ${waitMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    const data = await resp.json();
    if (!resp.ok) {
      const message = data.message || `Mailgun error ${resp.status}`;
      if (message.includes("recipient limit exceeded") && attempt < maxRetries) {
        const waitMs = Math.min(5000 * Math.pow(2, attempt), 60000);
        console.log(`Recipient limit exceeded, waiting ${waitMs}ms (attempt ${attempt + 1})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      return { success: false, error: message };
    }

    return { success: true, messageId: data.id };
  }

  return { success: false, error: "Max retries exceeded (rate limit)" };
}

export async function claimCampaignRecipients(
  adminClient: any,
  campaignId: string,
  batchSize: number,
): Promise<ClaimedCampaignRecipient[]> {
  const { data, error } = await adminClient.rpc("claim_email_campaign_recipients", {
    p_campaign_id: campaignId,
    p_batch_size: batchSize,
  });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    variaveis: row.variaveis || {},
  })) as ClaimedCampaignRecipient[];
}

export async function updateCampaignProgress(adminClient: any, campaignId: string) {
  const [{ count: totalEnviados }, { count: totalErros }, { count: totalPendentes }] = await Promise.all([
    adminClient
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", SENT_STATUSES),
    adminClient
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ERROR_STATUSES),
    adminClient
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", PENDING_STATUSES),
  ]);

  const remaining = totalPendentes || 0;
  const nextStatus = remaining === 0 ? "enviada" : "enviando";

  await adminClient
    .from("email_campaigns")
    .update({
      total_enviados: totalEnviados || 0,
      total_erros: totalErros || 0,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return {
    totalEnviados: totalEnviados || 0,
    totalErros: totalErros || 0,
    totalPendentes: remaining,
    status: nextStatus,
  };
}