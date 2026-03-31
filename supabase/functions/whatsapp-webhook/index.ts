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

// ── Set 24h conversation window on a pipeline lead ──
async function setConversationWindow(supabase: any, leadId: string) {
  const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("pipeline_leads").update({ conversation_window_until: windowUntil }).eq("id", leadId);
  return windowUntil;
}

// ── Distribute lead via roleta ──
async function distributeViroleta(supabaseUrl: string, serviceKey: string, leadId: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ pipeline_lead_id: leadId }),
    });
    console.log(`🔄 Lead ${leadId} sent to roleta for distribution`);
  } catch (e) {
    console.error("Distribute lead failed:", e);
  }
}

Deno.serve(async (req) => {
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

  // ---------- POST: Status updates & messages from Meta ----------
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const entries = body?.entry || [];
      let updatedCount = 0;

      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value;
          if (!value) continue;

          // ── Process message statuses ──
          const statuses = value?.statuses || [];
          for (const status of statuses) {
            const waMessageId = status?.id;
            const statusType = status?.status;
            const timestamp = status?.timestamp;
            if (!waMessageId) continue;

            const ts = timestamp
              ? new Date(parseInt(timestamp) * 1000).toISOString()
              : new Date().toISOString();

            const updateData: Record<string, string> = {};
            switch (statusType) {
              case "sent": updateData.status_envio = "sent"; break;
              case "delivered": updateData.status_envio = "delivered"; updateData.delivered_at = ts; break;
              case "read": updateData.status_envio = "read"; updateData.read_at = ts; break;
              case "failed":
                updateData.status_envio = "failed";
                updateData.error_message = status?.errors?.[0]?.title || "Meta delivery failed";
                break;
              default: continue;
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

            // Notify orchestrator on read
            if (statusType === "read") {
              const { data: sendRecord } = await supabase
                .from("whatsapp_campaign_sends")
                .select("pipeline_lead_id")
                .eq("message_id", waMessageId)
                .maybeSingle();
              if (sendRecord?.pipeline_lead_id) {
                notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_lido", sendRecord.pipeline_lead_id, "whatsapp");
              }
            }
          }

          // ── Process incoming messages (replies) ──
          const messages = value?.messages || [];
          const contacts = value?.contacts || [];

          for (const msg of messages) {
            const from = msg?.from;
            if (!from) continue;

            const contactName = contacts.find((c: any) => c.wa_id === from)?.profile?.name || null;

            // Parse message content
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

            // Save to whatsapp_respostas
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

            // Update campaign send status to "replied"
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

            // ── BLOCO 1+2: Process lead reply with 24h window + oferta ativa re-entry ──
            const sendRecord = updatedSends?.[0];
            const leadId = sendRecord?.pipeline_lead_id;

            if (leadId) {
              // Found via campaign sends → existing pipeline lead
              await handleExistingLeadReply(supabase, supabaseUrl, serviceKey, leadId, from, mensagemTexto, msg, sendRecord, contactName);
            } else {
              // No campaign send found → search pipeline_leads by phone
              await handleUnknownReply(supabase, supabaseUrl, serviceKey, from, mensagemTexto, msg, contactName);
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
      return new Response(
        JSON.stringify({ ok: true, error: "internal" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});

// ── Handle reply from a known pipeline lead ──
async function handleExistingLeadReply(
  supabase: any, supabaseUrl: string, serviceKey: string,
  leadId: string, from: string, mensagemTexto: string, msg: any,
  sendRecord: any, contactName: string | null
) {
  const { data: lead } = await supabase
    .from("pipeline_leads")
    .select("id, nome, empreendimento, corretor_id, observacoes")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return;

  const leadNome = lead.nome || "Lead";
  const msgText = mensagemTexto || msg?.type || "mensagem";

  // Set 24h conversation window
  const windowUntil = await setConversationWindow(supabase, lead.id);

  let campanhaLabel = "WhatsApp";
  if (sendRecord?.batch_id) {
    const { data: batch } = await supabase
      .from("whatsapp_campaign_batches")
      .select("nome, campanha")
      .eq("id", sendRecord.batch_id)
      .maybeSingle();
    if (batch) campanhaLabel = batch.nome || batch.campanha || "WhatsApp";
  }

  // Notify corretor with 24h window info
  if (lead.corretor_id) {
    await supabase.from("notifications").insert({
      user_id: lead.corretor_id,
      titulo: `🔔 NOVO INTERESSE: MENSAGEM WHATSAPP ${campanhaLabel.toUpperCase()}`,
      mensagem: `${leadNome} respondeu à campanha "${campanhaLabel}". Mensagem: "${msgText.slice(0, 100)}". ✅ Janela 24h aberta — pode enviar mensagem livre até ${new Date(windowUntil).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Entre em contato agora!`,
      tipo: "lead_reengajado",
      categoria: "leads",
      dados: { pipeline_lead_id: lead.id, campanha: campanhaLabel, tipo_interesse: "whatsapp_reply", janela_24h: windowUntil },
    });
    console.log(`📩 Corretor ${lead.corretor_id} notified about reply from ${leadNome} (24h window open)`);
  }

  // Timeline entry
  await supabase.from("pipeline_atividades").insert({
    pipeline_lead_id: lead.id,
    tipo: "whatsapp",
    titulo: `📩 Resposta WhatsApp — ${campanhaLabel}`,
    descricao: `Lead respondeu à campanha "${campanhaLabel}": "${msgText.slice(0, 200)}". Janela 24h aberta.`,
    data: new Date().toISOString().slice(0, 10),
    status: "concluida",
    responsavel_id: lead.corretor_id || null,
  });

  // Update observacoes
  const newObs = `[${new Date().toISOString().slice(0, 16)}] 📩 Resposta WhatsApp (${campanhaLabel}): "${msgText.slice(0, 200)}" | ✅ Janela 24h aberta`;
  const mergedObs = lead.observacoes ? `${lead.observacoes}\n---\n${newObs}` : newObs;
  await supabase.from("pipeline_leads").update({ observacoes: mergedObs }).eq("id", lead.id);

  // Notify orchestrator
  notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_respondeu", lead.id, "whatsapp");
}

// ── Handle reply from unknown sender — search pipeline_leads, then oferta_ativa ──
async function handleUnknownReply(
  supabase: any, supabaseUrl: string, serviceKey: string,
  from: string, mensagemTexto: string, msg: any, contactName: string | null
) {
  const msgText = mensagemTexto || msg?.type || "mensagem";

  // 1. Search pipeline_leads by normalized phone
  const { data: existingLeads } = await supabase
    .from("pipeline_leads")
    .select("id, nome, corretor_id, empreendimento")
    .or(`telefone.eq.${from},telefone.like.%${from.slice(-10)}%`)
    .limit(1);

  if (existingLeads && existingLeads.length > 0) {
    const lead = existingLeads[0];
    // Found in pipeline → set window + notify corretor
    const windowUntil = await setConversationWindow(supabase, lead.id);

    if (lead.corretor_id) {
      await supabase.from("notifications").insert({
        user_id: lead.corretor_id,
        titulo: `📩 ${lead.nome || "Lead"} respondeu WhatsApp`,
        mensagem: `"${msgText.slice(0, 100)}". ✅ Janela 24h aberta — pode enviar mensagem livre. Entre em contato agora!`,
        tipo: "lead_reengajado",
        categoria: "leads",
        dados: { pipeline_lead_id: lead.id, tipo_interesse: "whatsapp_reply", janela_24h: windowUntil },
      });
    }

    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: lead.id,
      tipo: "whatsapp",
      titulo: `📩 Resposta WhatsApp espontânea`,
      descricao: `Lead respondeu: "${msgText.slice(0, 200)}". Janela 24h aberta.`,
      data: new Date().toISOString().slice(0, 10),
      status: "concluida",
      responsavel_id: lead.corretor_id || null,
    });

    notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_respondeu", lead.id, "whatsapp");
    console.log(`📩 Found existing lead ${lead.id} by phone, 24h window set`);
    return;
  }

  // 2. Search oferta_ativa_leads by phone
  const { data: ofertaLeads } = await supabase
    .from("oferta_ativa_leads")
    .select("id, nome, telefone, email, empreendimento, segmento_id")
    .or(`telefone.eq.${from},telefone.like.%${from.slice(-10)}%`)
    .limit(1);

  if (ofertaLeads && ofertaLeads.length > 0) {
    const oaLead = ofertaLeads[0];
    console.log(`🔄 Lead from Oferta Ativa responding: ${oaLead.nome} — creating pipeline lead and distributing`);

    // Get first active stage for the segment
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("tipo", "novo")
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Create new pipeline_lead
    const { data: newLead, error: createErr } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: oaLead.nome || contactName || "Lead Reativado",
        telefone: oaLead.telefone || from,
        email: oaLead.email || null,
        empreendimento: oaLead.empreendimento || null,
        segmento_id: oaLead.segmento_id || null,
        origem: "reativacao_nutricao",
        stage_id: firstStage?.id || null,
        stage_changed_at: new Date().toISOString(),
        conversation_window_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        observacoes: `🔄 Lead reativado via nutrição WhatsApp. Respondeu: "${msgText.slice(0, 200)}"`,
      })
      .select("id")
      .single();

    if (createErr) {
      console.error("Error creating pipeline lead from oferta ativa:", createErr.message);
      return;
    }

    // Timeline entry
    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: newLead.id,
      tipo: "nurturing_sequencia",
      titulo: `🔄 Lead reativado pela nutrição`,
      descricao: `Lead da Oferta Ativa respondeu WhatsApp: "${msgText.slice(0, 200)}". Enviado para roleta de distribuição.`,
      data: new Date().toISOString().slice(0, 10),
      status: "concluida",
    });

    // Distribute via roleta
    await distributeViroleta(supabaseUrl, serviceKey, newLead.id);

    // Notify orchestrator
    notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_respondeu", newLead.id, "whatsapp");
    return;
  }

  // 3. Not found anywhere → create new lead and distribute
  console.log(`🆕 Unknown sender ${from} — creating new lead and distributing`);

  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("tipo", "novo")
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: newLead, error: createErr } = await supabase
    .from("pipeline_leads")
    .insert({
      nome: contactName || "Lead WhatsApp",
      telefone: from,
      origem: "whatsapp_inbound",
      stage_id: firstStage?.id || null,
      stage_changed_at: new Date().toISOString(),
      conversation_window_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      observacoes: `Lead criado a partir de mensagem WhatsApp: "${msgText.slice(0, 200)}"`,
    })
    .select("id")
    .single();

  if (!createErr && newLead) {
    await distributeViroleta(supabaseUrl, serviceKey, newLead.id);
    notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_respondeu", newLead.id, "whatsapp");
  }
}
