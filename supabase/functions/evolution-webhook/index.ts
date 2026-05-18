import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  return raw.replace(/[+\s\-()]/g, "");
}

function getSearchVariants(phone: string): string[] {
  const clean = normalizePhone(phone);
  const last8 = clean.slice(-8);
  return [last8];
}

function extractBody(message: any): string | null {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.audioMessage?.caption ||
    null
  );
}

function extractMediaUrl(message: any): string | null {
  if (message?.imageMessage?.url) return message.imageMessage.url;
  if (message?.imageMessage?.mediaUrl) return message.imageMessage.mediaUrl;
  if (message?.videoMessage?.url) return message.videoMessage.url;
  if (message?.videoMessage?.mediaUrl) return message.videoMessage.mediaUrl;
  if (message?.audioMessage?.url) return message.audioMessage.url;
  if (message?.audioMessage?.mediaUrl) return message.audioMessage.mediaUrl;
  if (message?.documentMessage?.url) return message.documentMessage.url;
  if (message?.documentMessage?.mediaUrl) return message.documentMessage.mediaUrl;
  if (message?.stickerMessage?.url) return message.stickerMessage.url;
  return null;
}

function getMediaType(message: any): string | null {
  if (message?.imageMessage) return "image";
  if (message?.videoMessage) return "video";
  if (message?.audioMessage) return "audio";
  if (message?.documentMessage) return "document";
  if (message?.stickerMessage) return "sticker";
  return null;
}

function extractQuotedMessageId(message: any): string | null {
  const ctx =
    message?.extendedTextMessage?.contextInfo ||
    message?.imageMessage?.contextInfo ||
    message?.videoMessage?.contextInfo ||
    message?.audioMessage?.contextInfo ||
    message?.documentMessage?.contextInfo;
  return ctx?.stanzaId || null;
}

function getMimeType(message: any, mediaType: string | null): string {
  const m = message;
  if (m?.imageMessage?.mimetype) return m.imageMessage.mimetype;
  if (m?.videoMessage?.mimetype) return m.videoMessage.mimetype;
  if (m?.audioMessage?.mimetype) return m.audioMessage.mimetype;
  if (m?.documentMessage?.mimetype) return m.documentMessage.mimetype;
  if (m?.stickerMessage?.mimetype) return m.stickerMessage.mimetype;
  
  const defaults: Record<string, string> = {
    image: "image/jpeg",
    video: "video/mp4",
    audio: "audio/ogg",
    document: "application/octet-stream",
    sticker: "image/webp",
  };
  return defaults[mediaType || ""] || "application/octet-stream";
}

function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",
    "audio/ogg": ".ogg",
    "audio/ogg; codecs=opus": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/aac": ".m4a",
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  };
  return map[mime] || ".bin";
}

async function reativarLeadNutricao(supabase: any, leadId: string, opts?: { wave?: 1 | 2 }) {
  // Wave 2 atual = campanha Casa Tua (template casatua_maio).
  // Roteia para o segmento Casa Tua via empreendimento.
  if (opts?.wave === 2) {
    const { data, error } = await supabase.rpc("reativar_lead_nutricao_campanha", {
      p_lead_id: leadId,
      p_empreendimento: "Casa Tua",
      p_campanha_label: "Casa Tua (Maio/2026)",
    });
    if (error) {
      console.error("Nutrição wave2 reactivation RPC failed:", error);
      throw error;
    }
    return data;
  }

  const { data, error } = await supabase.rpc("reativar_lead_nutricao_manual", {
    p_lead_id: leadId,
  });

  if (error) {
    console.error("Nutrição reactivation RPC failed:", error);
    throw error;
  }

  return data;
}

