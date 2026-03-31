import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Notify orchestrator for lead scoring ──
async function notifyOrchestrator(supabaseUrl: string, serviceKey: string, event_type: string, pipeline_lead_id: string, canal: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/nurturing-orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ event_type, pipeline_lead_id, canal }),
    });
  } catch (e) {
    console.error("Orchestrator notify failed:", e);
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ---------- GET: Meta webhook verification ----------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ Webhook verified");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ---------- POST: Status updates from Meta ----------
  if (req.method === "POST") {
    try {
      const body = await req.json();

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const entries = body?.entry || [];
      let updatedCount = 0;

      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value;
          if (!value) continue;

          // Process message statuses
          const statuses = value?.statuses || [];
          for (const status of statuses) {
            const waMessageId = status?.id;
            const statusType = status?.status; // sent, delivered, read, failed
            const timestamp = status?.timestamp;

            if (!waMessageId) continue;

            const ts = timestamp
              ? new Date(parseInt(timestamp) * 1000).toISOString()
              : new Date().toISOString();

            const updateData: Record<string, string> = {};

            switch (statusType) {
              case "sent":
                updateData.status_envio = "sent";
                break;
              case "delivered":
                updateData.status_envio = "delivered";
                updateData.delivered_at = ts;
                break;
              case "read":
                updateData.status_envio = "read";
                updateData.read_at = ts;
                break;
              case "failed":
                updateData.status_envio = "failed";
                updateData.error_message =
                  status?.errors?.[0]?.title || "Meta delivery failed";
                break;
              default:
                continue;
            }

            const { error } = await supabase
              .from("whatsapp_campaign_sends")
              .update(updateData)
              .eq("message_id", waMessageId);

            if (error) {
              console.error(`❌ Error updating ${waMessageId}:`, error.message);
            } else {
              updatedCount++;
            }

            // ── Notify orchestrator on read status ──
            if (statusType === "read") {
              const { data: sendRecord } = await supabase
                .from("whatsapp_campaign_sends")
                .select("pipeline_lead_id")
                .eq("message_id", waMessageId)
                .maybeSingle();
              if (sendRecord?.pipeline_lead_id) {
                const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
                const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_lido", sendRecord.pipeline_lead_id, "whatsapp");
              }
            }
          }

          // Process incoming messages (replies)
          const messages = value?.messages || [];
          const contacts = value?.contacts || [];

          for (const msg of messages) {
            const from = msg?.from; // e.g. "5551999990000"
            if (!from) continue;

            const contactName = contacts.find((c: any) => c.wa_id === from)?.profile?.name || null;

            // ── Save to whatsapp_respostas ──
            let mensagemTexto = "";
            let tipoMsg = "texto";
            let formPhone: string | null = null;
            let formEmail: string | null = null;

            if (msg.type === "text" && msg.text?.body) {
              mensagemTexto = msg.text.body;
              tipoMsg = "texto";
            } else if (msg.type === "interactive" && msg.interactive?.type === "nfm_reply") {
              tipoMsg = "formulario";
              try {
                const responseJson = JSON.parse(msg.interactive.nfm_reply?.response_json || "{}");
                formPhone = responseJson.phone || responseJson.telefone || null;
                formEmail = responseJson.email || null;
                mensagemTexto = JSON.stringify(responseJson);
              } catch {
                mensagemTexto = msg.interactive.nfm_reply?.response_json || "";
              }
            } else if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
              mensagemTexto = msg.interactive.button_reply?.title || "";
              tipoMsg = "botao";
            } else if (["image", "document", "audio", "video"].includes(msg.type)) {
              mensagemTexto = msg[msg.type]?.caption || `[${msg.type}]`;
              tipoMsg = msg.type;
            } else if (msg.type === "reaction") {
              mensagemTexto = msg.reaction?.emoji || "👍";
              tipoMsg = "reaction";
            } else {
              mensagemTexto = JSON.stringify(msg);
              tipoMsg = msg.type || "desconhecido";
            }

            const { error: insertErr } = await supabase.from("whatsapp_respostas").insert({
              phone: from,
              nome: contactName,
              mensagem: mensagemTexto,
              tipo: tipoMsg,
              payload_raw: msg,
              form_phone: formPhone,
              form_email: formEmail,
            });
            if (insertErr) {
              console.error(`❌ Error saving whatsapp_respostas:`, insertErr.message);
            } else {
              console.log(`📥 Saved response from ${from} (${tipoMsg})`);
            }

            // ── Update campaign send status to "replied" ──
            const { data: updatedSends, error } = await supabase
              .from("whatsapp_campaign_sends")
              .update({
                status_envio: "replied",
                replied_at: new Date().toISOString(),
              })
              .eq("telefone_normalizado", from)
              .in("status_envio", ["sent", "delivered", "read"])
              .order("sent_at", { ascending: false })
              .limit(1)
              .select("id, pipeline_lead_id, batch_id");

            if (!error) updatedCount++;

            // ── Notify corretor & update lead history on reply ──
            const sendRecord = updatedSends?.[0];
            const leadId = sendRecord?.pipeline_lead_id;

            if (leadId) {
              const { data: lead } = await supabase
                .from("pipeline_leads")
                .select("id, nome, empreendimento, corretor_id, observacoes")
                .eq("id", leadId)
                .maybeSingle();

              if (lead) {
                const leadNome = lead.nome || "Lead";
                const msgText = mensagemTexto || msg?.type || "mensagem";

                let campanhaLabel = "WhatsApp";
                if (sendRecord?.batch_id) {
                  const { data: batch } = await supabase
                    .from("whatsapp_campaign_batches")
                    .select("nome, campanha")
                    .eq("id", sendRecord.batch_id)
                    .maybeSingle();
                  if (batch) campanhaLabel = batch.nome || batch.campanha || "WhatsApp";
                }

                if (lead.corretor_id) {
                  await supabase.from("notifications").insert({
                    user_id: lead.corretor_id,
                    titulo: `🔔 NOVO INTERESSE: MENSAGEM WHATSAPP ${campanhaLabel.toUpperCase()}`,
                    mensagem: `${leadNome} respondeu à campanha "${campanhaLabel}". Mensagem: "${msgText.slice(0, 100)}". Entre em contato agora!`,
                    tipo: "lead_reengajado",
                    categoria: "leads",
                    dados: { pipeline_lead_id: lead.id, campanha: campanhaLabel, tipo_interesse: "whatsapp_reply" },
                  });
                  console.log(`📩 Corretor ${lead.corretor_id} notified about reply from ${leadNome}`);
                }

                await supabase.from("pipeline_atividades").insert({
                  pipeline_lead_id: lead.id,
                  tipo: "whatsapp",
                  titulo: `📩 Resposta WhatsApp — ${campanhaLabel}`,
                  descricao: `Lead respondeu à campanha "${campanhaLabel}": "${msgText.slice(0, 200)}"`,
                  data: new Date().toISOString().slice(0, 10),
                  status: "concluida",
                  responsavel_id: lead.corretor_id || null,
                });

                const newObs = `[${new Date().toISOString().slice(0, 16)}] 📩 Resposta WhatsApp (${campanhaLabel}): "${msgText.slice(0, 200)}"`;
                const mergedObs = lead.observacoes
                  ? `${lead.observacoes}\n---\n${newObs}`
                  : newObs;
                await supabase.from("pipeline_leads")
                  .update({ observacoes: mergedObs })
                  .eq("id", lead.id);

                console.log(`✅ Lead ${lead.id} history updated with reply`);

                // ── Notify orchestrator: lead replied ──
                const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
                const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_respondeu", lead.id, "whatsapp");
              }
            }
          }
        }
      }

      console.log(`✅ Webhook processed: ${updatedCount} updates`);
      return new Response(
        JSON.stringify({ ok: true, updated: updatedCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("❌ Webhook error:", err);
      // Always return 200 to Meta even on errors
      return new Response(
        JSON.stringify({ ok: true, error: "internal" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
