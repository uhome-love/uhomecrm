import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { tipo, dados, identidade, pagina, timestamp, utm_source, utm_medium, utm_campaign } = body

    if (!tipo) {
      return new Response(JSON.stringify({ error: 'tipo é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const email = identidade?.email || null
    const telefone = identidade?.telefone || null
    const user_id = identidade?.user_id || null
    const session_id = identidade?.session_id || null

    // ── Resolver lead_id e pipeline_lead_id ──
    let lead_id: string | null = null
    let pipeline_lead_id: string | null = null

    if (email || telefone) {
      // Buscar na tabela leads (site)
      let query = supabase.from('leads').select('id, pipeline_lead_id')

      if (email) {
        const { data } = await supabase
          .from('leads')
          .select('id, pipeline_lead_id')
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (data) {
          lead_id = data.id
          pipeline_lead_id = data.pipeline_lead_id
        }
      }

      // Se não encontrou por email, tenta por telefone
      if (!lead_id && telefone) {
        const telNorm = telefone.replace(/\D/g, '')
        const { data } = await supabase
          .from('leads')
          .select('id, pipeline_lead_id')
          .or(`telefone.eq.${telefone},telefone.eq.${telNorm}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (data) {
          lead_id = data.id
          pipeline_lead_id = data.pipeline_lead_id
        }
      }

      // Se ainda não tem pipeline_lead_id, busca direto
      if (!pipeline_lead_id && (email || telefone)) {
        const telNorm = telefone?.replace(/\D/g, '') || ''
        const conditions: string[] = []
        if (email) conditions.push(`email.eq.${email}`)
        if (telefone) conditions.push(`telefone.eq.${telefone}`)
        if (telNorm && telNorm !== telefone) conditions.push(`telefone.eq.${telNorm}`)

        if (conditions.length > 0) {
          const { data } = await supabase
            .from('pipeline_leads')
            .select('id')
            .or(conditions.join(','))
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (data) {
            pipeline_lead_id = data.id
          }
        }
      }
    }

    // ── Inserir evento ──
    const { error: insertError } = await supabase.from('site_events').insert({
      tipo,
      dados: dados || {},
      session_id,
      email,
      telefone,
      user_id,
      pagina,
      utm_source,
      utm_medium,
      utm_campaign,
      lead_id,
      pipeline_lead_id,
      created_at: timestamp || new Date().toISOString(),
    })

    if (insertError) {
      console.error('[site-events] Insert error:', insertError)
      throw insertError
    }

    // ── Ações especiais por tipo de evento ──

    // Se visitou imóvel e tem pipeline_lead_id, registra no lead_imovel_events
    if (tipo === 'visitou_imovel' && pipeline_lead_id && dados?.imovel_codigo) {
      await supabase.from('lead_imovel_events').insert({
        lead_id: pipeline_lead_id,
        corretor_id: '00000000-0000-0000-0000-000000000000', // sistema
        event_type: 'site_view',
        imovel_codigo: dados.imovel_codigo,
        payload: {
          source: 'site_uhome',
          imovel_titulo: dados.imovel_titulo,
          imovel_bairro: dados.imovel_bairro,
          imovel_preco: dados.imovel_preco,
          pagina,
        },
      }).then(({ error }) => {
        if (error) console.warn('[site-events] lead_imovel_events insert warn:', error.message)
      })
    }

    // Se favoritou e tem pipeline_lead_id, também registra
    if (tipo === 'favoritou_imovel' && pipeline_lead_id && dados?.imovel_codigo) {
      await supabase.from('lead_imovel_events').insert({
        lead_id: pipeline_lead_id,
        corretor_id: '00000000-0000-0000-0000-000000000000',
        event_type: 'site_favorite',
        imovel_codigo: dados.imovel_codigo,
        payload: {
          source: 'site_uhome',
          imovel_titulo: dados.imovel_titulo,
          imovel_preco: dados.imovel_preco,
        },
      }).then(({ error }) => {
        if (error) console.warn('[site-events] lead_imovel_events fav warn:', error.message)
      })
    }

    // Se buscou IA e tem pipeline_lead_id, registra busca
    if (tipo === 'buscou_ia' && pipeline_lead_id) {
      await supabase.from('lead_imovel_events').insert({
        lead_id: pipeline_lead_id,
        corretor_id: '00000000-0000-0000-0000-000000000000',
        event_type: 'site_ai_search',
        search_query: dados?.query || null,
        payload: {
          source: 'site_uhome',
          filtros: dados?.filtros,
        },
      }).then(({ error }) => {
        if (error) console.warn('[site-events] lead_imovel_events search warn:', error.message)
      })
    }

    return new Response(JSON.stringify({ ok: true, lead_id, pipeline_lead_id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[site-events] Erro:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
