// Conecta/gerencia a instância dedicada de nutrição (Evolution API).
// Recebe { action: "create"|"qrcode"|"status"|"disconnect", instance_name }
// Requer usuário autenticado (admin/gestor).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await auth.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const { action, instance_name } = await req.json();
    if (!instance_name) return json({ error: "instance_name obrigatório" }, 400);
    if (!["create", "qrcode", "status", "disconnect"].includes(action)) {
      return json({ error: "action inválida" }, 400);
    }

    const EVO_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY");
    if (!EVO_URL || !EVO_KEY) return json({ error: "Evolution env vars missing" }, 500);
    const evoHeaders = { apikey: EVO_KEY, "Content-Type": "application/json" };

    if (action === "create") {
      // Cria instância se não existir + configura webhook
      const createRes = await fetch(`${EVO_URL}/instance/create`, {
        method: "POST",
        headers: evoHeaders,
        body: JSON.stringify({ instanceName: instance_name, integration: "WHATSAPP-BAILEYS" }),
      });
      // 403/409 se já existe — ignoramos
      if (!createRes.ok && createRes.status !== 403 && createRes.status !== 409) {
        const t = await createRes.text();
        console.error("evolution create:", t);
      }
      // Configura webhook para o evolution-webhook (essencial para detectar SIM)
      try {
        await fetch(`${EVO_URL}/webhook/set/${instance_name}`, {
          method: "POST",
          headers: evoHeaders,
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: `${supabaseUrl}/functions/v1/evolution-webhook`,
              webhookByEvents: false,
              byEvents: false,
              base64: false,
              events: ["MESSAGES_UPSERT"],
            },
          }),
        });
      } catch (e) {
        console.error("webhook set:", e);
      }
      return json({ instance_name, status: "aguardando_qr" });
    }

    if (action === "qrcode") {
      const r = await fetch(`${EVO_URL}/instance/connect/${instance_name}`, {
        method: "GET",
        headers: evoHeaders,
      });
      if (!r.ok) return json({ error: `QR error ${r.status}` }, 502);
      const data = await r.json();
      return json({ qrcode: data.base64 ?? data.qrcode ?? data });
    }

    if (action === "status") {
      const r = await fetch(`${EVO_URL}/instance/connectionState/${instance_name}`, {
        method: "GET",
        headers: evoHeaders,
      });
      if (!r.ok) return json({ status: "close" });
      const data = await r.json();
      const state = data.instance?.state ?? data.state ?? "close";
      return json({ status: state });
    }

    if (action === "disconnect") {
      const r = await fetch(`${EVO_URL}/instance/logout/${instance_name}`, {
        method: "DELETE",
        headers: evoHeaders,
      });
      if (!r.ok) console.error("logout:", await r.text());
      return json({ success: true });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    console.error("nutricao-instance-connect error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
