// =============================================================================
// Edge Function: site-events (v2 — com Radar de Intenção)
// Mantém 100% do comportamento original e adiciona:
//   - Análise de padrão de comportamento do lead nas últimas 24h
//   - Alerta urgente para o corretor quando lead está "quente"
//   - Reativação automática de leads descartados que voltam ao site
//   - Atualização do lead_score em pipeline_leads
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Limiar de eventos para considerar "lead quente"
const LIMIAR_VIEWS_QUENTE = 3        // 3+ visualizações em 24h
const LIMIAR_MESMO_IMOVEL = 2        // 2+ views no mesmo imóvel
const JANELA_HORAS_ANALISE = 24      // Janela de análise em horas

// ---------------------------------------------------------------------------
// Análise de intenção: calcula score e nível com base nos eventos recentes
// ---------------------------------------------------------------------------
async function analisarIntencao(
  supabase: ReturnType<typeof createClient>,
  pipelineLeadId: string
): Promise<{ nivel: string; motivo: string; score: number }> {
  const janelaInicio = new Date(
    Date.now() - JANELA_HORAS_ANALISE * 60 * 60 * 1000
  ).toISOString()

  const { data: eventos } = await supabase
    .from('lead_imovel_events')
    .select('event_type, imovel_codigo, created_at')
    .eq('lead_id', pipelineLeadId)
    .gte('created_at', janelaInicio)
    .order('created_at', { ascending: false })

  if (!eventos || eventos.length === 0) {
    return { nivel: 'frio', motivo: 'Sem eventos recentes', score: 0 }
  }

  let score = 0
  const imoveisVistos = new Map<string, number>()

  for (const evento of eventos) {
    switch (evento.event_type) {
      case 'site_view':
        score += 1
        if (evento.imovel_codigo) {
          imoveisVistos.set(
            evento.imovel_codigo,
            (imoveisVistos.get(evento.imovel_codigo) || 0) + 1
          )
        }
        break
      case 'site_favorite':
        score += 3
        break
      case 'site_ai_search':
        score += 2
        break
      case 'simulador':
        score += 4
        break
      case 'contato':
        score += 5
        break
    }
  }

  const maxViewsMesmoImovel = imoveisVistos.size > 0
    ? Math.max(...imoveisVistos.values())
    : 0
  const imovelFavorito = [...imoveisVistos.entries()]
    .find(([, v]) => v === maxViewsMesmoImovel)?.[0]

  if (score >= 10 || eventos.some(e => e.event_type === 'contato')) {
    return {
      nivel: 'urgente',
      motivo: `🚨 Score ${score} — altíssimo engajamento nas últimas ${JANELA_HORAS_ANALISE}h`,
      score,
    }
  }

  if (maxViewsMesmoImovel >= LIMIAR_MESMO_IMOVEL) {
    return {
      nivel: 'quente',
      motivo: `🔥 Viu o imóvel ${imovelFavorito} por ${maxViewsMesmoImovel}x nas últimas ${JANELA_HORAS_ANALISE}h`,
      score,
    }
  }

  if (eventos.length >= LIMIAR_VIEWS_QUENTE) {
    return {
      nivel: 'quente',
      motivo: `🔥 ${eventos.length} interações no site nas últimas ${JANELA_HORAS_ANALISE}h`,
      score,
    }
  }

  return { nivel: 'frio', motivo: 'Navegação casual', score }
}

// ---------------------------------------------------------------------------
// Verifica se o lead está em stage de descarte
// ---------------------------------------------------------------------------
async function verificarDescarte(
  supabase: ReturnType<typeof createClient>,
  pipelineLeadId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('pipeline_leads')
    .select('pipeline_stages!pipeline_leads_stage_id_fkey(tipo)')
    .eq('id', pipelineLeadId)
    .single()

  const tipo = (data?.pipeline_stages as any)?.tipo
  return tipo === 'descarte' || tipo === 'caiu'
}

// ---------------------------------------------------------------------------
// Reativa lead descartado movendo para stage de qualificação
// ---------------------------------------------------------------------------
async function reativarLead(
  supabase: ReturnType<typeof createClient>,
  pipelineLeadId: string
): Promise<void> {
  const { data: stageQualificacao } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('tipo', 'qualificacao')
    .limit(1)
    .single()

  if (!stageQualificacao) return

  await supabase
    .from('pipeline_leads')
    .update({
      stage_id: stageQualificacao.id,
      ultima_acao_at: new Date().toISOString(),
    })
    .eq('id', pipelineLeadId)
}

// ---------------------------------------------------------------------------
// Cria alerta urgente para o corretor (notifications + homi_alerts)
// ---------------------------------------------------------------------------
async function criarAlertaCorretor(
  supabase: ReturnType<typeof createClient>,
  corretorId: string,
  nomeLead: string,
  intencao: { nivel: string; motivo: string; score: number },
  eraDescartado: boolean
): Promise<void> {
  const prefixo = eraDescartado ? '🔄 LEAD RESSUSCITADO' : '🚨 LEAD QUENTE'
  const titulo = `${prefixo}: ${nomeLead}`
  const corpo = eraDescartado
    ? `${nomeLead} estava descartado e VOLTOU ao site agora! ${intencao.motivo}. Ligue AGORA!`
    : `${intencao.motivo}. Score: ${intencao.score}. Não deixe esfriar!`

  // Notificação padrão do CRM
  await supabase.from('notifications').insert({
    user_id: corretorId,
    titulo,
    mensagem: corpo,
    tipo: 'radar_intencao',
    categoria: 'radar',
    lida: false,
  }).then(({ error }) => {
    if (error) console.warn('[radar] notifications warn:', error.message)
  })

  // Tenta inserir em homi_alerts (se a tabela existir)
  await supabase.from('homi_alerts').insert({
    user_id: corretorId,
    tipo: 'radar_intencao',
    titulo,
    descricao: corpo,
    nivel: intencao.nivel === 'urgente' ? 'critico' : 'aviso',
    ativo: true,
    metadata: { score: intencao.score, era_descartado: eraDescartado },
  }).then(({ error }) => {
    if (error) console.warn('[radar] homi_alerts warn (pode não existir):', error.message)
  })
}

