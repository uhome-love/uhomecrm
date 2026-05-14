// Auth telemetry sink — Phase 2 of auth instability investigation
// Fire-and-forget endpoint. Always returns 204 to avoid impacting client.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_EVENTS = new Set([
  'purge_removed',
  'purge_kept',
  'refresh_start',
  'refresh_success',
  'refresh_failed',
  'transition',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  if (req.method !== 'POST') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return new Response(null, { headers: corsHeaders, status: 204 })
    }

    const event_type = String(body.event_type ?? '')
    if (!ALLOWED_EVENTS.has(event_type)) {
      return new Response(null, { headers: corsHeaders, status: 204 })
    }

    // Extract client IP (Lovable/Supabase pass via x-forwarded-for)
    const xff = req.headers.get('x-forwarded-for') ?? ''
    const ip = xff.split(',')[0]?.trim() || null
    const ua = req.headers.get('user-agent')?.slice(0, 500) ?? null

    // Truncate strings defensively
    const trunc = (v: unknown, n = 200) =>
      typeof v === 'string' ? v.slice(0, n) : null

    const row = {
      user_id: typeof body.user_id === 'string' && body.user_id.length === 36 ? body.user_id : null,
      session_id: trunc(body.session_id, 64),
      event_type,
      origin: trunc(body.origin, 50),
      reason: trunc(body.reason, 100),
      raw_len: typeof body.raw_len === 'number' ? body.raw_len : null,
      storage_key: trunc(body.storage_key, 100),
      build_hash: trunc(body.build_hash, 40),
      user_agent: ua,
      ip,
      extra: body.extra ?? null,
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fire-and-forget — don't await failures
    supabase.from('auth_telemetry').insert(row).then(({ error }) => {
      if (error) console.error('[log-auth-event] insert failed:', error.message)
    })

    return new Response(null, { headers: corsHeaders, status: 204 })
  } catch (e) {
    console.error('[log-auth-event] handler error:', (e as Error).message)
    return new Response(null, { headers: corsHeaders, status: 204 })
  }
})
