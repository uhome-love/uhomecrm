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

    const { telefone, mensagem, nome, template } = await req.json();

    if (!telefone) {
      return json({ error: "telefone é obrigatório" }, 400);
    }

    if (!mensagem && !template) {
      return json({ error: "mensagem ou template é obrigatório" }, 400);
    }

    // Normalize phone (Brazilian format)
    let cleanPhone = telefone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

    // Validate length: BR mobile = 55 + 2 (DDD) + 9 digits = 13. Landline = 12.
    if (cleanPhone.length < 12 || cleanPhone.length > 13) {
      return json({
        error: `Número de telefone inválido (${telefone}). Verifique o cadastro do lead — o número parece incompleto.`,
        invalid_phone: true,
      }, 400);
    }

    // Add missing 9th digit for mobile numbers (BR): 55 + DD + 8 digits → 55 + DD + 9 + 8 digits
    if (cleanPhone.length === 12) {
      const ddd = cleanPhone.substring(2, 4);
      const rest = cleanPhone.substring(4);
      // Mobile if first digit of "rest" is 6, 7, 8 or 9 → must add the leading 9
      if (/^[6-9]/.test(rest)) {
        cleanPhone = `55${ddd}9${rest}`;
      }
    }

    // Get profile id
    const { data: profile } = await sb
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.id) {
      return json({ error: "Perfil não encontrado" }, 404);
    }

    // Get Evolution instance
    const { data: instance } = await sb
      .from("whatsapp_instancias")
      .select("instance_name, status")
      .eq("corretor_id", profile.id)
      .eq("status", "conectado")
      .maybeSingle();

    if (!instance) {
      return json({
        error: "WhatsApp não conectado. Conecte seu WhatsApp em Configurações primeiro.",
        requires_connection: true,
      }, 422);
    }

    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evoUrl || !evoKey) {
      return json({ error: "Evolution API não configurada" }, 500);
    }

    const instanceName = instance.instance_name;
    let messageId: string | null = null;

    if (template) {
      // Templates are not supported via Evolution — send as plain text if possible
      // For now, just send the mensagem fallback or error
      const tplText = mensagem || `Template: ${typeof template === 'string' ? template : template.name}`;
      
      console.log(`Sending template fallback as text via Evolution to: ${cleanPhone}`);

      const evoResponse = await fetch(
        `${evoUrl}/message/sendText/${instanceName}`,
        {
          method: "POST",
          headers: {
            apikey: evoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            number: cleanPhone,
            text: tplText,
          }),
        }
      );

      const evoResult = await evoResponse.json();
      console.log("Evolution sendText (template fallback):", JSON.stringify(evoResult));

      if (!evoResponse.ok) {
        return json({
          error: "Erro Evolution API: " + (evoResult?.message || JSON.stringify(evoResult)),
        }, evoResponse.status);
      }

      messageId = evoResult?.key?.id || evoResult?.messageId || crypto.randomUUID();
    } else {
      // Send plain text via Evolution
      console.log(`Sending text via Evolution to: ${cleanPhone} instance: ${instanceName}`);

      const evoResponse = await fetch(
        `${evoUrl}/message/sendText/${instanceName}`,
        {
          method: "POST",
          headers: {
            apikey: evoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            number: cleanPhone,
            text: mensagem,
          }),
        }
      );

      const evoResult = await evoResponse.json();
      console.log("Evolution sendText response:", JSON.stringify(evoResult));

      // Detect "number does not exist on WhatsApp" (Evolution returns 400 with message array)
      const msgArr = Array.isArray(evoResult?.response?.message) ? evoResult.response.message : null;
      const notOnWhatsApp = msgArr?.some((m: any) => m?.exists === false);
      if (notOnWhatsApp) {
        return json({
          error: `O número ${cleanPhone} não está cadastrado no WhatsApp. Verifique se o telefone do lead está correto.`,
          invalid_phone: true,
          phone: cleanPhone,
        }, 422);
      }

      if (!evoResponse.ok) {
        return json({
          error: "Erro Evolution API: " + (evoResult?.message || JSON.stringify(evoResult)),
        }, evoResponse.status);
      }

      messageId = evoResult?.key?.id || evoResult?.messageId || crypto.randomUUID();
    }

    console.log("WhatsApp sent OK via Evolution, messageId:", messageId);

    return json({
      success: true,
      message_id: messageId,
      phone: cleanPhone,
      channel: "evolution",
    });
  } catch (e) {
    console.error("whatsapp-send error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
