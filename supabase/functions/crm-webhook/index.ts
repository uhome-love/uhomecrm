import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

const VALID_TIPOS = ['lead', 'agendamento', 'captacao', 'whatsapp_click'] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    // Validate secret
    const secret = req.headers.get('x-sync-secret')
    const expected = Deno.env.get('SYNC_SECRET')
    if (!secret || secret !== expected) {
      console.error('[crm-webhook] Invalid or missing x-sync-secret')
      return errorResponse('Unauthorized', 401)
    }

    const body = await req.json()
    const { tipo, record } = body

    if (!tipo || !record) {
      return errorResponse('Missing tipo or record', 400)
    }

    if (!VALID_TIPOS.includes(tipo)) {
      return errorResponse(`Invalid tipo: ${tipo}. Expected: ${VALID_TIPOS.join(', ')}`, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Resolve corretor ──
    let corretorId: string | null = null
    let corretorNome: string | null = null
    let corretorEmail: string | null = null

    if (record.corretor_ref_id) {
      // corretor_ref_id is the CRM profile id directly
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('id', record.corretor_ref_id)
        .single()

      if (profile) {
        corretorId = profile.id
        corretorNome = profile.nome
        corretorEmail = profile.email
      }
    }

    // Fallback: try slug_ref
    if (!corretorId && record.corretor_slug) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('slug_ref', record.corretor_slug)
        .single()

      if (profile) {
        corretorId = profile.id
        corretorNome = profile.nome
        corretorEmail = profile.email
      }
    }

    // Fallback: corretor de plantão
    if (!corretorId) {
      const { data: plantao } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('de_plantao', true)
        .eq('ativo', true)
        .limit(1)
        .single()

      if (plantao) {
        corretorId = plantao.id
        corretorNome = plantao.nome
        corretorEmail = plantao.email
      }
    }

    // ── Get first stage (Novo Lead) ──
    const { data: firstStage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .order('ordem', { ascending: true })
      .limit(1)
      .single()

    const stageId = firstStage?.id || null

    // ── Build result based on tipo ──
    let pipelineLeadId: string | null = null
    let notifTitulo = ''
    let notifMensagem = ''
    let notifTipo = ''

    const origemRef = record.origem_ref || (record.corretor_ref_id ? 'link_corretor' : 'organico')
    const leadNome = record.nome || 'Lead do site'
    const leadTelefone = record.telefone || ''
    const leadEmail = record.email || null
    const origemComponente = record.origem_componente || null
    const imovelCodigo = record.imovel_codigo || null

    // ── Resolve real property data from DB if code exists ──
    let imovelTitulo = record.imovel_titulo || record.imovel_interesse || null
    let imovelUrl: string | null = record.imovel_url || null

    if (imovelCodigo && !imovelUrl) {
      const { data: imovelData } = await supabase
        .from('properties')
        .select('codigo, titulo, tipo, dormitorios, bairro')
        .eq('codigo', imovelCodigo)
        .limit(1)
        .maybeSingle()

      if (imovelData) {
        // Build slug: {tipo}-{n}-quartos-{bairro}-{codigo}
        const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const tipoSlug = slugify(imovelData.tipo || 'imovel')
        const quartos = imovelData.dormitorios ?? 0
        const bairroSlug = slugify(imovelData.bairro || 'porto-alegre')
        const codigoSlug = slugify(imovelData.codigo)
        const slug = quartos > 0
          ? `${tipoSlug}-${quartos}-quartos-${bairroSlug}-${codigoSlug}`
          : `${tipoSlug}-para-venda-${bairroSlug}-${codigoSlug}`
        imovelUrl = `https://uhome.com.br/imovel/${slug}`
        if (!imovelTitulo && imovelData.titulo) {
          imovelTitulo = imovelData.titulo
        }
        console.log(`[crm-webhook] Resolved imovel: ${imovelCodigo} → ${imovelUrl}`)
      } else {
        console.warn(`[crm-webhook] Imóvel código ${imovelCodigo} not found in DB, no URL generated`)
      }
    }

    // If no property info at all, mark as general lead
    if (!imovelTitulo && !imovelCodigo) {
      imovelTitulo = 'Lead Geral (sem imóvel específico)'
    }

    if (tipo === 'lead' || tipo === 'agendamento' || tipo === 'captacao') {
      // ── Dedup by phone ──
      let existingLead = null
      if (leadTelefone) {
        const normalizado = leadTelefone.replace(/\D/g, '').slice(-11)
        const { data } = await supabase
          .from('pipeline_leads')
          .select('id')
          .eq('telefone_normalizado', normalizado)
          .limit(1)
          .maybeSingle()
        existingLead = data
      }

      if (existingLead) {
        pipelineLeadId = existingLead.id
        // Update with new site data
        const updateObsParts = [`[Site uhome.com.br] ${tipo} - ${imovelTitulo || 'sem imóvel'} (${new Date().toLocaleDateString('pt-BR')})`]
        if (imovelCodigo) updateObsParts.push(`Cód. Imóvel: ${imovelCodigo}`)
        if (imovelUrl) updateObsParts.push(`Link: ${imovelUrl}`)

        await supabase
          .from('pipeline_leads')
          .update({
            dados_site: record,
            tipo_acao: tipo,
            origem_ref: origemRef,
            imovel_codigo: imovelCodigo || undefined,
            imovel_url: imovelUrl || undefined,
            observacoes: updateObsParts.join(' | '),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingLead.id)
      } else {
        // Create new pipeline lead
        const telefoneNorm = leadTelefone.replace(/\D/g, '').slice(-11)
        const obsParts = [`[Site uhome.com.br] ${tipo}${imovelTitulo ? ` - ${imovelTitulo}` : ''}`]
        if (imovelCodigo) obsParts.push(`Cód. Imóvel: ${imovelCodigo}`)
        if (imovelUrl) obsParts.push(`Link: ${imovelUrl}`)

        const insertData: Record<string, unknown> = {
          nome: leadNome,
          telefone: leadTelefone,
          telefone_normalizado: telefoneNorm,
          email: leadEmail,
          origem: 'site_uhome',
          origem_detalhe: origemComponente || `site_${tipo}`,
          origem_ref: origemRef,
          tipo_acao: tipo,
          dados_site: record,
          stage_id: stageId,
          stage_changed_at: new Date().toISOString(),
          empreendimento: imovelTitulo,
          imovel_codigo: imovelCodigo,
          imovel_url: imovelUrl,
          observacoes: obsParts.join(' | '),
        }

        if (corretorId) {
          insertData.corretor_id = corretorId
          insertData.distribuido_em = new Date().toISOString()
          insertData.aceite_status = 'aceito'
          insertData.aceito_em = new Date().toISOString()
        }

        const { data: newLead, error: insertErr } = await supabase
          .from('pipeline_leads')
          .insert(insertData)
          .select('id')
          .single()

        if (insertErr) {
          console.error('[crm-webhook] Insert error:', insertErr)
          return errorResponse(`Insert failed: ${insertErr.message}`, 500)
        }

        pipelineLeadId = newLead.id
      }

      // Also insert into leads table with site_lead_id for sync back
      if (record.site_lead_id && pipelineLeadId) {
        await supabase
          .from('leads')
          .upsert({
            site_lead_id: record.site_lead_id,
            pipeline_lead_id: pipelineLeadId,
            nome: leadNome,
            telefone: leadTelefone,
            email: leadEmail,
            origem: 'site_uhome',
            status: 'novo',
          }, { onConflict: 'site_lead_id' })
          .select()
      }
    }

    // ── Notification config by tipo ──
    switch (tipo) {
      case 'lead':
        notifTipo = 'novo_lead'
        notifTitulo = `⚡ Novo lead via ${origemRef === 'link_corretor' ? 'seu link' : 'site'}`
        notifMensagem = `${leadNome}${imovelTitulo ? ` - ${imovelTitulo}` : ''} entrou pelo site uhome.com.br`
        break
      case 'agendamento':
        notifTipo = 'agendamento'
        notifTitulo = `📅 Visita agendada via ${origemRef === 'link_corretor' ? 'seu link' : 'site'}`
        notifMensagem = `${leadNome} agendou visita${imovelTitulo ? ` para ${imovelTitulo}` : ''}`
        break
      case 'captacao':
        notifTipo = 'captacao'
        notifTitulo = `🏠 Nova captação via ${origemRef === 'link_corretor' ? 'seu link' : 'site'}`
        notifMensagem = `${leadNome} quer anunciar um imóvel pelo site`
        break
      case 'whatsapp_click':
        notifTipo = 'whatsapp_click'
        notifTitulo = `📱 Clique no WhatsApp via ${origemRef === 'link_corretor' ? 'seu link' : 'site'}`
        notifMensagem = `${leadNome} clicou no WhatsApp${imovelTitulo ? ` - ${imovelTitulo}` : ''}`
        break
    }

    // ── Create notification ──
    if (corretorId) {
      await supabase.from('notifications').insert({
        user_id: corretorId,
        tipo: notifTipo,
        categoria: 'leads',
        titulo: notifTitulo,
        mensagem: notifMensagem,
        dados: {
          pipeline_lead_id: pipelineLeadId,
          lead_nome: leadNome,
          lead_telefone: leadTelefone,
          imovel_titulo: imovelTitulo,
          tipo_acao: tipo,
          origem_ref: origemRef,
          origem_componente: origemComponente,
        },
        lida: false,
      })
    }

    console.log(`[crm-webhook] tipo=${tipo} corretor=${corretorNome || 'nenhum'} lead=${pipelineLeadId}`)

    return jsonResponse({
      ok: true,
      tipo,
      pipeline_lead_id: pipelineLeadId,
      corretor_id: corretorId,
      corretor_nome: corretorNome,
    })
  } catch (err) {
    console.error('[crm-webhook] Error:', err)
    return errorResponse((err as Error).message, 500)
  }
})
