import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      throw new Error("WhatsApp credentials not configured");
    }

    const { action, batch_id, send_ids } = await req.json();

    // ACTION: dispatch — process a batch of sends
    if (action === "dispatch") {
      if (!batch_id) throw new Error("batch_id required");

      // Get batch config
      const { data: batch, error: batchErr } = await supabase
        .from("whatsapp_campaign_batches")
        .select("*")
        .eq("id", batch_id)
        .single();

      if (batchErr || !batch) throw new Error("Batch not found");
      if (batch.status === "paused" || batch.status === "cancelled") {
        return new Response(JSON.stringify({ stopped: true, reason: batch.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get pending sends for this batch (limit by batch_size)
      const limit = batch.batch_size || 500;
      const { data: sends, error: sendsErr } = await supabase
        .from("whatsapp_campaign_sends")
        .select("*")
        .eq("batch_id", batch_id)
        .eq("status_envio", "pending")
        .order("created_at")
        .limit(limit);

      if (sendsErr) throw sendsErr;
      if (!sends || sends.length === 0) {
        // Mark batch as completed
        await supabase
          .from("whatsapp_campaign_batches")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", batch_id);

        return new Response(JSON.stringify({ completed: true, processed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update batch status to sending
      if (batch.status === "draft" || batch.status === "queued") {
        await supabase
          .from("whatsapp_campaign_batches")
          .update({ status: "sending", started_at: new Date().toISOString() })
          .eq("id", batch_id);
      }

      let sentCount = 0;
      let failCount = 0;

      for (const send of sends) {
        // Re-check batch status for pause/cancel
        if (sentCount > 0 && sentCount % 50 === 0) {
          const { data: freshBatch } = await supabase
            .from("whatsapp_campaign_batches")
            .select("status")
            .eq("id", batch_id)
            .single();
          if (freshBatch?.status === "paused" || freshBatch?.status === "cancelled") {
            break;
          }
        }

        try {
          const phone = send.telefone_normalizado || send.telefone;
          if (!phone) {
            await supabase
              .from("whatsapp_campaign_sends")
              .update({ status_envio: "skipped", error_message: "Sem telefone" })
              .eq("id", send.id);
            continue;
          }

          // Build template body
          const templateBody: any = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phone,
            type: "template",
            template: {
              name: batch.template_name,
              language: { code: batch.template_language || "pt_BR" },
            },
          };

          // Add parameters if configured
          const params = batch.template_params || {};
          if (params.body_params) {
            templateBody.template.components = [
              {
                type: "body",
                parameters: (params.body_params as string[]).map((key: string) => ({
                  type: "text",
                  text: key === "nome" ? (send.nome || "Cliente") : String(key),
                })),
              },
            ];
          }

          // If template has button with URL tracking
          if (params.button_url) {
            const trackUrl = params.button_url
              .replace("{{phone}}", phone)
              .replace("{{nome}}", encodeURIComponent(send.nome || ""));

            const btnComponent: any = {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: trackUrl }],
            };

            if (!templateBody.template.components) {
              templateBody.template.components = [];
            }
            templateBody.template.components.push(btnComponent);
          }

          // Send via WhatsApp Cloud API
          const waResponse = await fetch(
            `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(templateBody),
            }
          );

          const waResult = await waResponse.json();

          if (waResponse.ok) {
            const messageId = waResult.messages?.[0]?.id;
            await supabase
              .from("whatsapp_campaign_sends")
              .update({
                status_envio: "sent",
                message_id: messageId,
                sent_at: new Date().toISOString(),
                response_payload: waResult,
              })
              .eq("id", send.id);
            sentCount++;
          } else {
            const errMsg = waResult?.error?.message || "Unknown WhatsApp error";
            await supabase
              .from("whatsapp_campaign_sends")
              .update({
                status_envio: "failed",
                error_message: errMsg,
                response_payload: waResult,
              })
              .eq("id", send.id);
            failCount++;
          }

          // Small delay between messages to respect rate limits
          await new Promise((r) => setTimeout(r, 100));
        } catch (sendErr) {
          await supabase
            .from("whatsapp_campaign_sends")
            .update({
              status_envio: "failed",
              error_message: sendErr instanceof Error ? sendErr.message : "Unknown error",
            })
            .eq("id", send.id);
          failCount++;
        }
      }

      // Update batch counters
      const { data: counts } = await supabase.rpc("get_campaign_batch_counts" as any, { p_batch_id: batch_id });

      // Fallback: manual count
      const { count: totalSent } = await supabase
        .from("whatsapp_campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batch_id)
        .eq("status_envio", "sent");

      const { count: totalFailed } = await supabase
        .from("whatsapp_campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batch_id)
        .eq("status_envio", "failed");

      const { count: totalPending } = await supabase
        .from("whatsapp_campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batch_id)
        .eq("status_envio", "pending");

      const updateData: any = {
        total_sent: totalSent || 0,
        total_failed: totalFailed || 0,
        updated_at: new Date().toISOString(),
      };

      if ((totalPending || 0) === 0) {
        updateData.status = "completed";
        updateData.completed_at = new Date().toISOString();
      }

      await supabase
        .from("whatsapp_campaign_batches")
        .update(updateData)
        .eq("id", batch_id);

      return new Response(
        JSON.stringify({ processed: sentCount, failed: failCount, remaining: totalPending || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: test — send to specific leads only
    if (action === "test") {
      if (!batch_id || !send_ids?.length) throw new Error("batch_id and send_ids required");

      // Mark selected as pending, rest as skipped for test
      // Then dispatch just those
      const { data: sends } = await supabase
        .from("whatsapp_campaign_sends")
        .select("*")
        .in("id", send_ids);

      if (!sends?.length) throw new Error("No test sends found");

      const { data: batch } = await supabase
        .from("whatsapp_campaign_batches")
        .select("*")
        .eq("id", batch_id)
        .single();

      if (!batch) throw new Error("Batch not found");

      let sentCount = 0;
      for (const send of sends) {
        const phone = send.telefone_normalizado || send.telefone;
        if (!phone) continue;

        const templateBody: any = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: batch.template_name,
            language: { code: batch.template_language || "pt_BR" },
          },
        };

        const params = batch.template_params || {};
        if (params.body_params) {
          templateBody.template.components = [
            {
              type: "body",
              parameters: (params.body_params as string[]).map((key: string) => ({
                type: "text",
                text: key === "nome" ? (send.nome || "Cliente") : String(key),
              })),
            },
          ];
        }

        try {
          const waResponse = await fetch(
            `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(templateBody),
            }
          );
          const waResult = await waResponse.json();

          if (waResponse.ok) {
            await supabase
              .from("whatsapp_campaign_sends")
              .update({
                status_envio: "sent",
                message_id: waResult.messages?.[0]?.id,
                sent_at: new Date().toISOString(),
                response_payload: waResult,
              })
              .eq("id", send.id);
            sentCount++;
          } else {
            await supabase
              .from("whatsapp_campaign_sends")
              .update({
                status_envio: "failed",
                error_message: waResult?.error?.message || "Error",
                response_payload: waResult,
              })
              .eq("id", send.id);
          }
        } catch (err) {
          await supabase
            .from("whatsapp_campaign_sends")
            .update({
              status_envio: "failed",
              error_message: err instanceof Error ? err.message : "Error",
            })
            .eq("id", send.id);
        }
      }

      return new Response(JSON.stringify({ test: true, sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-campaign-dispatch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
