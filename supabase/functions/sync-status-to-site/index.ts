import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireCronAuth } from '../_shared/cron-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const denied = requireCronAuth(req)
  if (denied) return denied

  try {
    const { record, old_record } = await req.json()

    // Só enviar se o status realmente mudou
    if (record.status === old_record?.status) {
      return new Response(JSON.stringify({ ok: true, skip: 'status_unchanged' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Resolver site_lead_id: pipeline_leads não tem, buscar via leads
    let sitLeadId = record.site_lead_id || null
    const pipelineLeadId = record.id

    if (!sitLeadId && pipelineLeadId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      const { data: leadRow } = await supabase
        .from('leads')
        .select('site_lead_id')
        .eq('pipeline_lead_id', pipelineLeadId)
        .not('site_lead_id', 'is', null)
        .limit(1)
        .single()

      sitLeadId = leadRow?.site_lead_id || null
    }

    if (!sitLeadId) {
      return new Response(JSON.stringify({ ok: true, skip: 'no_site_lead_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const SITE_URL = Deno.env.get('UHOMESITE_URL')!
    const SECRET = Deno.env.get('SYNC_SECRET')!

    const res = await fetch(
      `${SITE_URL}/functions/v1/receive-status-update`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SECRET}`,
        },
        body: JSON.stringify({
          lead_id_site: sitLeadId,
          status_novo: record.status,
          atualizado_por: record.atribuido_para,
          pipeline_lead_id: pipelineLeadId,
        }),
      }
    )

    const resBody = await res.text()
    console.log(`[sync-status-to-site] site_lead_id=${sitLeadId} status=${record.status} response=${res.status}`)

    return new Response(JSON.stringify({ ok: res.ok, site_response: res.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[sync-status-to-site] Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
