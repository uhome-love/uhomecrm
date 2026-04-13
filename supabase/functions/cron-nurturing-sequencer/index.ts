import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Fetch pending sequences that are due
    const { data: pendentes, error: fetchErr } = await admin
      .from("lead_nurturing_sequences")
      .select("*, pipeline_leads!inner(nome, telefone, email, corretor_id)")
      .eq("status", "pendente")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

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
        if (seq.canal === "whatsapp") {
          if (!lead.telefone) {
            await admin.from("lead_nurturing_sequences")
              .update({ status: "erro", error_message: "Lead sem telefone" })
              .eq("id", seq.id);
            erros++;
            continue;
          }

          const { error: waErr } = await admin.functions.invoke("whatsapp-send", {
            body: {
              telefone: lead.telefone,
              nome: lead.nome,
              template: {
                name: seq.template_name,
                language: "pt_BR",
                parameters: {
                  nome: lead.nome || "Cliente",
                },
              },
            },
          });

          if (waErr) throw waErr;

        } else if (seq.canal === "email") {
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
        }

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

      // Small delay between sends
      await new Promise(r => setTimeout(r, 200));
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
