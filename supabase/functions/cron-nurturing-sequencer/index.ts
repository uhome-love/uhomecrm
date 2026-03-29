import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const whatsappToken = Deno.env.get("WHATSAPP_TOKEN");
    const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    // Fetch pending sequences that are due
    const { data: pendingSteps, error: fetchError } = await supabase
      .from("lead_nurturing_sequences")
      .select("*, pipeline_leads!inner(id, nome, telefone, empreendimento, corretor_id)")
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

    let processed = 0;
    let errors = 0;

    for (const step of pendingSteps) {
      const lead = (step as any).pipeline_leads;
      if (!lead || !lead.telefone) {
        // Mark as error if no phone
        await supabase
          .from("lead_nurturing_sequences")
          .update({ status: "erro", error_message: "Lead sem telefone" })
          .eq("id", step.id);
        errors++;
        continue;
      }

      let sendSuccess = false;
      let errorMsg = "";

      // Try to send WhatsApp if configured
      if (whatsappToken && whatsappPhoneId && step.canal === "whatsapp" && step.template_name) {
        try {
          // Normalize phone
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
          } else {
            const errData = await waResponse.json();
            errorMsg = JSON.stringify(errData?.error?.message || errData).slice(0, 500);
            console.error(`WhatsApp send error for step ${step.id}:`, errorMsg);
          }
        } catch (e) {
          errorMsg = e.message || "WhatsApp send failed";
          console.error(`WhatsApp exception for step ${step.id}:`, e);
        }
      } else {
        // No WhatsApp config or not whatsapp channel — mark as sent (logged only)
        sendSuccess = true;
        errorMsg = "Disparo registrado (WhatsApp não configurado)";
      }

      // Update step status
      await supabase
        .from("lead_nurturing_sequences")
        .update({
          status: sendSuccess ? "enviado" : "erro",
          sent_at: sendSuccess ? new Date().toISOString() : null,
          error_message: sendSuccess ? null : errorMsg,
        })
        .eq("id", step.id);

      // MANDATORY: Log in pipeline_atividades for lead timeline
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
  } catch (err) {
    console.error("Nurturing sequencer error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