async function downloadAndStoreMedia(
  supabase: any,
  instanceName: string,
  messageId: string,
  base64Data: string | null,
  mediaUrl: string | null,
  mimeType: string,
  mediaType: string
): Promise<string | null> {
  try {
    let fileData: Uint8Array | null = null;

    // 1. Try base64 from webhook payload first
    if (base64Data) {
      const raw = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      const binaryStr = atob(raw);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      fileData = bytes;
    }

    // 2. If no base64, try downloading from Evolution API
    if (!fileData && mediaUrl) {
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

      if (evolutionUrl && evolutionKey) {
        // Try Evolution API getBase64FromMediaMessage endpoint
        try {
          const apiUrl = `${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
          const resp = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionKey,
            },
            body: JSON.stringify({
              message: { key: { id: messageId } },
              convertToMp4: mediaType === "audio" || mediaType === "video",
            }),
          });

          if (resp.ok) {
            const result = await resp.json();
            const b64 = result?.base64;
            if (b64) {
              const raw = b64.includes(",") ? b64.split(",")[1] : b64;
              const binaryStr = atob(raw);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              fileData = bytes;
              // Update mimeType if returned
              if (result?.mimetype) {
                mimeType = result.mimetype;
              }
            }
          }
        } catch (e) {
          console.error("Evolution getBase64 failed:", e);
        }
      }

      // 3. Direct download as fallback
      if (!fileData) {
        try {
          const resp = await fetch(mediaUrl, { redirect: "follow" });
          if (resp.ok) {
            const ab = await resp.arrayBuffer();
            fileData = new Uint8Array(ab);
          }
        } catch (e) {
          console.error("Direct media download failed:", e);
        }
      }
    }

    if (!fileData || fileData.length === 0) {
      console.error("No media data obtained");
      return mediaUrl; // fallback to original URL
    }

    // Upload to Supabase Storage
    const ext = getExtFromMime(mimeType);
    const fileName = `${instanceName}/${Date.now()}_${messageId}${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("whatsapp-media")
      .upload(fileName, fileData, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return mediaUrl; // fallback
    }

    const { data: publicUrlData } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(fileName);

    return publicUrlData?.publicUrl || mediaUrl;
  } catch (err) {
    console.error("downloadAndStoreMedia error:", err);
    return mediaUrl;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const event = payload.event;
    const instanceName = payload.instance;
    const data = payload.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle delivery status updates (MESSAGES_UPDATE)
    if (event === "messages.update" || event === "MESSAGES_UPDATE") {
      const updates = Array.isArray(data) ? data : [data];
      for (const update of updates) {
        const messageId = update?.key?.id || update?.keyId;
        const status = update?.status;
        if (!messageId || status === undefined) continue;

        let deliveryStatus = "sent";
        if (status === 2 || status === "DELIVERY_ACK" || status === "delivered") deliveryStatus = "delivered";
        if (status === 3 || status === "READ" || status === "read") deliveryStatus = "read";
        if (status === 4 || status === "PLAYED") deliveryStatus = "read";

        await supabase
          .from("whatsapp_mensagens")
          .update({ delivery_status: deliveryStatus })
          .eq("whatsapp_message_id", messageId);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Standard message processing
    if (!data?.key?.remoteJid || !instanceName) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const remoteJid = data.key.remoteJid as string;

    if (remoteJid.includes("@g.us") || remoteJid === "status@broadcast") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const body = extractBody(data.message);
    const mediaUrl = extractMediaUrl(data.message);
    const mediaType = getMediaType(data.message);
    const quotedMessageId = extractQuotedMessageId(data.message);

    if (!body && !mediaUrl && !mediaType) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const finalBody = body || (mediaType ? `📎 ${mediaType}` : null);

    const phoneRaw = remoteJid.replace("@s.whatsapp.net", "");
    const variants = getSearchVariants(phoneRaw);

    const searchPattern = `%${variants[0]}%`;
    const { data: leads, error: leadErr } = await supabase
      .from("pipeline_leads")
      .select("id, nome, reengajamento_status, reativado_por_nutricao")
      .ilike("telefone", searchPattern)
      .limit(1);

    if (leadErr || !leads || leads.length === 0) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const lead = leads[0] as any;
    const leadId = lead.id;

    const { data: instancia } = await supabase
      .from("whatsapp_instancias")
      .select("corretor_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    const corretorId = instancia?.corretor_id || null;

    const direction = data.key.fromMe ? "sent" : "received";

    const timestamp = data.messageTimestamp
      ? new Date(Number(data.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();

    // Download and store media in Supabase Storage
    let storedMediaUrl: string | null = null;
    if (mediaType && (mediaUrl || data.message?.base64)) {
      const mimeType = getMimeType(data.message, mediaType);
      const messageId = data.key.id || crypto.randomUUID();
      storedMediaUrl = await downloadAndStoreMedia(
        supabase,
        instanceName,
        messageId,
        data.message?.base64 || null,
        mediaUrl,
        mimeType,
        mediaType
      );
    }

    const insertData: Record<string, unknown> = {
      lead_id: leadId,
      corretor_id: corretorId,
      instance_name: instanceName,
      direction,
      body: finalBody,
      whatsapp_message_id: data.key.id || null,
      timestamp,
      delivery_status: direction === "sent" ? "sent" : null,
      media_type: mediaType,
    };

    if (storedMediaUrl) {
      insertData.media_url = storedMediaUrl;
    }

    if (quotedMessageId) {
      insertData.quoted_message_id = quotedMessageId;
    }

    const { error: insertErr } = await supabase
      .from("whatsapp_mensagens")
      .insert(insertData);

    if (insertErr) {
      console.error("Insert error:", insertErr);
    }

    await supabase
      .from("pipeline_leads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", leadId);

    // ====== Reengajamento: detectar resposta a campanha de nutrição ======
    if (
      direction === "received" &&
      finalBody &&
      (lead.reengajamento_status === "enviado" || lead.reengajamento_status === "enviado_wave2")
    ) {
      const isWave2 = lead.reengajamento_status === "enviado_wave2";
      const suffix = isWave2 ? "_wave2" : "";
      const txt = finalBody.trim().toLowerCase();

      const AUTO_REPLY_PATTERNS = [
        /agradec\w*\s+(seu|pelo|sua)\s+(contato|mensagem)/,
        /agradec\w*\s+sua\s+mensagem/,
        /n[aã]o\s+estamos\s+dispon[ií]ve/,
        /responderemos\s+assim\s+que/,
        /retornaremos\s+(o\s+)?(contato|assim)/,
        /fora\s+do\s+(nosso\s+)?hor[aá]rio/,
        /hor[aá]rio\s+de\s+(atendimento|expediente)/,
        /mensagem\s+autom[aá]tica/,
        /resposta\s+autom[aá]tica/,
        /em\s+breve\s+(entraremos|retornaremos)/,
        /assim\s+que\s+poss[ií]vel/,
        /como\s+podemos\s+(te\s+)?ajudar\??$/,
      ];
      const isAutoReply = AUTO_REPLY_PATTERNS.some((re) => re.test(txt));

      if (isAutoReply) {
        await supabase.from("reengajamento_eventos").insert({
          lead_id: leadId,
          tipo: "auto_reply_ignorada",
          detalhe: finalBody.slice(0, 500),
        });
        return new Response(JSON.stringify({ success: true, ignored: "auto_reply" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const POSITIVE_STRICT = /^(sim|quero|claro|pode\s*(mandar|enviar)|envia|manda|me\s*envia|tenho\s*interesse|gostaria|interessad[oa]|por\s*favor|pf|👍|✅|🙏|s)\b/;
      const NEGATIVE_STRICT = /^(n[aã]o\s*(quero|tenho|obrigad|me\s*interesso|preciso)|n[aã]o\.?$|j[aá]\s*comprei|comprei|desisti|stop|sair|cancela|cancelar|para\s+de|me\s*remov|remove|p[aá]ra)/;

      let outcome: "respondeu_sim" | "respondeu_nao" | "respondeu_outro" = "respondeu_outro";
      if (POSITIVE_STRICT.test(txt)) outcome = "respondeu_sim";
      else if (NEGATIVE_STRICT.test(txt) && txt.length < 60) outcome = "respondeu_nao";

      await supabase.from("reengajamento_eventos").insert({
        lead_id: leadId,
        tipo: "resposta_recebida" + suffix,
        detalhe: finalBody.slice(0, 500),
      });

      if (outcome === "respondeu_sim") {
        await supabase.from("reengajamento_eventos").insert({
          lead_id: leadId, tipo: "classificado_sim" + suffix, detalhe: finalBody.slice(0, 300),
        });

        // ── Lookup origem do disparo via último dispatch_run do lead ──
        let audSrc = "legacy";
        try {
          const { data: lastEv } = await supabase
            .from("reengajamento_eventos")
            .select("run_id")
            .eq("lead_id", leadId)
            .eq("tipo", "enviado")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastEv?.run_id) {
            const { data: run } = await supabase
              .from("reengajamento_dispatch_runs")
              .select("audience_source")
              .eq("id", lastEv.run_id)
              .maybeSingle();
            const raw = String(run?.audience_source || "");
            if (raw.startsWith("descartados")) audSrc = "descartados";
            else if (raw.startsWith("oferta_ativa")) audSrc = "oferta_ativa_lista";
            else if (raw.startsWith("pipeline")) audSrc = "pipeline_ativo";
            else if (raw === "visita_amanha") audSrc = "visita_amanha";
          }
        } catch (e) {
          console.error("audience_source lookup error:", e);
        }

        const routeToRoleta = audSrc === "descartados" || audSrc === "oferta_ativa_lista" || audSrc === "legacy";

        if (routeToRoleta) {
          try {
            const distResult = await reativarLeadNutricao(supabase, leadId, { wave: isWave2 ? 2 : 1 });
            if (!distResult?.success) {
              await supabase.from("reengajamento_eventos").insert({
                lead_id: leadId, tipo: "reativado_auto",
                detalhe: `Reativação via Nutrição sem distribuição imediata. ${JSON.stringify(distResult)}`,
              });
            } else {
              await supabase.from("reengajamento_eventos").insert({
                lead_id: leadId, tipo: "reativado_auto", detalhe: `Distribuído automaticamente (origem=${audSrc})`,
              });
            }
          } catch (e) {
            console.error("rpc reativar_lead_nutricao_manual error:", e);
          }
        } else {
          // Pipeline ativo / visita amanhã → mantém corretor, só notifica
          await supabase.from("pipeline_leads").update({
            reengajamento_status: "respondeu_sim" + suffix,
          }).eq("id", leadId);

          const { data: leadFull } = await supabase
            .from("pipeline_leads")
            .select("nome, corretor_id")
            .eq("id", leadId)
            .maybeSingle();

          await supabase.from("pipeline_atividades").insert({
            pipeline_lead_id: leadId,
            tipo: "whatsapp",
            titulo: `🔥 Interesse confirmado — disparo (Evolution)`,
            descricao: `Lead respondeu SIM ao disparo Evolution (origem=${audSrc}). Manter atribuição atual.`,
            data: new Date().toISOString().slice(0, 10),
            status: "concluida",
            responsavel_id: leadFull?.corretor_id || null,
          });

          if (leadFull?.corretor_id) {
            await supabase.from("notifications").insert({
              user_id: leadFull.corretor_id,
              titulo: `🔥 ${leadFull.nome || "Lead"} demonstrou interesse no disparo`,
              mensagem: `Respondeu SIM ao disparo Evolution. Lead permanece com você no pipeline ativo. Entre em contato agora!`,
              tipo: "lead_reengajado",
              categoria: "leads",
              dados: { pipeline_lead_id: leadId, audience_source: audSrc, route: "pipeline_ativo_keep" },
            });
          }

          await supabase.from("reengajamento_eventos").insert({
            lead_id: leadId, tipo: "reativado_auto",
            detalhe: `Pipeline ativo: corretor mantido, notificação enviada (origem=${audSrc})`,
          });
        }
      } else if (outcome === "respondeu_nao") {
        await supabase
          .from("pipeline_leads")
          .update({
            reengajamento_status: "respondeu_nao" + suffix,
            tipo_descarte: "definitivo",
          })
          .eq("id", leadId);
        await supabase.from("reengajamento_eventos").insert({
          lead_id: leadId, tipo: "classificado_nao" + suffix, detalhe: finalBody.slice(0, 300),
        });
      } else {
        await supabase
          .from("pipeline_leads")
          .update({ reengajamento_status: "respondeu_outro" + suffix })
          .eq("id", leadId);
        await supabase.from("reengajamento_eventos").insert({
          lead_id: leadId, tipo: "classificado_outro" + suffix, detalhe: finalBody.slice(0, 300),
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("evolution-webhook error:", err);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
