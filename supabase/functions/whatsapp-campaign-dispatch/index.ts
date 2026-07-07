import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isCampaignDispatchEnabled, pausedResponse } from "../_shared/campaign-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_GUARD_COOLDOWN_HOURS = 24;
// Só auto-pausa quando o número acumula muitos bloqueios de qualidade (alinhado à regra de 50 falhas seguidas)
const META_GUARD_QUALITY_FAILS = 50;
// Máximo de falhas CONSECUTIVAS antes de pausar o disparo. Abaixo disso, continua.
const MAX_CONSECUTIVE_FAILS = 50;

async function uploadMetaMediaFromUrl(phoneNumberId: string, accessToken: string, imageUrl: string): Promise<string | null> {
  try {
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return null;
    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([bytes], { type: contentType }), `header.${contentType.includes("png") ? "png" : "jpg"}`);
    const up = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) {
      console.error("uploadMetaMediaFromUrl failed:", JSON.stringify(data).slice(0, 300));
      return null;
    }
    return data?.id || null;
  } catch (e) {
    console.error("uploadMetaMediaFromUrl error:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

function isMetaQualityBlockText(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("healthy ecosystem")
    || m.includes("ecosystem engagement")
    || m.includes("template paused")
    || m.includes("template is paused")
    || m.includes("part of an experiment")
    || m.includes("131049")
    || m.includes("131050")
    || m.includes("132015")
    || m.includes("132016")
    || m.includes("quality rating");
}

function last8(raw: string | null | undefined) {
  const d = String(raw || "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // WABA RECOVERY — gatekeeper global de disparo de campanha
  const gate = await isCampaignDispatchEnabled();
  if (!gate.enabled) return pausedResponse("whatsapp-campaign-dispatch", gate, corsHeaders);

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

      const params = batch.template_params || {};

      // Preflight anti-cascata: se a Meta já bloqueou este template nas últimas 24h,
      // não tenta insistir — erro 131049 tende a repetir e piorar a reputação do número.
      const sinceCooldown = new Date(Date.now() - META_GUARD_COOLDOWN_HOURS * 3600 * 1000).toISOString();
      const { count: recentQualityFails } = await supabase
        .from("whatsapp_campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batch_id)
        .gte("created_at", sinceCooldown)
        .eq("status_envio", "failed")
        .or("error_message.ilike.%131049%,error_message.ilike.%healthy ecosystem%,error_message.ilike.%132015%,error_message.ilike.%132016%");
      if ((recentQualityFails || 0) >= META_GUARD_QUALITY_FAILS) {
        const reason = `Auto-pausa Meta: ${recentQualityFails} bloqueios de qualidade/131049 nas últimas 24h. Aguardando recuperação da reputação do número antes de continuar.`;
        await supabase
          .from("whatsapp_campaign_batches")
          .update({ status: "paused", error_message: reason, updated_at: new Date().toISOString() })
          .eq("id", batch_id);
        return new Response(JSON.stringify({ paused: true, reason: "meta_quality_cooldown", motivo: reason }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let headerMediaId: string | null = null;
      if (params.header_image_url) {
        headerMediaId = await uploadMetaMediaFromUrl(PHONE_NUMBER_ID, WHATSAPP_TOKEN, String(params.header_image_url));
      }

      // === RATE LIMITING (anti-spam Meta policy) ===
      // Daily cap por número WhatsApp: 250 envios/dia
      const DAILY_CAP = 250;
      const todayStart = new Date();
      todayStart.setUTCHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
      const { count: sentToday } = await supabase
        .from("whatsapp_campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("status_envio", "sent")
        .gte("sent_at", todayStart.toISOString());

      const remainingToday = Math.max(0, DAILY_CAP - (sentToday || 0));
      if (remainingToday === 0) {
        console.log(`Daily cap (${DAILY_CAP}) reached. Pausing batch ${batch_id}.`);
        await supabase
          .from("whatsapp_campaign_batches")
          .update({ status: "paused", error_message: `Limite diário de ${DAILY_CAP} envios atingido. Retoma amanhã.` })
          .eq("id", batch_id);
        return new Response(JSON.stringify({ paused: true, reason: "daily_cap_reached", sent_today: sentToday }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Conservador: batch máx 30, respeitando cap restante
      const limit = Math.min(batch.batch_size || 30, 30, remainingToday);
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
      const startTime = Date.now();
      const MAX_EXECUTION_MS = 110_000; // 110s — espaço para delays maiores

      for (const send of sends) {
        // Time guard — stop before edge function timeout
        if (Date.now() - startTime > MAX_EXECUTION_MS) {
          console.log(`Time guard hit after ${sentCount} sends, stopping gracefully`);
          break;
        }

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

          const phoneLast8 = last8(phone);
          if (phoneLast8) {
            const nowIso = new Date().toISOString();
            const { data: supressed } = await supabase
              .from("meta_supressao")
              .select("motivo")
              .eq("telefone_last8", phoneLast8)
              .or(`suprimir_ate.is.null,suprimir_ate.gt.${nowIso}`)
              .maybeSingle();
            if (supressed) {
              await supabase
                .from("whatsapp_campaign_sends")
                .update({ status_envio: "skipped", error_message: `Suprimido Meta: ${supressed.motivo || "bloqueio ativo"}` })
                .eq("id", send.id);
              continue;
            }
          }

          const { data: allowedData, error: allowedErr } = await supabase.rpc("check_send_allowed" as any, {
            p_lead_id: send.pipeline_lead_id || null,
            p_phone: phone,
            p_template: batch.template_name,
          });
          if (!allowedErr && (allowedData as any)?.allowed === false) {
            await supabase
              .from("whatsapp_campaign_sends")
              .update({ status_envio: "skipped", error_message: `Guarda WABA: ${(allowedData as any)?.reason || "bloqueio ativo"}` })
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

          // Add components
          const components: any[] = [];

          // Header image
          if (params.header_image_url) {
            const image = headerMediaId ? { id: headerMediaId } : { link: params.header_image_url };
            components.push({
              type: "header",
              parameters: [{ type: "image", image }],
            });
          }

          // Body params
          if (params.body_params) {
            components.push({
              type: "body",
              parameters: (params.body_params as string[]).map((key: string) => ({
                type: "text",
                text: key === "nome" ? (send.nome || "Cliente") : String(key),
              })),
            });
          }

          // If template has button with dynamic URL tracking (button_dynamic must be true)
          if (params.button_url && params.button_dynamic) {
            const phoneForUrl = encodeURIComponent(String(phone));
            const nomeForUrl = encodeURIComponent(send.nome || "");
            const emailForUrl = encodeURIComponent(send.email || "");
            const campanhaForUrl = encodeURIComponent(batch.campanha || params.campanha || "");

            let fullUrl = params.button_url
              .replace("{{phone}}", phoneForUrl)
              .replace("{{nome}}", nomeForUrl)
              .replace("{{email}}", emailForUrl)
              .replace("{{campanha}}", campanhaForUrl);

            let dynamicSuffix = fullUrl;
            try {
              const urlObj = new URL(fullUrl);
              if (!urlObj.searchParams.has("send_id")) {
                urlObj.searchParams.set("send_id", send.id);
              }
              if (!urlObj.searchParams.has("batch_id")) {
                urlObj.searchParams.set("batch_id", batch_id);
              }
              // Keep the full query string including the leading "?" for the Meta API suffix
              dynamicSuffix = urlObj.search + urlObj.hash;
            } catch {
              const joiner = fullUrl.includes("?") ? "&" : "?";
              fullUrl = `${fullUrl}${joiner}send_id=${encodeURIComponent(send.id)}&batch_id=${encodeURIComponent(batch_id)}`;
              dynamicSuffix = fullUrl;
            }

            components.push({
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: dynamicSuffix }],
            });
          }

          if (components.length > 0) {
            templateBody.template.components = components;
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
            const errCode = waResult?.error?.code ? String(waResult.error.code) : null;
            if (phoneLast8 && (isMetaQualityBlockText(errMsg) || ["131049", "131050", "132015", "132016"].includes(errCode || ""))) {
              const { data: existingSup } = await supabase
                .from("meta_supressao")
                .select("id, ocorrencias")
                .eq("telefone_last8", phoneLast8)
                .maybeSingle();
              const suprimirAte = errCode === "131050" ? null : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
              if (existingSup?.id) {
                await supabase.from("meta_supressao").update({
                  codigo: errCode,
                  motivo: isMetaQualityBlockText(errMsg) ? "Falha de qualidade Meta" : errMsg,
                  template_name: batch.template_name,
                  suprimir_ate: suprimirAte,
                  ocorrencias: (existingSup.ocorrencias || 1) + 1,
                }).eq("id", existingSup.id);
              } else {
                await supabase.from("meta_supressao").insert({
                  telefone: phone,
                  telefone_last8: phoneLast8,
                  codigo: errCode,
                  motivo: isMetaQualityBlockText(errMsg) ? "Falha de qualidade Meta" : errMsg,
                  template_name: batch.template_name,
                  suprimir_ate: suprimirAte,
                });
              }
            }
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

          // Delay aleatório 3-6s entre mensagens (anti-spam Meta, parece humano)
          const jitter = 3000 + Math.floor(Math.random() * 3000);
          await new Promise((r) => setTimeout(r, jitter));
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

      console.log("TEST action", JSON.stringify({ batch_id, send_ids }));

      const { data: sends, error: sendsErr } = await supabase
        .from("whatsapp_campaign_sends")
        .select("*")
        .in("id", send_ids);

      console.log("Test sends", JSON.stringify({ count: sends?.length, err: sendsErr?.message, first: sends?.[0] ? { id: sends[0].id, tel: sends[0].telefone, tel_n: sends[0].telefone_normalizado } : null }));

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
        const components: any[] = [];

        // Header image
        if (params.header_image_url) {
          components.push({
            type: "header",
            parameters: [{ type: "image", image: { link: params.header_image_url } }],
          });
        }

        // Body params
        if (params.body_params) {
          components.push({
            type: "body",
            parameters: (params.body_params as string[]).map((key: string) => ({
              type: "text",
              text: key === "nome" ? (send.nome || "Cliente") : String(key),
            })),
          });
        }

        if (params.button_url && params.button_dynamic) {
          const phoneForUrl = encodeURIComponent(String(phone));
          const nomeForUrl = encodeURIComponent(send.nome || "");
          const emailForUrl = encodeURIComponent(send.email || "");
          const campanhaForUrl = encodeURIComponent(batch.campanha || params.campanha || "");

          let fullUrl = params.button_url
            .replace("{{phone}}", phoneForUrl)
            .replace("{{nome}}", nomeForUrl)
            .replace("{{email}}", emailForUrl)
            .replace("{{campanha}}", campanhaForUrl);

          let dynamicSuffix = fullUrl;
          try {
            const urlObj = new URL(fullUrl);
            if (!urlObj.searchParams.has("send_id")) {
              urlObj.searchParams.set("send_id", send.id);
            }
            if (!urlObj.searchParams.has("batch_id")) {
              urlObj.searchParams.set("batch_id", batch_id);
            }
            // Keep the full query string including the leading "?" for the Meta API suffix
            dynamicSuffix = urlObj.search + urlObj.hash;
          } catch {
            const joiner = fullUrl.includes("?") ? "&" : "?";
            fullUrl = `${fullUrl}${joiner}send_id=${encodeURIComponent(send.id)}&batch_id=${encodeURIComponent(batch_id)}`;
            dynamicSuffix = fullUrl;
          }

          components.push({
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: dynamicSuffix }],
          });
        }

        if (components.length > 0) {
          templateBody.template.components = components;
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
