import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) {
      return json({ error: "Não autenticado" }, 401);
    }

    const { telefone, media_base64, media_type, filename, caption } = await req.json();

    if (!telefone || !media_base64 || !media_type) {
      return json({ error: "telefone, media_base64 e media_type são obrigatórios" }, 400);
    }

    // Normalize phone
    let cleanPhone = telefone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

    // Get profile id
    const { data: profile } = await sb.from("profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
    const profileId = profile?.id;

    // Check for Evolution API instance
    let evoInstance = null;
    if (profileId) {
      const { data: inst } = await sb.from("whatsapp_instances").select("*")
        .eq("profile_id", profileId)
        .eq("status", "connected")
        .maybeSingle();
      evoInstance = inst;
    }

    let messageId: string | null = null;
    let mediaUrl: string | null = null;

    if (evoInstance) {
      // Send via Evolution API
      const evoUrl = Deno.env.get("EVOLUTION_API_URL");
      const evoKey = Deno.env.get("EVOLUTION_API_KEY");

      if (!evoUrl || !evoKey) {
        return json({ error: "Evolution API não configurada" }, 500);
      }

      const instanceName = evoInstance.instance_name;

      // Determine Evolution endpoint based on media type
      let endpoint = "sendMedia";
      const isAudio = media_type.startsWith("audio/");
      if (isAudio) {
        endpoint = "sendWhatsAppAudio";
      }

      const evoBody: Record<string, unknown> = {
        number: cleanPhone,
        mediatype: getEvoMediaType(media_type),
        media: media_base64,
        fileName: filename || "file",
      };

      if (caption && !isAudio) {
        evoBody.caption = caption;
      }

      const evoResponse = await fetch(
        `${evoUrl}/message/${endpoint}/${instanceName}`,
        {
          method: "POST",
          headers: {
            apikey: evoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(evoBody),
        }
      );

      const evoResult = await evoResponse.json();
      console.log("Evolution sendMedia response:", JSON.stringify(evoResult));

      if (!evoResponse.ok) {
        return json({
          error: "Erro ao enviar mídia via Evolution: " + (evoResult?.message || JSON.stringify(evoResult)),
        }, evoResponse.status);
      }

      messageId = evoResult?.key?.id || evoResult?.messageId || crypto.randomUUID();
      mediaUrl = evoResult?.message?.mediaUrl || null;
    } else {
      // Send via Meta Business API
      const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

      if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
        return json({ error: "WhatsApp Meta credentials not configured" }, 500);
      }

      // Meta API requires uploading media first, then sending
      // For simplicity, send as document with base64 link
      const metaType = getMetaMediaType(media_type);

      // Upload media to Meta
      const formData = new FormData();
      const binaryStr = atob(media_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: media_type });
      formData.append("file", blob, filename || "file");
      formData.append("messaging_product", "whatsapp");
      formData.append("type", media_type);

      const uploadRes = await fetch(
        `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/media`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
          body: formData,
        }
      );

      const uploadResult = await uploadRes.json();
      console.log("Meta media upload:", JSON.stringify(uploadResult));

      if (!uploadRes.ok || !uploadResult.id) {
        return json({ error: "Erro upload Meta: " + (uploadResult?.error?.message || "falha") }, 500);
      }

      const mediaId = uploadResult.id;

      // Send message with media ID
      const msgBody: Record<string, unknown> = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: metaType,
      };

      const mediaObj: Record<string, string> = { id: mediaId };
      if (caption) mediaObj.caption = caption;
      if (metaType === "document") mediaObj.filename = filename || "file";

      (msgBody as Record<string, unknown>)[metaType] = mediaObj;

      const sendRes = await fetch(
        `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(msgBody),
        }
      );

      const sendResult = await sendRes.json();
      console.log("Meta send media:", JSON.stringify(sendResult));

      if (!sendRes.ok) {
        return json({
          error: "Erro envio Meta: " + (sendResult?.error?.message || "falha"),
        }, sendRes.status);
      }

      messageId = sendResult.messages?.[0]?.id || crypto.randomUUID();
    }

    return json({
      success: true,
      message_id: messageId,
      media_url: mediaUrl,
      phone: cleanPhone,
    });
  } catch (e) {
    console.error("whatsapp-send-media error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function getEvoMediaType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

function getMetaMediaType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}
