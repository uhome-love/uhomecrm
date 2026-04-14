import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    // --- Auth: validate JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client with user token for auth validation
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return errorResponse("Unauthorized", 401);
    }
    const userId = claimsData.claims.sub as string;

    // Service client for DB operations (bypass RLS)
    const db = createClient(supabaseUrl, supabaseServiceKey);

    // --- Resolve corretor_id from profiles ---
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return errorResponse("Perfil não encontrado", 404);
    }
    const corretorId = profile.id as string;

    // --- Parse body ---
    const { action } = await req.json();
    if (!["create", "qrcode", "status", "disconnect"].includes(action)) {
      return errorResponse("action inválida", 400);
    }

    const EVOLUTION_URL = Deno.env.get("EVOLUTION_API_URL")!;
    const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
    const evoHeaders = { apikey: EVOLUTION_KEY, "Content-Type": "application/json" };

    // Helper: get instance for this corretor
    async function getInstancia() {
      const { data, error } = await db
        .from("whatsapp_instancias")
        .select("instance_name, status")
        .eq("corretor_id", corretorId)
        .single();
      if (error || !data) throw new Error("Instância não encontrada. Use action=create primeiro.");
      return data;
    }

    // === ACTIONS ===

    if (action === "create") {
      const instanceName = `uhome-${corretorId.substring(0, 8)}`;

      // Check if already exists
      const { data: existing } = await db
        .from("whatsapp_instancias")
        .select("id, instance_name, status")
        .eq("corretor_id", corretorId)
        .maybeSingle();

      if (!existing) {
        // Create on Evolution API
        const evoRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
          method: "POST",
          headers: evoHeaders,
          body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS" }),
        });
        if (!evoRes.ok) {
          const errBody = await evoRes.text();
          console.error("Evolution create error:", errBody);
          return errorResponse(`Erro ao criar instância: ${evoRes.status}`, 502);
        }

        // Save to DB
        await db.from("whatsapp_instancias").insert({
          corretor_id: corretorId,
          instance_name: instanceName,
          status: "aguardando_qr",
        });
      }

      return jsonResponse({
        instance_name: existing?.instance_name ?? instanceName,
        status: existing?.status ?? "aguardando_qr",
      });
    }

    if (action === "qrcode") {
      const inst = await getInstancia();
      const evoRes = await fetch(`${EVOLUTION_URL}/instance/connect/${inst.instance_name}`, {
        method: "GET",
        headers: evoHeaders,
      });
      if (!evoRes.ok) {
        return errorResponse(`Erro ao obter QR Code: ${evoRes.status}`, 502);
      }
      const data = await evoRes.json();
      return jsonResponse({ qrcode: data.base64 ?? data.qrcode ?? data });
    }

    if (action === "status") {
      const inst = await getInstancia();
      const evoRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${inst.instance_name}`, {
        method: "GET",
        headers: evoHeaders,
      });
      if (!evoRes.ok) {
        return errorResponse(`Erro ao verificar status: ${evoRes.status}`, 502);
      }
      const data = await evoRes.json();
      const state = data.instance?.state ?? data.state ?? "close";

      // Map Evolution state to our status
      const statusMap: Record<string, string> = {
        open: "conectado",
        close: "desconectado",
        connecting: "aguardando_qr",
      };

      await db
        .from("whatsapp_instancias")
        .update({ status: statusMap[state] ?? "desconectado" })
        .eq("corretor_id", corretorId);

      return jsonResponse({ status: state });
    }

    if (action === "disconnect") {
      const inst = await getInstancia();
      const evoRes = await fetch(`${EVOLUTION_URL}/instance/logout/${inst.instance_name}`, {
        method: "DELETE",
        headers: evoHeaders,
      });
      if (!evoRes.ok) {
        console.error("Evolution logout error:", await evoRes.text());
      }

      await db
        .from("whatsapp_instancias")
        .update({ status: "desconectado" })
        .eq("corretor_id", corretorId);

      return jsonResponse({ success: true });
    }

    return errorResponse("action inválida", 400);
  } catch (err) {
    console.error("whatsapp-connect error:", err);
    return errorResponse(err.message ?? "Erro interno", 500);
  }
});
