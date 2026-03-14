import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "visita-whatsapp-confirm";
const DIALOG_API_URL = "https://waba-v2.360dialog.io/messages";

function makeLogger(traceId: string) {
  const emit = (level: string, msg: string, ctx?: Record<string, unknown>, err?: unknown) => {
    const payload = { fn: FN, level, msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() };
    level === "error" ? console.error(JSON.stringify(payload)) : level === "warn" ? console.warn(JSON.stringify(payload)) : console.info(JSON.stringify(payload));
  };
  return {
    info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => emit("warn", msg, ctx, err),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => emit("error", msg, ctx, err),
  };
}

function formatPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) clean = clean.substring(1);
  if (!clean.startsWith("55")) clean = "55" + clean;
  return clean;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "horário a confirmar";
  return timeStr.substring(0, 5);
}

// ─── Retry config ───
// Max 2 retries (3 total attempts). Delays: 1s, 3s (exponential backoff).
// Only retries on transient errors: network failures, 429, 5xx.
// 4xx (except 429) are permanent → no retry to avoid duplicate sends.
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

function isTransient(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sendWhatsApp(
  apiKey: string,
  phone: string,
  message: string,
  logger?: ReturnType<typeof makeLogger>,
): Promise<{ data: Record<string, unknown>; attempts: number }> {
  const formattedPhone = formatPhone(phone);
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "text",
    text: { body: message },
  });

  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(DIALOG_API_URL, {
        method: "POST",
        headers: { "D360-API-KEY": apiKey, "Content-Type": "application/json" },
        body,
      });

      const data = await resp.json();

      if (resp.ok) {
        if (attempt > 1) logger?.info("WhatsApp delivered after retry", { attempt, phone: phone.slice(-4) });
        return { data, attempts: attempt };
      }

      // Permanent error → don't retry to avoid duplicate sends
      if (!isTransient(resp.status)) {
        throw new Error(data?.error?.message || `360dialog error: ${resp.status}`);
      }

      // Transient → will retry
      lastErr = new Error(data?.error?.message || `360dialog transient ${resp.status}`);
      logger?.warn("WhatsApp transient error, will retry", { attempt, status: resp.status, phone: phone.slice(-4) });
    } catch (fetchErr) {
      // Network-level error (DNS, timeout) → transient, retry
      lastErr = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
      if (attempt < MAX_ATTEMPTS) {
        logger?.warn("WhatsApp network error, will retry", { attempt, phone: phone.slice(-4) }, fetchErr);
      }
    }

    // Backoff before next attempt (skip after last attempt)
    if (attempt < MAX_ATTEMPTS) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastErr || new Error("sendWhatsApp failed after retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const L = makeLogger(traceId);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      supabase.from("ops_events").insert({ fn: FN, level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    // Get 360dialog API key
    const { data: setting } = await supabase
      .from("integration_settings")
      .select("value")
      .eq("key", "360dialog_api_key")
      .single();

    if (!setting?.value) {
      L.warn("360dialog API key not configured");
      return new Response(
        JSON.stringify({ error: "API key do 360dialog não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = setting.value;
    const { action, visita_id, visita_data } = await req.json();

    // ─── ACTION: confirm (Trigger 1 — immediate on creation) ───
    if (action === "confirm") {
      const visita = visita_data;
      if (!visita?.telefone) {
        return new Response(
          JSON.stringify({ success: false, reason: "no_phone" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get corretor name
      let corretorNome = "seu corretor";
      if (visita.corretor_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome")
          .eq("user_id", visita.corretor_id)
          .maybeSingle();
        if (profile?.nome) corretorNome = profile.nome;
      }

      // Build confirmation link if token available
      const confirmLink = visita.confirmation_token
        ? `\n\nPara confirmar, reagendar ou cancelar sua visita, acesse:\nhttps://uhomesales.com/visita/${visita.confirmation_token}`
        : "";

      const message = `Olá ${visita.nome_cliente || ""}! 👋 Sua visita ao ${visita.empreendimento || "empreendimento"} está confirmada para ${formatDate(visita.data_visita)} às ${formatTime(visita.hora_visita)}. Seu corretor ${corretorNome} estará te esperando.${confirmLink}\nQualquer dúvida é só responder esta mensagem. Até lá! 🏠`;

      try {
        const { data: result, attempts } = await sendWhatsApp(apiKey, visita.telefone, message, L);
        L.info("Confirmation sent", { visita_id, phone: visita.telefone?.slice(-4), attempts });
        return new Response(
          JSON.stringify({ success: true, message_id: result?.messages?.[0]?.id, attempts }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (sendErr) {
        L.error("Confirmation WhatsApp failed after retries", { visita_id }, sendErr);
        logOps("error", "integration", "WhatsApp confirmation send failed after retries", { visita_id }, sendErr instanceof Error ? sendErr.message : String(sendErr));
        throw sendErr;
      }
    }

    // ─── ACTION: reminder_cron (Trigger 2 — 24h before) ───
    if (action === "reminder_cron") {
      // Calculate tomorrow's date in BRT
      const now = new Date();
      const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const tomorrow = new Date(brt);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      // Fetch visits scheduled for tomorrow with status marcada or confirmada
      const { data: visitas, error } = await supabase
        .from("visitas")
        .select("id, nome_cliente, telefone, empreendimento, data_visita, hora_visita, corretor_id, status")
        .eq("data_visita", tomorrowStr)
        .in("status", ["marcada", "confirmada"]);

      if (error) {
        L.error("Failed to fetch visitas", {}, error);
        logOps("error", "system", "Failed to fetch visitas for reminder", {}, error.message);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar visitas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let sent = 0;
      let skipped = 0;
      let errors = 0;

      for (const v of visitas || []) {
        if (!v.telefone) {
          skipped++;
          continue;
        }

        // Get corretor name
        let corretorNome = "seu corretor";
        if (v.corretor_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome")
            .eq("user_id", v.corretor_id)
            .maybeSingle();
          if (profile?.nome) corretorNome = profile.nome;
        }

        const message = `Olá ${v.nome_cliente || ""}! 🔔 Lembrete: amanhã às ${formatTime(v.hora_visita)} você tem visita ao ${v.empreendimento || "empreendimento"} com ${corretorNome}. Confirma sua presença? Responda SIM para confirmar ou NOS chame para reagendar.`;

        try {
          await sendWhatsApp(apiKey, v.telefone, message, L);
          sent++;
        } catch (e) {
          L.warn("Reminder send failed after retries", { visita_id: v.id }, e);
          errors++;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 300));
      }

      const result = { total: (visitas || []).length, sent, skipped, errors, date: tomorrowStr };
      L.info("Reminder cron complete", result as unknown as Record<string, unknown>);
      if (sent > 0 || errors > 0) {
        logOps("info", "business", `Visit reminders: ${sent} sent, ${errors} errors, ${skipped} skipped`, result as unknown as Record<string, unknown>);
      }
      if (errors > 0) {
        logOps("warn", "integration", `${errors} WhatsApp reminder(s) failed`, { errors, total: (visitas || []).length });
      }

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    L.warn("Invalid action received", { action });
    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    L.error("Unhandled exception", {}, e);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      sb.from("ops_events").insert({ fn: FN, level: "error", category: "system", message: "Unhandled exception", trace_id: traceId, ctx: {}, error_detail: e instanceof Error ? e.message : String(e) }).then(() => {});
    } catch {}
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
