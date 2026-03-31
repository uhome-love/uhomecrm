import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getEmailSettings,
  sendViaMailgun,
  replacePlaceholders,
} from "../_shared/mailgun-campaigns.ts";
import { renderNurturingEmail } from "../_shared/nurturing-email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Horário inteligente por canal (BRT = UTC-3) ──
function isWithinWindow(canal: string): boolean {
  const now = new Date();
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  const day = now.getUTCDay();

  if (canal === "whatsapp") return brtHour >= 8 && brtHour < 21 && day >= 1 && day <= 6;
  if (canal === "email") return brtHour >= 7 && brtHour < 22; // email any day
  if (canal === "voz") return brtHour >= 9 && brtHour < 20 && day >= 1 && day <= 5;
  return true;
}

// ── Call orchestrator to update scoring ──
async function notifyOrchestrator(supabaseUrl: string, serviceKey: string, event_type: string, pipeline_lead_id: string, canal: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/nurturing-orchestrator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ event_type, pipeline_lead_id, canal }),
    });
  } catch (e) {
    console.error("Orchestrator notify failed:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_TOKEN");
    const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY");

    // Fetch pending sequences that are due
    const { data: pendingSteps, error: fetchError } = await supabase
      .from("lead_nurturing_sequences")
      .select("*, pipeline_leads!inner(id, nome, telefone, email, empreendimento, corretor_id)")
      .eq("status", "pendente")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching pending steps:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingSteps || pendingSteps.length === 0) {
      return new Response(JSON.stringify({ message: "No pending steps", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load Mailgun settings once if we have email steps
    let emailSettings: Record<string, string> | null = null;

    let processed = 0;
    let errors = 0;

    for (const step of pendingSteps) {
      const lead = (step as any).pipeline_leads;
      const canal = step.canal || "whatsapp";

      // ── Horário inteligente: se fora da janela, reagendar ──
      if (!isWithinWindow(canal)) {
        // Reagendar para próximo horário válido (manhã seguinte)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (canal === "whatsapp") tomorrow.setUTCHours(11, 0, 0, 0); // 8h BRT
        else if (canal === "email") tomorrow.setUTCHours(12, 0, 0, 0); // 9h BRT
        else tomorrow.setUTCHours(12, 0, 0, 0);

        await supabase
          .from("lead_nurturing_sequences")
          .update({ scheduled_at: tomorrow.toISOString() } as any)
          .eq("id", step.id);
        continue;
      }

      // ── Check lead_nurturing_state for score-based skipping ──
      const { data: nurState } = await supabase
        .from("lead_nurturing_state")
        .select("lead_score, status")
        .eq("pipeline_lead_id", lead.id)
        .single();

      if (nurState) {
        // Opt-out or already responded → skip
        if (["opt_out", "respondeu", "converteu"].includes(nurState.status)) {
          await supabase
            .from("lead_nurturing_sequences")
            .update({ status: "cancelado" } as any)
            .eq("id", step.id);
          continue;
        }

        // Score-based channel optimization
        const score = nurState.lead_score || 0;
        if (score < 0) {
          // Negative score = opt-out, cancel everything
          await supabase
            .from("lead_nurturing_sequences")
            .update({ status: "cancelado" } as any)
            .eq("id", step.id);
          continue;
        }

        // Gelado (0-4): skip WhatsApp, only email/voz
        if (score <= 4 && canal === "whatsapp") {
          await supabase
            .from("lead_nurturing_sequences")
            .update({ status: "cancelado", error_message: "Score baixo — canal WhatsApp pulado" } as any)
            .eq("id", step.id);
          continue;
        }
      }

      // ── CANAL: EMAIL ──
      if (canal === "email") {
        const leadEmail = lead?.email;
        if (!leadEmail) {
          await supabase
            .from("lead_nurturing_sequences")
            .update({ status: "erro", error_message: "Lead sem e-mail" } as any)
            .eq("id", step.id);
          errors++;
          continue;
        }

        if (!mailgunApiKey) {
          await supabase
            .from("lead_nurturing_sequences")
            .update({ status: "erro", error_message: "Mailgun não configurado" } as any)
            .eq("id", step.id);
          errors++;
          continue;
        }

        // Lazy-load settings
        if (!emailSettings) {
          emailSettings = await getEmailSettings(supabase);
        }

        const templateKey = (step as any).template_key || "reativacao-vitrine";
        const vars: Record<string, string> = {
          nome: lead.nome?.split(" ")[0] || "Cliente",
          nome_completo: lead.nome || "Cliente",
          empreendimento: lead.empreendimento || "nosso empreendimento",
          corretor_nome: "",
          vitrine_url: (step as any).vitrine_url || "",
        };

        // Fetch corretor name if available
        if (lead.corretor_id) {
          const { data: corretor } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", lead.corretor_id)
            .single();
          if (corretor) vars.corretor_nome = corretor.nome || "";
        }

        const rendered = renderNurturingEmail(templateKey, vars);
        if (!rendered) {
          await supabase
            .from("lead_nurturing_sequences")
            .update({ status: "erro", error_message: `Template não encontrado: ${templateKey}` } as any)
            .eq("id", step.id);
          errors++;
          continue;
        }

        try {
          const result = await sendViaMailgun(emailSettings, mailgunApiKey, {
            to: leadEmail,
            to_name: lead.nome || undefined,
            subject: rendered.subject,
            html: rendered.html,
            lead_id: lead.id,
            tags: ["nurturing", step.stage_tipo || "geral"],
          }, 2);

          if (result.success) {
            await supabase
              .from("lead_nurturing_sequences")
              .update({
                status: "enviado",
                sent_at: new Date().toISOString(),
                error_message: null,
              } as any)
              .eq("id", step.id);
            processed++;
            // Notify orchestrator
            notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_entregue", lead.id, "email");
          } else {
            await supabase
              .from("lead_nurturing_sequences")
              .update({
                status: "erro",
                error_message: result.error?.slice(0, 500) || "Mailgun error",
              } as any)
              .eq("id", step.id);
            errors++;
          }
        } catch (e: any) {
          await supabase
            .from("lead_nurturing_sequences")
            .update({ status: "erro", error_message: e.message?.slice(0, 500) || "Email send failed" } as any)
            .eq("id", step.id);
          errors++;
        }

        // Log in timeline
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: lead.id,
          tipo: "nurturing_sequencia",
          titulo: `📧 E-mail: ${rendered.subject.slice(0, 60)}`,
          descricao: `E-mail automático (${step.stage_tipo}) — ${processed > 0 ? "Enviado" : "Erro"}`,
          data: new Date().toLocaleDateString("en-CA"),
          prioridade: "media",
          status: "concluida",
          created_by: lead.corretor_id || "00000000-0000-0000-0000-000000000000",
        });

        continue;
      }

      // ── CANAL: WHATSAPP (lógica original) ──
      if (!lead || !lead.telefone) {
        await supabase
          .from("lead_nurturing_sequences")
          .update({ status: "erro", error_message: "Lead sem telefone" } as any)
          .eq("id", step.id);
        errors++;
        continue;
      }

      let sendSuccess = false;
      let errorMsg = "";

      if (whatsappToken && whatsappPhoneId && step.template_name) {
        try {
          let phone = lead.telefone.replace(/\D/g, "");
          if (!phone.startsWith("55")) phone = "55" + phone;

          const nome = lead.nome?.split(" ")[0] || "Cliente";
          const emp = lead.empreendimento || "nosso empreendimento";

          const waResponse = await fetch(
            `https://graph.facebook.com/v21.0/${whatsappPhoneId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${whatsappToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "template",
                template: {
                  name: step.template_name,
                  language: { code: "pt_BR" },
                  components: [
                    {
                      type: "body",
                      parameters: [
                        { type: "text", text: nome },
                        { type: "text", text: emp },
                      ],
                    },
                  ],
                },
              }),
            }
          );

          if (waResponse.ok) {
            sendSuccess = true;
            // Notify orchestrator about WhatsApp sent
            notifyOrchestrator(supabaseUrl, serviceKey, "whatsapp_entregue", lead.id, "whatsapp");
          } else {
            const errData = await waResponse.json();
            errorMsg = JSON.stringify(errData?.error?.message || errData).slice(0, 500);
            console.error(`WhatsApp send error for step ${step.id}:`, errorMsg);
          }
        } catch (e: any) {
          errorMsg = e.message || "WhatsApp send failed";
          console.error(`WhatsApp exception for step ${step.id}:`, e);
        }
      } else {
        sendSuccess = true;
        errorMsg = "Disparo registrado (WhatsApp não configurado)";
      }

      await supabase
        .from("lead_nurturing_sequences")
        .update({
          status: sendSuccess ? "enviado" : "erro",
          sent_at: sendSuccess ? new Date().toISOString() : null,
          error_message: sendSuccess ? null : errorMsg,
        } as any)
        .eq("id", step.id);

      // Log in pipeline_atividades
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "nurturing_sequencia",
        titulo: `📨 ${step.mensagem || step.step_key}`,
        descricao: `Sequência automática (${step.stage_tipo}) — ${sendSuccess ? "Enviado" : "Erro: " + errorMsg}`,
        data: new Date().toLocaleDateString("en-CA"),
        prioridade: "media",
        status: "concluida",
        created_by: lead.corretor_id || "00000000-0000-0000-0000-000000000000",
      });

      if (sendSuccess) processed++;
      else errors++;
    }

    console.log(`Nurturing sequencer: ${processed} sent, ${errors} errors`);

    return new Response(
      JSON.stringify({ processed, errors, total: pendingSteps.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Nurturing sequencer error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
