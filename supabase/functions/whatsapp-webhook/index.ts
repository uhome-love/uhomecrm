import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Call whatsapp-ai-reply for new leads ──
async function callAIReply(supabaseUrl: string, serviceKey: string, telefone: string, nome_contato: string, mensagem: string, lead_id: string, tipo_mensagem: string) {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ telefone, nome_contato, mensagem, lead_id, tipo_mensagem }),
    });
    const result = await resp.json();
    console.log(`🤖 AI reply result for ${telefone}:`, result?.ok ? "sent" : result?.error || "unknown");
  } catch (e) {
    console.error("AI reply call failed:", e);
  }
}

// ── Log to whatsapp_ai_log ──
async function logWhatsAppEntry(supabase: any, data: Record<string, unknown>) {
  try {
    await supabase.from("whatsapp_ai_log").insert(data);
  } catch (e) {
    console.error("whatsapp_ai_log insert failed:", e);
  }
}

// ── Notify orchestrator for lead scoring ──
async function notifyOrchestrator(supabaseUrl: string, serviceKey: string, event_type: string, pipeline_lead_id: string, canal: string, metadata?: Record<string, any>) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/nurturing-orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ event_type, pipeline_lead_id, canal, metadata }),
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
function isNegativeIntent(text: string): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (/^(n[aã]o|n|nop|nao quero|n[aã]o quero|n[aã]o tenho interesse|sem interesse|j[aá] comprei|stop|cancela|cancelar|para|parar|remover|sair|descadastrar)\b/.test(t)) return true;
  if (/\b(n[aã]o\s+tenho\s+interesse|sem\s+interesse|n[aã]o\s+me\s+interess|n[aã]o\s+tenho\s+mais\s+interesse|por\s+hora\s+n[aã]o|por\s+enquanto\s+n[aã]o|n[aã]o\s+posso|n[aã]o\s+quero\s+mais|j[aá]\s+comprei|j[aá]\s+fechei|n[aã]o\s+sou\s+eu|n[aã]o\s+conhe[çc]o|n[aã]o\s+vou\s+(querer|comprar)|desisti|n[aã]o\s+pretendo)\b/.test(t)) return true;
  return false;
}

