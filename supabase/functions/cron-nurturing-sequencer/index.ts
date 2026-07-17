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

    for (const seq of pendentes) {
      const lead = seq.pipeline_leads;
      if (!lead) {
        await admin.from("lead_nurturing_sequences")
          .update({ status: "erro", error_message: "Lead não encontrado" })
          .eq("id", seq.id);
        erros++;
        continue;
      }

      try {
        if (seq.canal !== "email") {
          // Defesa em profundidade: se algum canal não-email escapar do filtro, marca skipped.
          await admin.from("lead_nurturing_sequences")
            .update({ status: "skipped", error_message: `canal_${seq.canal}_descontinuado`, sent_at: new Date().toISOString() })
            .eq("id", seq.id);
          continue;
        }

        if (!lead.email) {
          await admin.from("lead_nurturing_sequences")
            .update({ status: "erro", error_message: "Lead sem email" })
            .eq("id", seq.id);
          erros++;
          continue;
        }

        const { error: mailErr } = await admin.functions.invoke("mailgun-send", {
          body: {
            mode: "single",
            to: lead.email,
            to_name: lead.nome,
            subject: `${lead.nome || "Olá"}, temos novidades para você`,
            html: `<p>Olá ${lead.nome || ""},</p><p>${seq.mensagem || "Temos novidades para você!"}</p>`,
            lead_id: seq.pipeline_lead_id,
          },
        });

        if (mailErr) throw mailErr;


        // Mark as sent
        await admin.from("lead_nurturing_sequences")
          .update({ status: "enviado", sent_at: new Date().toISOString() })
          .eq("id", seq.id);
        enviados++;

        // Update lead_nurturing_state step
        const stepNum = parseInt(seq.step_key?.replace(/.*step/, "") || "0");
        if (stepNum > 0) {
          // Check if this is the last step
          const { data: maxStepData } = await admin
            .from("nurturing_cadencias")
            .select("step_number")
            .eq("stage_tipo", seq.stage_tipo)
            .eq("is_active", true)
            .order("step_number", { ascending: false })
            .limit(1)
            .single();

          const isLastStep = maxStepData && stepNum >= maxStepData.step_number;

          if (isLastStep) {
            await admin.from("lead_nurturing_state")
              .update({ status: "encerrado", step_atual: stepNum, updated_at: new Date().toISOString() })
              .eq("pipeline_lead_id", seq.pipeline_lead_id);
          } else {
            // Get next step scheduled_at
            const { data: nextSeq } = await admin
              .from("lead_nurturing_sequences")
              .select("scheduled_at")
              .eq("pipeline_lead_id", seq.pipeline_lead_id)
              .eq("status", "pendente")
              .order("scheduled_at", { ascending: true })
              .limit(1)
              .single();

            await admin.from("lead_nurturing_state")
              .update({
                step_atual: stepNum,
                canal_ultimo: seq.canal,
                ultimo_evento: "envio_" + seq.canal,
                ultimo_evento_at: new Date().toISOString(),
                proximo_step_at: nextSeq?.scheduled_at || null,
                updated_at: new Date().toISOString(),
              })
              .eq("pipeline_lead_id", seq.pipeline_lead_id);
          }
        }

      } catch (sendErr: any) {
        console.error(`Error sending ${seq.canal} to lead ${seq.pipeline_lead_id}:`, sendErr);
        await admin.from("lead_nurturing_sequences")
          .update({ status: "erro", error_message: sendErr?.message || "Erro no envio" })
          .eq("id", seq.id);
        erros++;
      }

      // Delay 3-6s aleatório para WhatsApp; 500ms para email
      const isWa = seq.canal === "whatsapp";
      const delayMs = isWa ? 3000 + Math.floor(Math.random() * 3000) : 500;
      await new Promise(r => setTimeout(r, delayMs));
    }

    console.log(`Nurturing sequencer done: ${enviados} enviados, ${erros} erros`);

    return new Response(
      JSON.stringify({ processed: pendentes.length, enviados, erros }),
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
