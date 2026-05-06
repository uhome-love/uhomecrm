// calendar-create-event — cria evento no Google Calendar do corretor
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getValidGoogleAccessToken } from "../_shared/google-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims, error: cErr } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
    if (cErr || !claims?.claims) return errorResponse("Unauthorized", 401);
    const userId = claims.claims.sub as string;

    const { visita_id } = await req.json();
    if (!visita_id) return errorResponse("visita_id required", 400);

    const sbAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: visita, error: vErr } = await sbAdmin
      .from("visitas")
      .select("*")
      .eq("id", visita_id)
      .maybeSingle();
    if (vErr || !visita) return errorResponse("Visita não encontrada", 404);

    const corretorId = visita.corretor_id || userId;
    const tokenInfo = await getValidGoogleAccessToken(corretorId);
    if (!tokenInfo) {
      await sbAdmin.from("visitas").update({ confirmacao_status: "corretor_sem_calendario" }).eq("id", visita_id);
      return errorResponse("Corretor não conectou o Google Calendar", 412);
    }

    // Buscar email/telefone do lead
    let clienteEmail: string | null = null;
    let clienteTel: string | null = null;
    if (visita.pipeline_lead_id) {
      const { data: lead } = await sbAdmin
        .from("pipeline_leads")
        .select("email, telefone")
        .eq("id", visita.pipeline_lead_id)
        .maybeSingle();
      clienteEmail = lead?.email ?? null;
      clienteTel = lead?.telefone ?? null;
    }

    const dateStr = visita.data_visita; // YYYY-MM-DD
    const timeStr = (visita.hora_visita || "10:00").slice(0, 5);
    const startISO = `${dateStr}T${timeStr}:00-03:00`;
    const [hh, mm] = timeStr.split(":").map(Number);
    const endHH = String((hh + 1) % 24).padStart(2, "0");
    const endISO = `${dateStr}T${endHH}:${String(mm).padStart(2, "0")}:00-03:00`;

    const eventBody: Record<string, unknown> = {
      summary: `Visita — ${visita.empreendimento || "Empreendimento"}`,
      description: [
        `Cliente: ${visita.nome_cliente}`,
        clienteTel ? `Telefone: ${clienteTel}` : null,
        visita.observacoes ? `Obs: ${visita.observacoes}` : null,
      ].filter(Boolean).join("\n"),
      location: visita.local_visita || visita.empreendimento || "",
      start: { dateTime: startISO, timeZone: "America/Sao_Paulo" },
      end: { dateTime: endISO, timeZone: "America/Sao_Paulo" },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 1440 },
          { method: "popup", minutes: 60 },
        ],
      },
    };
    if (clienteEmail) {
      eventBody.attendees = [{ email: clienteEmail, displayName: visita.nome_cliente }];
    }

    const sendUpdates = clienteEmail ? "all" : "none";
    const gRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${sendUpdates}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenInfo.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      },
    );
    const gJson = await gRes.json();
    if (!gRes.ok) {
      console.error("Google event error:", gJson);
      await sbAdmin.from("visitas").update({
        confirmacao_status: "falhou",
        confirmacao_enviada_em: new Date().toISOString(),
      }).eq("id", visita_id);
      return errorResponse(gJson.error?.message || "Falha ao criar evento", 500);
    }

    await sbAdmin.from("visitas").update({
      google_event_id: gJson.id,
      google_event_link: gJson.htmlLink,
      confirmacao_status: "enviada",
      confirmacao_enviada_em: new Date().toISOString(),
    }).eq("id", visita_id);

    return jsonResponse({
      success: true,
      event_id: gJson.id,
      event_link: gJson.htmlLink,
      cliente_recebeu_email: !!clienteEmail,
    });
  } catch (e) {
    console.error(e);
    return errorResponse((e as Error).message, 500);
  }
});