function isPositiveIntent(text: string): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  if (!t) return false;
  // SHORT-CIRCUIT: se há intenção negativa explícita, nunca é positivo (cobre "não tenho interesse")
  if (isNegativeIntent(t)) return false;
  // Botões/respostas curtas claras
  if (/^(sim|s|claro|quero|quero sim|tenho interesse|interessado|interessada|pode enviar|pode mandar|aceito|👍|✅|🙏|ok|okay|bora|vamos|positivo|afirmativo|com certeza|certeza|gostaria|me interessa|sim por favor|sim, por favor|sim quero|sim pode)\b/.test(t)) return true;
  // Frases que indicam interesse claro — exigem que NÃO haja negação dos 25 chars anteriores
  const POS_PHRASES = /\b(quero saber|quero conhecer|tenho interesse|me interessei|gostaria de saber|gostaria de conhecer|gostaria de mais informa|pode me enviar|pode me passar|me envia|me manda|manda a|envia a|me chama)\b/g;
  let m: RegExpExecArray | null;
  while ((m = POS_PHRASES.exec(t)) !== null) {
    const start = Math.max(0, m.index - 25);
    const before = t.slice(start, m.index);
    if (!/\b(n[aã]o|sem|nem|jamais|nunca)\b/.test(before)) return true;
  }
  return false;
}

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

            // ── Reengajamento Meta: atualiza disparo pelo wamid ──
            const metaPatch: Record<string, unknown> = {};
            if (statusType === "sent") metaPatch.status = "sent";
            if (statusType === "delivered") { metaPatch.status = "delivered"; metaPatch.delivered_at = ts; }
            if (statusType === "read") { metaPatch.status = "read"; metaPatch.read_at = ts; }
            if (statusType === "failed") { metaPatch.status = "failed"; metaPatch.error_text = status?.errors?.[0]?.title || "Meta delivery failed"; }
            if (Object.keys(metaPatch).length > 0) {
              await supabase
                .from("reengajamento_meta_disparos")
                .update(metaPatch)
                .eq("wamid", waMessageId);
            }

            // ── Lista de supressão automática (proteção de qualidade do número) ──
            // 131049 = "healthy ecosystem engagement" (throttle Meta) → cooldown 30d
            // 131026 = "Message undeliverable" (número sem WhatsApp) → permanente
            // 131050 = recipient parou de receber marketing (opt-out) → permanente
            // 130472 = "User's number is part of an experiment" → cooldown 7d
            if (statusType === "failed") {
              const errObj = status?.errors?.[0] || {};
              const code = String(errObj?.code ?? "");
              const title = String(errObj?.title || errObj?.message || "");
              const recipient = String(status?.recipient_id || "").replace(/\D/g, "");
              const last8 = recipient.length >= 8 ? recipient.slice(-8) : recipient;
              const isOptOut = /stop receiving marketing|opt[\s-]?out/i.test(title) || code === "131050";
              const isUndeliverable = code === "131026" || /undeliverable/i.test(title);
              const isEcosystem = code === "131049" || /healthy ecosystem/i.test(title);
              const isExperiment = code === "130472" || /experiment/i.test(title);

              if (recipient && last8 && (isOptOut || isUndeliverable || isEcosystem || isExperiment)) {
                // Parâmetros de retry/cooldown configuráveis
                const { data: cfgRetry } = await supabase
                  .from("reengajamento_config")
                  .select("retry_131049_dias, retry_max_tentativas")
                  .limit(1)
                  .maybeSingle();
                const retryDias = Math.max(1, Number((cfgRetry as any)?.retry_131049_dias ?? 5));
                const retryMax = Math.max(1, Number((cfgRetry as any)?.retry_max_tentativas ?? 3));

                // Resolve template para auditoria
                const { data: disp } = await supabase
                  .from("reengajamento_meta_disparos")
                  .select("template_name")
                  .eq("wamid", waMessageId)
                  .maybeSingle();

                const { data: existing } = await supabase
                  .from("meta_supressao")
                  .select("id, ocorrencias, suprimir_ate")
                  .eq("telefone_last8", last8)
                  .maybeSingle();

                const newOcorr = (existing?.ocorrencias || 0) + 1;
                const jaPermanente = existing && existing.suprimir_ate === null;

                // Define código/motivo/janela conforme o tipo de falha
                let suprimirAte: string | null = null; // null = permanente
                let motivo = title || "Falha Meta";
                let codigoSup = code || null;
                if (isUndeliverable) { motivo = "Número indisponível no WhatsApp (131026)"; codigoSup = "undeliverable"; }
                else if (isOptOut) { motivo = "Recusou marketing (opt-out)"; codigoSup = "opt_out"; }
                else if (isEcosystem) {
                  // 131049 NÃO é descarte: retry agendado até esgotar tentativas → aí permanente.
                  codigoSup = "throttle_131049";
                  if (newOcorr >= retryMax) {
                    suprimirAte = null;
                    motivo = `Throttle Meta 131049 — descartado após ${newOcorr} tentativas`;
                  } else {
                    suprimirAte = new Date(Date.now() + retryDias * 24 * 3600 * 1000).toISOString();
                    motivo = `Throttle Meta 131049 — retry agendado (tentativa ${newOcorr}/${retryMax})`;
                  }
                }
                else if (isExperiment) {
                  codigoSup = "experiment_130472";
                  suprimirAte = new Date(Date.now() + retryDias * 24 * 3600 * 1000).toISOString();
                  motivo = "Número em experimento Meta (130472) — retry agendado";
                }

                if (existing) {
                  // Nunca rebaixa um bloqueio permanente para cooldown
                  const finalSuprimirAte = jaPermanente ? null : suprimirAte;
                  await supabase.from("meta_supressao").update({
                    codigo: codigoSup,
                    motivo: jaPermanente ? (existing as any).motivo ?? motivo : motivo,
                    template_name: disp?.template_name || null,
                    suprimir_ate: finalSuprimirAte,
                    ocorrencias: newOcorr,
                  }).eq("id", existing.id);
                } else {
                  await supabase.from("meta_supressao").insert({
                    telefone: recipient, telefone_last8: last8, codigo: codigoSup,
                    motivo, template_name: disp?.template_name || null, suprimir_ate: suprimirAte,
                    ocorrencias: 1,
                  });
                }
              }
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
            } else if (msg.type === "button") {
              mensagemTexto = msg.button?.text || msg.button?.payload || "";
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

            // ── Reengajamento Meta: detecta resposta a template de nutrição via context.id (wamid original) ──
            const repliedToWamid = msg?.context?.id || null;
            const buttonId = msg?.interactive?.button_reply?.id || msg?.button?.payload || null;
            const buttonTitle = msg?.interactive?.button_reply?.title || msg?.button?.text || "";

            // ── Campanha Átrio: verifica se wamid ou telefone bate com evento Átrio recente ──
            try {
              let atrioMatch: any = null;
              if (repliedToWamid) {
                const { data } = await supabase
                  .from("campanha_atrio_eventos")
                  .select("id, lead_id")
                  .eq("mensagem_id_meta", repliedToWamid)
                  .maybeSingle();
                if (data) atrioMatch = data;
              }
              if (!atrioMatch) {
                const last8 = (from || "").replace(/\D/g, "").slice(-8);
                if (last8.length === 8) {
                  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                  const { data } = await supabase
                    .from("campanha_atrio_eventos")
                    .select("id, lead_id, enviado_em")
                    .eq("status_envio", "sucesso")
                    .gte("enviado_em", cutoff)
                    .ilike("telefone", `%${last8}`)
                    .order("enviado_em", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (data) atrioMatch = data;
                }
              }
              if (atrioMatch) {
                console.log(`🏛️ Átrio match: forwarding to processar-resposta (lead=${atrioMatch.lead_id})`);
                await fetch(`${supabaseUrl}/functions/v1/campanha-atrio-processar-resposta`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
                  body: JSON.stringify({ wamid: repliedToWamid, from, message: msg }),
                });
                continue;
              }
            } catch (e) {
              console.error("Átrio branch error", e);
            }

            // ── Visita Amanhã: detecta resposta ao template visita_amanha_v1 ──
            // Match por wamid (preferido) OU por telefone (últimos 8 dígitos, últimas 48h) — alguns clientes
            // não enviam context.id em button_reply, e o "from" do WhatsApp pode vir sem o "9" do celular.
            const isButtonReply = !!buttonId || !!buttonTitle;
            const isTextResponse = !!mensagemTexto && !isButtonReply;
            let vaDispatch: { id: string; pipeline_lead_id: string; phone: string | null } | null = null;

            if (repliedToWamid) {
              const { data } = await supabase
                .from("visita_amanha_disparos")
                .select("id, pipeline_lead_id, phone")
                .eq("wamid", repliedToWamid)
                .maybeSingle();
              if (data) vaDispatch = data;
            }

            // Fallback por telefone se não achou via wamid (e a mensagem tem cara de resposta ao template)
            if (!vaDispatch && (isButtonReply || isTextResponse)) {
              const last8 = (from || "").replace(/\D/g, "").slice(-8);
              if (last8.length === 8) {
                const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
                const { data } = await supabase
                  .from("visita_amanha_disparos")
                  .select("id, pipeline_lead_id, phone, sent_at")
                  .ilike("phone", `%${last8}`)
                  .eq("status", "sent")
                  .gte("sent_at", cutoff)
                  .order("sent_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (data) {
                  vaDispatch = { id: data.id, pipeline_lead_id: data.pipeline_lead_id, phone: data.phone };
                  console.log(`📅 Visita Amanhã: match por TELEFONE (last8=${last8}) lead=${data.pipeline_lead_id}`);
                }
              }
            }

            if (vaDispatch) {
              let vaResp: "sim" | "nao" | null = null;
              if (buttonId || buttonTitle) {
                if (/sim|yes|quero/i.test(buttonId || "") || /sim|quero/i.test(buttonTitle)) vaResp = "sim";
                else if (/nao|não|no|agora/i.test(buttonId || "") || /n[aã]o|agora/i.test(buttonTitle)) vaResp = "nao";
              } else if (mensagemTexto) {
                const t = mensagemTexto.trim().toLowerCase();
                if (/^(sim|quero|claro|👍|✅|s)\b/.test(t)) vaResp = "sim";
                else if (/^(n[aã]o|agora\s*n|n\.?$)/.test(t) && t.length < 60) vaResp = "nao";
              }

              // Buscar status atual para NÃO sobrescrever resposta SIM já registrada
              const { data: currentDispatch } = await supabase
                .from("visita_amanha_disparos")
                .select("status")
                .eq("id", vaDispatch.id)
                .maybeSingle();
              const currentStatus = currentDispatch?.status;

              // Regra: SIM sempre vence. NÃO só registra se ainda está em 'sent' ou 'outro'.
              // Qualquer outra coisa só registra se ainda está em 'sent'.
              const shouldUpdate =
                vaResp === "sim" ||
                (vaResp === "nao" && (currentStatus === "sent" || currentStatus === "outro")) ||
                (!vaResp && currentStatus === "sent");

              if (!shouldUpdate) {
                console.log(`📅 Visita Amanhã: SKIP update (current=${currentStatus}, novo=${vaResp || "outro"}) — SIM preservado.`);
                continue;
              }

              await supabase.from("visita_amanha_disparos").update({
                status: vaResp || "outro",
                resposta_at: new Date().toISOString(),
              }).eq("id", vaDispatch.id);

              await supabase.from("pipeline_leads").update({
                visita_amanha_resposta: vaResp,
              }).eq("id", vaDispatch.pipeline_lead_id);

              // Busca dados do lead para notificação + atividade
              const { data: leadData } = await supabase
                .from("pipeline_leads")
                .select("id, nome, corretor_id")
                .eq("id", vaDispatch.pipeline_lead_id)
                .maybeSingle();

              if (vaResp === "sim" && leadData) {
                await supabase.from("pipeline_atividades").insert({
                  pipeline_lead_id: leadData.id,
                  tipo: "sistema",
                  titulo: "🔥 Cliente quer visitar AMANHÃ",
                  descricao: `Cliente respondeu SIM ao convite de visita amanhã via WhatsApp. Entre em contato para confirmar o horário.`,
                  data: new Date().toISOString().slice(0, 10),
                  status: "pendente",
                  prioridade: "alta",
                });

                if (leadData.corretor_id) {
                  const { data: prof } = await supabase
                    .from("profiles")
                    .select("user_id")
                    .eq("id", leadData.corretor_id)
                    .maybeSingle();
                  const targetUserId = prof?.user_id || leadData.corretor_id;

                  await supabase.from("notifications").insert({
                    user_id: targetUserId,
                    tipo: "visita_amanha_sim",
                    categoria: "lead",
                    titulo: "🔥 Visita amanhã!",
                    mensagem: `${leadData.nome} quer visitar amanhã. Entre em contato para marcar o horário.`,
                    dados: { pipeline_lead_id: leadData.id, lead_nome: leadData.nome },
                  });

                  try {
                    await supabase.functions.invoke("send-push", {
                      body: {
                        user_id: targetUserId,
                        title: "🔥 Visita amanhã!",
                        body: `${leadData.nome} quer visitar amanhã.`,
                        url: `/pipeline?lead=${leadData.id}`,
                      },
                    });
                  } catch (e) {
                    console.error("send-push visita_amanha error:", e);
                  }
                }
              } else if (vaResp === "nao" && leadData) {
                await supabase.from("pipeline_atividades").insert({
                  pipeline_lead_id: leadData.id,
                  tipo: "sistema",
                  titulo: "❌ Cliente não pode visitar amanhã",
                  descricao: `Cliente respondeu "Agora não" ao convite de visita amanhã via WhatsApp. Lead permanece na etapa atual.`,
                  data: new Date().toISOString().slice(0, 10),
                  status: "concluida",
                });
              }

              console.log(`📅 Visita Amanhã: lead ${vaDispatch.pipeline_lead_id} → ${vaResp || "outro"}`);
              continue;
            }

            if (repliedToWamid) {
              const { data: metaDispatch } = await supabase
                .from("reengajamento_meta_disparos")
                .select("id, lead_id, run_id, audience_source, template_name")
                .eq("wamid", repliedToWamid)
                .maybeSingle();

              if (metaDispatch) {
                // Classifica botão ou texto
                let buttonResp: "sim" | "nao" | null = null;
                if (buttonId) {
                  if (/sim|yes/i.test(buttonId) || /sim|quero/i.test(buttonTitle)) buttonResp = "sim";
                  else if (/nao|não|no/i.test(buttonId) || /n[aã]o/i.test(buttonTitle)) buttonResp = "nao";
                } else if (mensagemTexto) {
                  const t = mensagemTexto.trim().toLowerCase();
                  if (/^(sim|quero|claro|👍|✅|🙏|s)\b/.test(t)) buttonResp = "sim";
                  else if (/^(n[aã]o|n\.?$|j[aá]\s*comprei|stop|cancela|para)/.test(t) && t.length < 60) buttonResp = "nao";
                }

                await supabase.from("reengajamento_meta_disparos").update({
                  status: "responded",
                  responded_at: new Date().toISOString(),
                  button_response: buttonResp,
                  response_text: mensagemTexto.slice(0, 1000),
                }).eq("id", metaDispatch.id);

                const { data: currentLead } = await supabase
                  .from("pipeline_leads")
                  .select("id, nome, corretor_id, reengajamento_status, reativado_por_nutricao")
                  .eq("id", metaDispatch.lead_id)
                  .maybeSingle();

                const alreadyReactivated = !!currentLead?.reativado_por_nutricao
                  || currentLead?.reengajamento_status === "respondeu_sim"
                  || currentLead?.reengajamento_status === "respondeu_sim_wave2";
                if (alreadyReactivated) {
                  console.log(`ℹ️ Ignorando reclassificação tardia do lead ${metaDispatch.lead_id} após reativação`);
                  continue;
                }

                // Detecta se a resposta é à 2ª onda (status enviado_wave2)
                const isWave2 = currentLead?.reengajamento_status === "enviado_wave2";
                const statusNao = isWave2 ? "respondeu_nao_wave2" : "respondeu_nao";
                const statusOutro = isWave2 ? "respondeu_outro_wave2" : "respondeu_outro";

                await supabase.from("reengajamento_eventos").insert({
                  lead_id: metaDispatch.lead_id,
                  run_id: metaDispatch.run_id,
                  tipo: buttonResp === "sim" ? (isWave2 ? "classificado_sim_wave2" : "classificado_sim")
                       : buttonResp === "nao" ? (isWave2 ? "classificado_nao_wave2" : "classificado_nao")
                       : (isWave2 ? "classificado_outro_wave2" : "classificado_outro"),
                  detalhe: (buttonId ? `[botão] ${buttonTitle}` : mensagemTexto).slice(0, 500),
                });

                // ── ROTEAMENTO POR ORIGEM DO DISPARO ──
                // descartados / oferta_ativa_lista / legacy → reativa e manda pra roleta
                // pipeline_ativo / visita_amanha → mantém corretor, só notifica
                const audSrc = String(metaDispatch.audience_source || "legacy");
                const routeToRoleta = audSrc === "descartados" || audSrc === "oferta_ativa_lista" || audSrc === "legacy";
                const justNotifyCorretor = audSrc === "pipeline_ativo" || audSrc === "visita_amanha";

                // Reativa lead se respondeu SIM E origem permite reengajamento → SEMPRE Fila do CEO
                if (buttonResp === "sim" && routeToRoleta) {
                  const tplName = metaDispatch.template_name || "reengajamento";
                  // ID efetivo do lead no pipeline (pode mudar se a origem for Oferta Ativa)
                  let effectiveLeadId = metaDispatch.lead_id;
                  try {
                    if (!currentLead) {
                      // Lead não existe no pipeline → veio de uma lista de Oferta Ativa.
                      // Cria/reaproveita um pipeline_lead na Fila do CEO a partir da Oferta Ativa.
                      const { data: oaRes, error: oaErr } = await supabase.rpc("reativar_oferta_ativa_para_fila_ceo", {
                        p_oa_lead_id: metaDispatch.lead_id,
                        p_template_name: tplName,
                      });
                      if (oaErr) throw oaErr;
                      const newId = (oaRes as any)?.pipeline_lead_id;
                      if (newId) effectiveLeadId = newId;
                      console.log(`🔥 Oferta Ativa lead ${metaDispatch.lead_id} → pipeline ${effectiveLeadId} (template=${tplName}) → Fila do CEO`);
                    } else {
                      const { error: filaErr } = await supabase.rpc("reativar_lead_para_fila_ceo", {
                        p_lead_id: metaDispatch.lead_id,
                        p_template_name: tplName,
                      });
                      if (filaErr) throw filaErr;
                      console.log(`🔥 Lead ${metaDispatch.lead_id} reengajado (template=${tplName}) → Fila do CEO`);
                    }
                  } catch (e) {
                    console.error("rpc reativar (fila CEO) error:", e);
                  }

                  // Atividade na timeline registrando o reengajamento
                  await supabase.from("pipeline_atividades").insert({
                    pipeline_lead_id: effectiveLeadId,
                    tipo: "whatsapp",
                    titulo: `🔥 Lead reengajado pelo template "${tplName}" → Fila do CEO`,
                    descricao: `Lead respondeu SIM ("${(buttonId ? buttonTitle : mensagemTexto).slice(0, 120)}") ao disparo do template "${tplName}". Reativado e enviado para a Fila do CEO para distribuição manual.`,
                    data: new Date().toISOString().slice(0, 10),
                    status: "concluida",
                  });


                  // Notifica admins/CEO sobre novo lead reengajado na fila
                  try {
                    const { data: admins } = await supabase
                      .from("user_roles")
                      .select("user_id")
                      .in("role", ["admin", "ceo", "gestor"]);
                    const leadNome = currentLead?.nome || "Lead";
                    for (const a of admins || []) {
                      await supabase.from("notifications").insert({
                        user_id: a.user_id,
                        titulo: `🔥 Lead reengajado na Fila do CEO: ${leadNome}`,
                        mensagem: `${leadNome} respondeu SIM ao template "${tplName}" e está na Fila do CEO aguardando distribuição manual.`,
                        tipo: "lead_reengajado",
                        categoria: "leads",
                        dados: { pipeline_lead_id: metaDispatch.lead_id, template: tplName, audience_source: audSrc, route: "fila_ceo" },
                      });
                    }
                  } catch (e) {
                    console.error("notify CEO fila error:", e);
                  }
                  continue;
                } else if (buttonResp === "sim" && justNotifyCorretor) {
                  // Pipeline ativo / visita amanhã — não move stage, não chama roleta. Só marca interesse + notifica corretor atual.
                  await supabase.from("pipeline_leads").update({
                    reengajamento_status: isWave2 ? "respondeu_sim_wave2" : "respondeu_sim",
                  }).eq("id", metaDispatch.lead_id);

                  const leadNome = currentLead?.nome || "Lead";
                  const tplName = metaDispatch.template_name || "reengajamento";
                  await supabase.from("pipeline_atividades").insert({
                    pipeline_lead_id: metaDispatch.lead_id,
                    tipo: "whatsapp",
                    titulo: `🔥 Interesse confirmado — Disparo: ${tplName}`,
                    descricao: `Lead respondeu SIM ao template "${tplName}" enviado para o Pipeline Ativo. Manter atribuição atual e entrar em contato imediato.`,
                    data: new Date().toISOString().slice(0, 10),
                    status: "concluida",
                    responsavel_id: currentLead?.corretor_id || null,
                  });

                  if (currentLead?.corretor_id) {
                    await supabase.from("notifications").insert({
                      user_id: currentLead.corretor_id,
                      titulo: `🔥 ${leadNome} demonstrou interesse no disparo`,
                      mensagem: `Respondeu SIM ao template "${tplName}". Lead permanece com você no pipeline ativo. Entre em contato agora!`,
                      tipo: "lead_reengajado",
                      categoria: "leads",
                      dados: { pipeline_lead_id: metaDispatch.lead_id, template: tplName, audience_source: audSrc, route: "pipeline_ativo_keep" },
                    });
                  }
                  console.log(`🔥 Lead ${metaDispatch.lead_id} (origem=${audSrc}) respondeu SIM — mantido com corretor atual, sem roleta`);
                  continue;
                } else if (buttonResp === "nao") {
                  // INATIVAÇÃO: lead respondeu NÃO → Descarte definitivo, NÃO reativar, NÃO mandar p/ roleta
                  const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";
                  const { data: leadAtual } = await supabase
                    .from("pipeline_leads")
                    .select("motivo_descarte")
                    .eq("id", metaDispatch.lead_id)
                    .maybeSingle();
                  const carimbo = `[Inativado em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}: respondeu NÃO ao reengajamento WhatsApp]`;
                  const novoMotivo = leadAtual?.motivo_descarte
                    ? `${leadAtual.motivo_descarte} ${carimbo}`
                    : `Inativado: respondeu NÃO ao reengajamento WhatsApp`;
                  await supabase.from("pipeline_leads").update({
                    reengajamento_status: statusNao,
                    tipo_descarte: "definitivo",
                    stage_id: DESCARTE_STAGE_ID,
                    motivo_descarte: novoMotivo,
                    stage_changed_at: new Date().toISOString(),
                    conversation_window_until: null,
                    reativado_por_nutricao: false,
                    arquivado: true,
                  }).eq("id", metaDispatch.lead_id);

                  // Cancela qualquer sequência de nutrição/reativação ativa
                  await supabase
                    .from("lead_nurturing_sequences")
                    .update({ status: "cancelado" })
                    .eq("pipeline_lead_id", metaDispatch.lead_id)
                    .eq("status", "pendente");

                  // Marca envios pendentes da campanha como cancelados (evita 2ª onda)
                  await supabase
                    .from("reengajamento_meta_disparos")
                    .update({ status: "canceled" })
                    .eq("lead_id", metaDispatch.lead_id)
                    .eq("status", "queued");

                  await supabase.from("pipeline_atividades").insert({
                    pipeline_lead_id: metaDispatch.lead_id,
                    tipo: "sistema",
                    titulo: "🚫 Lead inativado — respondeu NÃO ao reengajamento",
                    descricao: `Lead respondeu NÃO ("${(buttonId ? buttonTitle : mensagemTexto).slice(0, 120)}") ao template "${metaDispatch.template_name || "reengajamento"}" e foi inativado/arquivado automaticamente. Removido da lista de descartados. Não será enviado para roleta.`,
                    data: new Date().toISOString().slice(0, 10),
                    status: "concluida",
                  });

                  console.log(`🚫 Lead ${metaDispatch.lead_id} inativado (respondeu NÃO ao reengajamento) — pulando reentry/roleta`);
                  // Pula handleExistingLeadReply / handleUnknownReply
                  continue;
                } else {
                  await supabase.from("pipeline_leads").update({
                    reengajamento_status: statusOutro,
                  }).eq("id", metaDispatch.lead_id);
                }
              }
            }

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
    .select("id, nome, empreendimento, corretor_id, observacoes, reengajamento_status, tipo_descarte, stage_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return;

  // GUARD: lead inativado por ter respondido NÃO — não reabrir janela, não notificar, não chamar orchestrator
  const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";
  const respondeuNao = lead.reengajamento_status === "respondeu_nao" || lead.reengajamento_status === "respondeu_nao_wave2";
  const inativoDefinitivo = lead.stage_id === DESCARTE_STAGE_ID && lead.tipo_descarte === "definitivo";
  if (respondeuNao || inativoDefinitivo) {
    console.log(`🚫 Ignorando reply de lead inativado ${lead.id} (respondeu NÃO / descarte definitivo)`);
    return;
  }

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
  notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_respondeu", lead.id, "whatsapp", { campanha: campanhaLabel });
}

// ── Handle reply from unknown sender — search pipeline_leads, then oferta_ativa ──
async function handleUnknownReply(
  supabase: any, supabaseUrl: string, serviceKey: string,
  from: string, mensagemTexto: string, msg: any, contactName: string | null
) {
  const msgText = mensagemTexto || msg?.type || "mensagem";

  // 1. Search pipeline_leads by normalized phone (últimos 8 dígitos cobre variações de DDI/DDD/9)
  const fromDigits = (from || "").replace(/\D/g, "");
  const last8 = fromDigits.slice(-8);
  const last10 = fromDigits.slice(-10);
  const { data: existingLeads } = await supabase
    .from("pipeline_leads")
    .select("id, nome, corretor_id, empreendimento, reengajamento_status, tipo_descarte, stage_id")
    .or(`telefone.eq.${from},telefone.ilike.%${last10}%,telefone.ilike.%${last8}%`)
    .limit(1);

  if (existingLeads && existingLeads.length > 0) {
    const lead = existingLeads[0];

    // GUARD: lead inativado por NÃO no reengajamento — não reabrir janela, não notificar, não chamar orchestrator
    const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";
    const respondeuNao = lead.reengajamento_status === "respondeu_nao" || lead.reengajamento_status === "respondeu_nao_wave2";
    const inativoDefinitivo = lead.stage_id === DESCARTE_STAGE_ID && lead.tipo_descarte === "definitivo";
    if (respondeuNao || inativoDefinitivo) {
      console.log(`🚫 Ignorando reply espontâneo de lead inativado ${lead.id}`);
      return;
    }

    // Found in pipeline → set window (sem notificar corretor)
    // Removido: notificação "respondeu WhatsApp" gerava falsos positivos
    // (auto-respostas de WhatsApp Business eram interpretadas como lead reengajado).
    // O registro fica na timeline/observações do lead, sem push ao corretor.
    const windowUntil = await setConversationWindow(supabase, lead.id);


    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: lead.id,
      tipo: "whatsapp",
      titulo: `📩 Resposta WhatsApp espontânea`,
      descricao: `Lead respondeu: "${msgText.slice(0, 200)}". Janela 24h aberta.`,
      data: new Date().toISOString().slice(0, 10),
      status: "concluida",
      responsavel_id: lead.corretor_id || null,
    });

    // Log + AI reply for existing lead without campaign send
    await logWhatsAppEntry(supabase, {
      telefone: from,
      nome_contato: contactName,
      mensagem_recebida: msgText,
      tipo_mensagem: "texto",
      filtro_resultado: "aprovado",
      lead_id: lead.id,
      corretor_nome: null,
      status: "lead_criado",
    });

    // If lead has no ai_replied yet and no active conversation window, call AI
    const { data: leadDetail } = await supabase
      .from("pipeline_leads")
      .select("ai_replied, conversation_window_until")
      .eq("id", lead.id)
      .maybeSingle();

    const hasActiveWindow = leadDetail?.conversation_window_until && new Date(leadDetail.conversation_window_until) > new Date();
    if (!leadDetail?.ai_replied && !hasActiveWindow) {
      callAIReply(supabaseUrl, serviceKey, from, contactName || "", msgText, lead.id, "texto");
    }

    notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_respondeu", lead.id, "whatsapp", { campanha: "Reengajamento WhatsApp" });
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

    // GATE: só reativa/cria pipeline se houver intenção positiva clara.
    // Resposta negativa → marca sem_interesse na oferta_ativa_leads e encerra.
    // Resposta neutra/conversa → apenas log + AI reply, sem criar lead.
    if (isNegativeIntent(msgText)) {
      console.log(`🚫 OA lead ${oaLead.id} respondeu NÃO — marcando sem_interesse, sem criar pipeline lead`);
      await supabase.from("oferta_ativa_leads")
        .update({ status_recuperacao: "sem_interesse", updated_at: new Date().toISOString() })
        .eq("id", oaLead.id);
      await logWhatsAppEntry(supabase, {
        telefone: from, nome_contato: contactName, mensagem_recebida: msgText,
        tipo_mensagem: "texto", filtro_resultado: "negado_intencao_negativa",
        lead_id: null, corretor_nome: null, status: "ignorado_resposta_negativa",
      });
      return;
    }
    if (!isPositiveIntent(msgText)) {
      console.log(`⏸️ OA lead ${oaLead.id} respondeu sem intenção clara — não cria pipeline lead`);
      await logWhatsAppEntry(supabase, {
        telefone: from, nome_contato: contactName, mensagem_recebida: msgText,
        tipo_mensagem: "texto", filtro_resultado: "ignorado_intencao_neutra",
        lead_id: null, corretor_nome: null, status: "ignorado_neutro",
      });
      return;
    }

    console.log(`🔄 Lead from Oferta Ativa responding SIM: ${oaLead.nome} — creating pipeline lead and distributing`);

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
        origem: "Reengajamento (Nutrição)",
        reativado_por_nutricao: true,
        reativado_em: new Date().toISOString(),
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

    // AI reply for reactivated lead
    callAIReply(supabaseUrl, serviceKey, from, contactName || oaLead.nome || "", msgText, newLead.id, "texto");

    // Notify orchestrator
    notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_respondeu", newLead.id, "whatsapp", { campanha: "Reengajamento Oferta Ativa" });
    return;
  }

  // 3. Not found anywhere → SÓ cria lead se houver intenção positiva clara.
  // GUARD reforçado: intenção negativa explícita sempre bloqueia (evita "não tenho interesse" virar lead novo).
  if (isNegativeIntent(msgText) || !isPositiveIntent(msgText)) {
    const negativo = isNegativeIntent(msgText);
    console.log(`🚫 Unknown sender ${from} ${negativo ? "intenção NEGATIVA" : "sem intenção positiva"} — não cria lead. Texto: "${msgText.slice(0, 80)}"`);
    await logWhatsAppEntry(supabase, {
      telefone: from, nome_contato: contactName, mensagem_recebida: msgText,
      tipo_mensagem: "texto",
      filtro_resultado: negativo ? "negado_intencao_negativa" : "ignorado_intencao_neutra",
      lead_id: null, corretor_nome: null,
      status: negativo ? "ignorado_resposta_negativa" : "ignorado_neutro",
    });
    return;
  }

  console.log(`🆕 Unknown sender ${from} respondeu com intenção positiva — creating new lead and distributing`);

  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("tipo", "novo")
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const { data: newLead, error: createErr } = await supabase
    .from("pipeline_leads")
    .insert({
      nome: contactName || "Lead WhatsApp",
      telefone: from,
      origem: "Reengajamento (Nutrição)",
      reativado_por_nutricao: true,
      reativado_em: nowIso,
      stage_id: firstStage?.id || null,
      stage_changed_at: nowIso,
      conversation_window_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      observacoes: `🔄 Lead reativado via reengajamento WhatsApp (remetente novo). Respondeu: "${msgText.slice(0, 200)}"`,
    })
    .select("id")
    .single();

  if (!createErr && newLead) {
    await distributeViroleta(supabaseUrl, serviceKey, newLead.id);

    // AI reply for new lead
    callAIReply(supabaseUrl, serviceKey, from, contactName || "", msgText, newLead.id, "texto");

    notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_respondeu", newLead.id, "whatsapp", { campanha: "WhatsApp (remetente novo)" });
  }
}
