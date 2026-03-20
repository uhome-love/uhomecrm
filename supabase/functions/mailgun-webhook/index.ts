import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mailgun event types we track
const TRACKED_EVENTS = [
  "delivered", "opened", "clicked", "failed",
  "bounced", "complained", "unsubscribed",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse webhook payload
    let eventData: any;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      eventData = await req.json();
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const obj: Record<string, any> = {};
      formData.forEach((value, key) => { obj[key] = value; });
      eventData = obj;
    } else {
      // Try JSON
      try { eventData = await req.json(); } catch { return errorResponse("Invalid payload", 400); }
    }

    // Mailgun sends events in "event-data" wrapper or flat
    const ed = eventData["event-data"] || eventData;
    const eventType = (ed.event || eventData.event || "").toLowerCase();

    if (!eventType || !TRACKED_EVENTS.includes(eventType)) {
      return jsonResponse({ ok: true, skipped: true, event: eventType });
    }

    const messageId = ed.message?.headers?.["message-id"] || ed["Message-Id"] || ed["message-id"] || "";
    const recipient = ed.recipient || eventData.recipient || "";
    const url = ed.url || eventData.url || null;
    const ip = ed.ip || eventData.ip || null;
    const userAgent = ed["user-agent"] || eventData["user-agent"] || null;

    // Custom variables from send
    const userVars = ed["user-variables"] || {};
    const campaignId = userVars.campaign_id || null;
    const leadId = userVars.lead_id || null;
    const recipientId = userVars.recipient_id || null;

    // 1. Store event
    await adminClient.from("email_events").insert({
      campaign_id: campaignId,
      recipient_id: recipientId,
      lead_id: leadId,
      mailgun_message_id: messageId,
      event_type: eventType,
      event_data: ed,
      url,
      ip,
      user_agent: userAgent,
    });

    // 2. Update recipient record
    if (recipientId) {
      const updates: Record<string, any> = {};
      switch (eventType) {
        case "delivered":
          updates.status = "entregue";
          updates.entregue_at = new Date().toISOString();
          break;
        case "opened":
          updates.status = "aberto";
          updates.aberto_at = new Date().toISOString();
          // Increment opens count
          const { data: rOpen } = await adminClient
            .from("email_campaign_recipients").select("aberturas").eq("id", recipientId).single();
          updates.aberturas = (rOpen?.aberturas || 0) + 1;
          break;
        case "clicked":
          updates.status = "clicado";
          updates.clicado_at = new Date().toISOString();
          const { data: rClick } = await adminClient
            .from("email_campaign_recipients").select("cliques").eq("id", recipientId).single();
          updates.cliques = (rClick?.cliques || 0) + 1;
          break;
        case "failed":
        case "bounced":
          updates.status = "bounce";
          updates.erro = ed["delivery-status"]?.description || ed.reason || "bounce";
          break;
        case "complained":
          updates.status = "complaint";
          break;
        case "unsubscribed":
          updates.status = "unsubscribe";
          break;
      }
      if (Object.keys(updates).length > 0) {
        await adminClient.from("email_campaign_recipients").update(updates).eq("id", recipientId);
      }
    }

    // 3. Update campaign metrics
    if (campaignId) {
      const metricField: Record<string, string> = {
        delivered: "total_entregues",
        opened: "total_aberturas",
        clicked: "total_cliques",
        failed: "total_erros",
        bounced: "total_bounces",
        complained: "total_bounces",
        unsubscribed: "total_unsubscribes",
      };
      const field = metricField[eventType];
      if (field) {
        const { data: camp } = await adminClient
          .from("email_campaigns").select(field).eq("id", campaignId).single();
        if (camp) {
          await adminClient.from("email_campaigns")
            .update({ [field]: (camp[field] || 0) + 1, updated_at: new Date().toISOString() })
            .eq("id", campaignId);
        }
      }
    }

    // 4. Handle suppression (bounce, complaint, unsubscribe)
    if (["bounced", "failed", "complained", "unsubscribed"].includes(eventType) && recipient) {
      const motivo = eventType === "unsubscribed" ? "unsubscribe"
        : eventType === "complained" ? "complaint" : "bounce";

      await adminClient.from("email_suppression_list").upsert(
        { email: recipient, motivo, origem: "webhook", campaign_id: campaignId },
        { onConflict: "email" }
      );
    }

    // 5. Register activity on lead timeline + notify corretor
    if (leadId) {
      const eventLabels: Record<string, { emoji: string; titulo: string; desc: string }> = {
        delivered: { emoji: "📬", titulo: "Email entregue", desc: "O email marketing foi entregue com sucesso." },
        opened: { emoji: "👀", titulo: "Email aberto", desc: "O lead abriu o email marketing." },
        clicked: { emoji: "🔗", titulo: "Clicou no email", desc: `O lead clicou em um link do email.${url ? ` URL: ${url}` : ""}` },
        bounced: { emoji: "⚠️", titulo: "Email com bounce", desc: "O email não foi entregue (bounce)." },
        failed: { emoji: "❌", titulo: "Falha na entrega do email", desc: ed["delivery-status"]?.description || "Falha na entrega." },
        complained: { emoji: "🚫", titulo: "Reclamação de spam", desc: "O lead marcou o email como spam." },
        unsubscribed: { emoji: "📭", titulo: "Descadastrou do email", desc: "O lead se descadastrou dos emails." },
      };

      const label = eventLabels[eventType];
      if (label) {
        // Get campaign name for context
        let campaignName = "";
        if (campaignId) {
          const { data: camp } = await adminClient
            .from("email_campaigns").select("nome").eq("id", campaignId).single();
          campaignName = camp?.nome || "";
        }

        const descFull = campaignName
          ? `${label.desc} Campanha: ${campaignName}`
          : label.desc;

        // Insert activity on lead timeline
        await adminClient.from("pipeline_atividades").insert({
          pipeline_lead_id: leadId,
          tipo: "email",
          titulo: `${label.emoji} ${label.titulo}`,
          descricao: descFull,
          status: "completed",
        });

        // Notify corretor for important events (opened, clicked, bounced, complained, unsubscribed)
        if (["opened", "clicked", "bounced", "complained", "unsubscribed"].includes(eventType)) {
          // Find the lead's corretor
          const { data: lead } = await adminClient
            .from("pipeline_leads")
            .select("corretor_id, nome")
            .eq("id", leadId)
            .single();

          if (lead?.corretor_id) {
            const leadNome = lead.nome || "Lead";
            const notifTitulo = `${label.emoji} ${leadNome} — ${label.titulo}`;
            const notifMsg = campaignName
              ? `${descFull}`
              : `${label.desc}`;

            await adminClient.from("notifications").insert({
              user_id: lead.corretor_id,
              tipo: "email_marketing",
              categoria: "lead",
              titulo: notifTitulo,
              mensagem: notifMsg,
              dados: { lead_id: leadId, campaign_id: campaignId, event_type: eventType, url },
            });
          }
        }
      }
    }

    console.log(`[mailgun-webhook] Processed ${eventType} for ${recipient}`);
    return jsonResponse({ ok: true, event: eventType });
  } catch (err: any) {
    console.error("[mailgun-webhook] Error:", err);
    return errorResponse(err.message, 500);
  }
});
