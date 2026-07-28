// Meta CAPI Dispatcher
// - Reads pending events from meta_capi_queue (FOR UPDATE SKIP LOCKED via RPC)
// - Batches up to 100 events per POST to graph.facebook.com
// - Marks sent/failed with fbtrace_id and retry backoff
// Auth: header x-cron-secret must match CAPI_CRON_SECRET (public endpoint, verify_jwt=false)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const META_API_VERSION = "v21.0";
const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CAPI_CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const datasetId = Deno.env.get("META_DATASET_ID");
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!datasetId || !token) {
    return new Response(JSON.stringify({ error: "missing META_DATASET_ID or META_CAPI_TOKEN" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional test mode
  let testEventCode: string | undefined;
  try {
    const body = await req.json();
    if (body?.test_event_code) testEventCode = String(body.test_event_code);
  } catch (_) { /* no body */ }

  // Claim a batch atomically via RPC
  const { data: claimed, error: claimErr } = await supabase.rpc("claim_meta_capi_batch", {
    _limit: BATCH_SIZE,
  });

  if (claimErr) {
    console.error("claim error:", claimErr.message);
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const events = (claimed ?? []) as Array<{
    event_id: string;
    payload: Record<string, unknown>;
    attempts: number;
  }>;

  if (events.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, message: "no pending events" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = events.map((e) => e.payload);
  const body: Record<string, unknown> = { data };
  if (testEventCode) body.test_event_code = testEventCode;

  const url = `https://graph.facebook.com/${META_API_VERSION}/${datasetId}/events?access_token=${token}`;
  const eventIds = events.map((e) => e.event_id);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }

    if (res.ok) {
      const fbtraceId = json?.fbtrace_id ?? null;
      await supabase.rpc("mark_meta_capi_sent", {
        _event_ids: eventIds,
        _fbtrace_id: fbtraceId,
      });
      return new Response(
        JSON.stringify({
          ok: true,
          sent: events.length,
          events_received: json?.events_received ?? null,
          fbtrace_id: fbtraceId,
          test_mode: !!testEventCode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Failure: bump attempts / mark failed
    console.error("META CAPI ERROR — full response:", res.status, text.slice(0, 2000));
    console.error("META CAPI ERROR — first payload event:", JSON.stringify(data[0]).slice(0, 1000));
    const errObj = json?.error ?? {};
    const errMsg = [errObj.message, errObj.error_user_title, errObj.error_user_msg, `subcode=${errObj.error_subcode}`, `code=${errObj.code}`]
      .filter(Boolean).join(" | ") || text.slice(0, 500);
    await supabase.rpc("mark_meta_capi_failed", {
      _event_ids: eventIds,
      _error: errMsg,
      _max_attempts: MAX_ATTEMPTS,
    });
    return new Response(
      JSON.stringify({ ok: false, sent: 0, failed: events.length, error: errMsg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const errMsg = (e as Error).message;
    await supabase.rpc("mark_meta_capi_failed", {
      _event_ids: eventIds,
      _error: errMsg,
      _max_attempts: MAX_ATTEMPTS,
    });
    return new Response(
      JSON.stringify({ ok: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