// ---------------------------------------------------------------------------
// HANDLER PRINCIPAL
// ---------------------------------------------------------------------------
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

    // ── Resolver lead_id e pipeline_lead_id (lógica original mantida) ──
    let lead_id: string | null = null
    let pipeline_lead_id: string | null = null

    if (email || telefone) {
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

      if (!lead_id && telefone) {
        const telNorm = telefone.replace(/\D/g, '')
        // Gerar variantes com/sem DDI (+55) para cobrir formatos diferentes
        const variants = new Set<string>([telefone, telNorm])
        if (telNorm.startsWith('55') && telNorm.length >= 12) {
          variants.add(telNorm.slice(2))           // remove DDI: 5551999... → 51999...
          variants.add(`+${telNorm}`)               // adiciona +: +5551999...
        } else if (telNorm.length >= 10 && telNorm.length <= 11) {
          variants.add(`55${telNorm}`)              // adiciona DDI: 51999... → 5551999...
          variants.add(`+55${telNorm}`)             // adiciona +DDI: +5551999...
        }
        const orConditions = [...variants].map(v => `telefone.eq.${v}`).join(',')
        const { data } = await supabase
          .from('leads')
          .select('id, pipeline_lead_id')
          .or(orConditions)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (data) {
          lead_id = data.id
          pipeline_lead_id = data.pipeline_lead_id
        }
      }

      if (!pipeline_lead_id && (email || telefone)) {
        const telNorm = telefone?.replace(/\D/g, '') || ''
        const conditions: string[] = []
        if (email) conditions.push(`email.eq.${email}`)
        if (telefone) {
          // Mesma lógica de variantes com/sem DDI
          const telVariants = new Set<string>([telefone])
          if (telNorm) {
            telVariants.add(telNorm)
            if (telNorm.startsWith('55') && telNorm.length >= 12) {
              telVariants.add(telNorm.slice(2))
              telVariants.add(`+${telNorm}`)
            } else if (telNorm.length >= 10 && telNorm.length <= 11) {
              telVariants.add(`55${telNorm}`)
              telVariants.add(`+55${telNorm}`)
            }
          }
          for (const v of telVariants) {
            conditions.push(`telefone.eq.${v}`)
          }
        }

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

    // ── Inserir evento em site_events (lógica original mantida) ──
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

    // ── Ações especiais por tipo de evento (lógica original mantida) ──

    if (tipo === 'visitou_imovel' && pipeline_lead_id && dados?.imovel_codigo) {
      await supabase.from('lead_imovel_events').insert({
        lead_id: pipeline_lead_id,
        corretor_id: '00000000-0000-0000-0000-000000000000',
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

    // ── NOVO: Radar de Intenção ──
    // Só analisa se o evento é de navegação relevante e temos o pipeline_lead_id
    const eventosQueAcionamRadar = [
      'visitou_imovel',
      'favoritou_imovel',
      'buscou_ia',
      'abriu_simulador',
      'clicou_contato',
    ]

    if (pipeline_lead_id && eventosQueAcionamRadar.includes(tipo)) {
      // Executa análise de intenção de forma assíncrona (não bloqueia a resposta)
      Promise.resolve().then(async () => {
        try {
          const intencao = await analisarIntencao(supabase, pipeline_lead_id!)

          // Atualiza score no pipeline_leads
          if (intencao.score > 0) {
            await supabase
              .from('pipeline_leads')
              .update({
                lead_score: intencao.score,
                lead_score_at: new Date().toISOString(),
              })
              .eq('id', pipeline_lead_id!)
              .then(({ error }) => {
                if (error) console.warn('[radar] update score warn:', error.message)
              })
          }

          // Se intenção é quente ou urgente, age imediatamente
          if (intencao.nivel === 'quente' || intencao.nivel === 'urgente') {
            // Busca dados do lead para notificar o corretor
            const { data: leadData } = await supabase
              .from('pipeline_leads')
              .select('nome, corretor_id')
              .eq('id', pipeline_lead_id!)
              .single()

            if (leadData?.corretor_id) {
              const eraDescartado = await verificarDescarte(supabase, pipeline_lead_id!)

              if (eraDescartado) {
                await reativarLead(supabase, pipeline_lead_id!)
                console.log(`[radar] 🔄 Lead ${leadData.nome} reativado após retorno ao site`)
              }

              await criarAlertaCorretor(
                supabase,
                leadData.corretor_id,
                leadData.nome || 'Cliente',
                intencao,
                eraDescartado
              )

              console.log(`[radar] 🚨 Alerta criado para corretor ${leadData.corretor_id}: ${intencao.motivo}`)
            }
          }
        } catch (radarErr) {
          // Radar nunca deve quebrar o fluxo principal
          console.error('[radar] Erro no Radar de Intenção:', radarErr)
        }
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
