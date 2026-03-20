import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY")!;

interface SendRequest {
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
  variables?: Record<string, string>;
}

function replacePlaceholders(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value || "");
  }
  return result;
}

async function getSettings(adminClient: any): Promise<Record<string, string>> {
  const { data } = await adminClient.from("email_settings").select("key, value");
  const settings: Record<string, string> = {};
  (data || []).forEach((row: any) => { settings[row.key] = row.value || ""; });
  return settings;
}

async function sendViaMailgun(
  settings: Record<string, string>,
  req: SendRequest,
  maxRetries = 3
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
    req.tags.forEach(t => formData.append("o:tag", t));
  }

  if (req.campaign_id) formData.append("v:campaign_id", req.campaign_id);
  if (req.lead_id) formData.append("v:lead_id", req.lead_id);
  if (req.recipient_id) formData.append("v:recipient_id", req.recipient_id);

  const url = `${baseUrl}/v3/${domain}/messages`;
  const auth = btoa(`api:${MAILGUN_API_KEY}`);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: formData,
    });

    if (resp.status === 429) {
      // Rate limited — parse Retry-After or use exponential backoff
      const retryAfter = resp.headers.get("Retry-After");
      const waitMs = retryAfter
        ? Math.max(parseInt(retryAfter, 10) * 1000, 2000)
        : Math.min(2000 * Math.pow(2, attempt), 30000);
      console.log(`Rate limited, waiting ${waitMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    const data = await resp.json();
    if (!resp.ok) {
      // Check if it's a rate limit error in the body
      const msg = data.message || `Mailgun error ${resp.status}`;
      if (msg.includes("recipient limit exceeded") && attempt < maxRetries) {
        const waitMs = Math.min(5000 * Math.pow(2, attempt), 60000);
        console.log(`Recipient limit exceeded, waiting ${waitMs}ms (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      return { success: false, error: msg };
    }
    return { success: true, messageId: data.id };
  }

  return { success: false, error: "Max retries exceeded (rate limit)" };
}

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
    const settings = await getSettings(adminClient);

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

      const result = await sendViaMailgun(settings, {
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

      // Process in batches — default 200 per invocation
      const batchSize = reqBatchSize || 200;

      const { data: recipients } = await adminClient
        .from("email_campaign_recipients")
        .select("*")
        .eq("campaign_id", campaign_id)
        .eq("status", "pendente")
        .limit(batchSize);

      let enviados = 0;
      let erros = 0;
      let rateLimited = false;

      for (const r of (recipients || [])) {
        // Check suppression
        const { data: suppressed } = await adminClient
          .from("email_suppression_list").select("id").eq("email", r.email).limit(1);
        if (suppressed && suppressed.length > 0) {
          await adminClient.from("email_campaign_recipients")
            .update({ status: "suprimido", erro: "Email na lista de supressão" })
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
            })
            .eq("id", r.id);
          enviados++;
        } else {
          if (result.error?.includes("rate") || result.error?.includes("limit")) {
            rateLimited = true;
          }
          await adminClient.from("email_campaign_recipients")
            .update({ status: "erro", erro: result.error })
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

      // Count totals
      const { data: totals } = await adminClient
        .from("email_campaign_recipients")
        .select("status")
        .eq("campaign_id", campaign_id);

      const totalEnviados = totals?.filter(t => t.status === "enviado").length || 0;
      const totalErros = totals?.filter(t => t.status === "erro").length || 0;
      const totalPendentes = totals?.filter(t => t.status === "pendente").length || 0;

      const newStatus = totalPendentes === 0 ? "enviada" : "enviando";

      await adminClient.from("email_campaigns")
        .update({
          status: newStatus,
          total_enviados: totalEnviados,
          total_erros: totalErros,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);

      return jsonResponse({
        success: true,
        enviados,
        erros,
        pendentes: totalPendentes,
        rate_limited: rateLimited,
        status: newStatus,
      });
    }

    return errorResponse("mode deve ser 'single' ou 'campaign'", 400);
  } catch (err: any) {
    console.error("mailgun-send error:", err);
    return errorResponse(err.message || "Erro interno", 500);
  }
});
