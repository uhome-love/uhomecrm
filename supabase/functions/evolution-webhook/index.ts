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

        // Map numeric status to string
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
      .select("id")
      .ilike("telefone", searchPattern)
      .limit(1);

    if (leadErr || !leads || leads.length === 0) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const leadId = leads[0].id;

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

    let storedMediaUrl = mediaUrl || null;

    if (!storedMediaUrl && data.message?.base64) {
      const mimeType = data.message?.mimetype || "application/octet-stream";
      storedMediaUrl = `data:${mimeType};base64,${data.message.base64}`;
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("evolution-webhook error:", err);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
