// Tests the CRM ↔ Site bridge without ever exposing the SYNC_SECRET.
// Returns only metadata: presence of secrets, masked fingerprint, ping result.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// SHA-256 fingerprint, first 8 hex chars. Safe to display.
async function fingerprint(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ---- AuthN: require an authenticated CRM user ----
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'missing_authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'invalid_token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---- Inspect bridge configuration (no secret leaks) ----
    const SITE_URL = Deno.env.get('UHOMESITE_URL') || ''
    const SECRET = Deno.env.get('SYNC_SECRET') || ''

    const config = {
      site_url_configured: SITE_URL.length > 0,
      site_url_host: SITE_URL ? new URL(SITE_URL).host : null,
      sync_secret_configured: SECRET.length > 0,
      sync_secret_length: SECRET.length,
      sync_secret_fingerprint: SECRET ? await fingerprint(SECRET) : null,
    }

    if (!config.site_url_configured || !config.sync_secret_configured) {
      return new Response(
        JSON.stringify({
          ok: false,
          stage: 'config',
          message: 'UHOMESITE_URL ou SYNC_SECRET não configurados',
          config,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ---- Ping the site bridge ----
    // Uses a dry-run payload: invalid lead id, but valid auth — site should reject
    // with 401 if secret is wrong, 4xx (not 401) if secret is right but payload is invalid.
    const pingUrl = `${SITE_URL.replace(/\/$/, '')}/functions/v1/receive-status-update`
    const started = Date.now()
    let pingStatus: number | null = null
    let pingBodySnippet: string | null = null
    let pingError: string | null = null

    try {
      const res = await fetch(pingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SECRET}`,
          'X-Bridge-Test': '1',
        },
        body: JSON.stringify({
          __ping: true,
          lead_id_site: '00000000-0000-0000-0000-000000000000',
          status_novo: '__ping__',
        }),
      })
      pingStatus = res.status
      const text = await res.text()
      pingBodySnippet = text.slice(0, 200)
    } catch (e) {
      pingError = (e as Error).message
    }

    const latencyMs = Date.now() - started
    // 401/403 from site = secret mismatch. Anything else (200/400/404/422)
    // means the site accepted our credentials.
    const authOk = pingStatus !== null && pingStatus !== 401 && pingStatus !== 403
    const reachable = pingStatus !== null

    return new Response(
      JSON.stringify({
        ok: reachable && authOk,
        stage: !reachable ? 'network' : authOk ? 'success' : 'auth',
        message: !reachable
          ? `Site inacessível: ${pingError ?? 'sem resposta'}`
          : authOk
            ? 'Bridge respondeu — token aceito pelo site'
            : 'Site rejeitou o token (401/403). SYNC_SECRET não bate com o do site.',
        config,
        ping: {
          url_host: new URL(pingUrl).host,
          status: pingStatus,
          latency_ms: latencyMs,
          body_snippet: pingBodySnippet,
          error: pingError,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[test-bridge-connection] Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
