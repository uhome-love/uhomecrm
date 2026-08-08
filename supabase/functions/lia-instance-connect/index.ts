/**
 * lia-instance-connect — cria/conecta a instância dedicada da Lia no Evolution
 * e aponta o webhook dela para `lia-webhook` (nunca para o evolution-webhook
 * do CRM, para manter a caixa da Lia isolada).
 *
 * Ações: create | qrcode | status | disconnect
 * Auth: usuário logado com papel admin.
 */
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

function novoSegredo() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
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
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: ehAdmin } = await admin.rpc("has_role", {
      _user_id: claimsData.claims.sub,
      _role: "admin",
    });
    if (ehAdmin !== true) return json({ error: "Forbidden" }, 403);

    const { action } = await req.json().catch(() => ({ action: "status" }));
    if (!["create", "qrcode", "status", "disconnect"].includes(action)) {
      return json({ error: "action inválida" }, 400);
    }

    const EVO_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY");
    if (!EVO_URL || !EVO_KEY) return json({ error: "Evolution env vars missing" }, 500);
    const evoHeaders = { apikey: EVO_KEY, "Content-Type": "application/json" };

    const { data: cfg } = await admin
      .from("ia_config")
      .select("instancia, webhook_secret")
      .limit(1)
      .maybeSingle();

    const instance_name = cfg?.instancia || "uhome-lia-canoas";

    if (action === "create") {
      // Segredo do webhook: gera na primeira vez, reaproveita depois.
      let secret = cfg?.webhook_secret as string | null;
      if (!secret) {
        secret = novoSegredo();
        await admin.from("ia_config").update({ webhook_secret: secret, instancia: instance_name }).eq("id", true);
      } else if (!cfg?.instancia) {
        await admin.from("ia_config").update({ instancia: instance_name }).eq("id", true);
      }

      const createRes = await fetch(`${EVO_URL}/instance/create`, {
        method: "POST",
        headers: evoHeaders,
        body: JSON.stringify({ instanceName: instance_name, integration: "WHATSAPP-BAILEYS" }),
      });
      if (!createRes.ok && createRes.status !== 403 && createRes.status !== 409) {
        console.error("evolution create:", await createRes.text());
      }

      // Webhook da Lia: header como principal (Evolution v2.3.7) + query de reserva.
      const webhookUrl = `${supabaseUrl}/functions/v1/lia-webhook?s=${secret}`;
      try {
        await fetch(`${EVO_URL}/webhook/set/${instance_name}`, {
          method: "POST",
          headers: evoHeaders,
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              headers: { "x-lia-secret": secret },
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

      return json({ instance_name, status: "aguardando_qr", webhook: `${supabaseUrl}/functions/v1/lia-webhook` });
    }

    if (action === "qrcode") {
      const r = await fetch(`${EVO_URL}/instance/connect/${instance_name}`, { headers: evoHeaders });
      if (!r.ok) return json({ error: `QR error ${r.status}` }, 502);
      const data = await r.json();
      return json({ qrcode: data.base64 ?? data.qrcode ?? null, instance_name });
    }

    if (action === "status") {
      const r = await fetch(`${EVO_URL}/instance/connectionState/${instance_name}`, { headers: evoHeaders });
      if (!r.ok) return json({ status: "close", instance_name, webhook_configurado: !!cfg?.webhook_secret });
      const data = await r.json();
      const state = data.instance?.state ?? data.state ?? "close";
      return json({ status: state, instance_name, webhook_configurado: !!cfg?.webhook_secret });
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
    console.error("lia-instance-connect error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
