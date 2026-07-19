import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cron-auth.ts";
import { isFlagEnabled } from "../_shared/campaign-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Valida se a chamada é de um usuário autenticado (Central de Nutrição, "Processar agora").
async function isAuthenticatedUser(req: Request): Promise<boolean> {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return false;
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await client.auth.getUser();
    return !error && !!data?.user;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Autenticação: aceita cron (secret/service key) OU usuário autenticado (disparo manual).
  const manualUser = await isAuthenticatedUser(req);
  if (!manualUser) {
    const cronDenied = requireCronAuth(req);
    if (cronDenied) return cronDenied;
  }

  // GATE NUTRIÇÃO — só processa quando a chave mestra está LIGADA por você.
  // Nunca dispara sozinho: crons ficam inativos e a chave começa desligada.
  const gate = await isFlagEnabled("nutricao_enabled");
  if (!gate.enabled) {
    return new Response(
      JSON.stringify({
        paused: true,
        function: "cron-nurturing-sequencer",
        message: "Nutrição desligada — ligue a chave mestra na Central para processar o fluxo.",
        flag_reason: gate.reason ?? null,
        sent: 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }


  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // === Canal WhatsApp descontinuado neste cron ===
    // O envio WhatsApp de reengajamento é feito diretamente por
    // reengajamento-descartados-enqueue / whatsapp-campaign-dispatch (Meta Graph API).
    // Aqui só processamos EMAIL. Sequências antigas com canal='whatsapp' presas em
    // 'pendente' são marcadas como 'skipped' para limpar a fila e ficar auditável.
    const { data: waLegacy, error: waLegacyErr } = await admin
      .from("lead_nurturing_sequences")
      .update({
        status: "skipped",
        error_message: "canal_whatsapp_descontinuado",
        sent_at: new Date().toISOString(),
      })
      .eq("status", "pendente")
      .eq("canal", "whatsapp")
      .select("id");
    if (waLegacyErr) {
      console.error("Skip WA legacy sequences error:", waLegacyErr);
    } else if (waLegacy && waLegacy.length > 0) {
      console.log(`Skipped ${waLegacy.length} WhatsApp legacy sequences (canal_whatsapp_descontinuado)`);
    }

    // Conservador: 20 por execução (agora só email)
    const { data: pendentes, error: fetchErr } = await admin
      .from("lead_nurturing_sequences")
      .select("*, pipeline_leads!inner(nome, telefone, email, corretor_id)")
      .eq("status", "pendente")
      .eq("canal", "email")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);


    if (fetchErr) {
      console.error("Fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendentes || pendentes.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "Nenhum envio pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${pendentes.length} pending nurturing messages`);

    let enviados = 0;
    let erros = 0;
    let skipped = 0;

    // Mailgun foi cancelado (19/07/2026) — não há mais canal de envio
    // disponível para esta cadência (que, por sinal, já não era usada de
    // fato em produção — só "Sem Contato" é uma cadência viva de verdade,
    // ver auditoria uhomecrm-expert). Marca toda pendência como skipped,
    // sem tentar nenhum envio.
    for (const seq of pendentes) {
      const lead = seq.pipeline_leads;
      if (!lead) {
        await admin.from("lead_nurturing_sequences")
          .update({ status: "erro", error_message: "Lead não encontrado" })
          .eq("id", seq.id);
        erros++;
        continue;
      }

      await admin.from("lead_nurturing_sequences")
        .update({ status: "skipped", error_message: `canal_${seq.canal}_descontinuado`, sent_at: new Date().toISOString() })
        .eq("id", seq.id);
      skipped++;
    }

    console.log(`Nurturing sequencer done: ${skipped} skipped (mailgun descontinuado), ${erros} erros`);

    return new Response(
      JSON.stringify({ processed: pendentes.length, enviados, erros, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("cron-nurturing-sequencer error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
