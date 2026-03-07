import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if keys already exist
  const existing = Deno.env.get("VAPID_PUBLIC_KEY");
  if (existing) {
    return new Response(
      JSON.stringify({ 
        message: "VAPID keys already configured",
        publicKey: existing 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate new VAPID keys
  const vapidKeys = webpush.generateVAPIDKeys();

  return new Response(
    JSON.stringify({
      message: "Save these keys as secrets. PUBLIC key goes to VAPID_PUBLIC_KEY, PRIVATE key goes to VAPID_PRIVATE_KEY",
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
