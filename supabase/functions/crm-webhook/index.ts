import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

const VALID_TIPOS = ['lead', 'agendamento', 'captacao', 'whatsapp_click'] as const
const NOVO_LEAD_STAGE_ID = 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019'

/**
 * Extract property codigo from a slug like "apartamento-3-quartos-rio-branco-340340-UP"
 * Supports pure numeric (340340) and alphanumeric suffixed codes (340340-UP, 67274-TR)
 */
function extractCodigoFromSlug(slug: string): string | null {
  // Try pattern: digits-LETTERS at the end (e.g. "340340-UP")
  const suffixMatch = slug.match(/(\d+)-([A-Za-z]{1,4})$/)
  if (suffixMatch) return `${suffixMatch[1]}-${suffixMatch[2].toUpperCase()}`
  // Try pure numeric at the end (e.g. "340340")
  const numericMatch = slug.match(/(\d{4,})$/)
  if (numericMatch) return numericMatch[1]
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const secret = req.headers.get('x-sync-secret')
    const expected = Deno.env.get('SYNC_SECRET')
    if (!secret || secret !== expected) {
      console.error('[crm-webhook] Invalid or missing x-sync-secret')
      return errorResponse('Unauthorized', 401)
    }

    const body = await req.json()
    const { tipo, record } = body

    if (!tipo || !record) return errorResponse('Missing tipo or record', 400)
    if (!VALID_TIPOS.includes(tipo)) return errorResponse(`Invalid tipo: ${tipo}`, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Extract lead data ──
    const origemRef = record.origem_ref || 'organico'
    const leadNome = record.nome || 'Lead do site'
    const leadTelefone = record.telefone || ''
    const leadEmail = record.email || null
    const origemComponenteRaw = record.origem_componente || null
    const ORIGEM_LABELS: Record<string, string> = {
      floating_whatsapp: 'WhatsApp Site',
      retargeting_popup: 'Retargeting Site',
      header_cta: 'CTA Site',
      footer_cta: 'CTA Rodapé',
      imovel_cta: 'Página do Imóvel',
    }
    const origemComponente = origemComponenteRaw ? (ORIGEM_LABELS[origemComponenteRaw] || origemComponenteRaw) : null

    const DETALHE_LABELS: Record<string, string> = {
      exit_intent: 'Formulário Saída',
      detalhe_sidebar: 'Página do Imóvel',
      floating_whatsapp: 'WhatsApp Site',
      retargeting_popup: 'Retargeting Site',
      header_cta: 'CTA Site',
      footer_cta: 'CTA Rodapé',
      imovel_cta: 'Página do Imóvel',
      hero_form: 'Formulário Home',
      contact_form: 'Formulário Contato',
    }
    const origemDetalheRaw = record.origem_detalhe || null
    const origemDetalheLabel = origemDetalheRaw ? (DETALHE_LABELS[origemDetalheRaw] || origemDetalheRaw) : null
    const imovelCodigo = record.imovel_codigo || null
    const imovelSlug = record.imovel_slug || null
    const paginaUrl = record.pagina_url || record.origem_pagina || null

    // ── Resolve property data ──
    let imovelTitulo = record.imovel_titulo || record.imovel_interesse || null
    let imovelUrl: string | null = record.imovel_url || null

    // Try to resolve from slug (new site payload)
    if (imovelSlug && !imovelCodigo && !imovelUrl) {
      // Extract codigo from slug — supports "340340" or "340340-UP" patterns
      const codigoFromSlug = extractCodigoFromSlug(imovelSlug)
      if (codigoFromSlug) {
        const { data: imovelData } = await supabase
          .from('properties')
          .select('codigo, titulo, tipo, dormitorios, bairro')
          .eq('codigo', codigoFromSlug)
          .limit(1)
          .maybeSingle()

        if (imovelData) {
          imovelUrl = `https://uhome.com.br/imovel/${imovelSlug}`
          if (!imovelTitulo && imovelData.titulo) imovelTitulo = imovelData.titulo
          console.log(`[crm-webhook] Resolved from slug: ${imovelSlug} → ${imovelData.titulo}`)
        }
      }
      // If no codigo extracted, just use slug as URL
      if (!imovelUrl && imovelSlug) {
        imovelUrl = `https://uhome.com.br/imovel/${imovelSlug}`
      }
    }

    if (imovelCodigo && !imovelUrl) {
      const { data: imovelData } = await supabase
        .from('properties')
        .select('codigo, titulo, tipo, dormitorios, bairro')
        .eq('codigo', imovelCodigo)
        .limit(1)
        .maybeSingle()

      if (imovelData) {
        const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const tipoSlug = slugify(imovelData.tipo || 'imovel')
        const quartos = imovelData.dormitorios ?? 0
        const bairroSlug = slugify(imovelData.bairro || 'porto-alegre')
        const codigoSlug = slugify(imovelData.codigo)
        const slug = quartos > 0
          ? `${tipoSlug}-${quartos}-quartos-${bairroSlug}-${codigoSlug}`
          : `${tipoSlug}-para-venda-${bairroSlug}-${codigoSlug}`
        imovelUrl = `https://uhome.com.br/imovel/${slug}`
        if (!imovelTitulo && imovelData.titulo) imovelTitulo = imovelData.titulo
        console.log(`[crm-webhook] Resolved imovel: ${imovelCodigo} → ${imovelUrl}`)
      }
    }

    // ── Fallback: resolve from imovel_interesse text (e.g. "Apartamento 3 quartos — Rio Branco") ──
    const bairroInteresse = record.bairro_interesse || null
    if (!imovelUrl && !imovelCodigo && !imovelSlug && imovelTitulo && bairroInteresse) {
      // Extract tipo and quartos from interest text
      const interestText = (imovelTitulo as string).toLowerCase()
      const tipoMatch = interestText.match(/^(apartamento|casa|cobertura|studio|loft|sala|terreno|loja|sobrado)/)
      const quartosMatch = interestText.match(/(\d+)\s*quarto/)
      if (tipoMatch) {
        const queryFilters: Record<string, unknown> = {}
        const bairroNorm = (bairroInteresse as string).trim()
        
        const { data: candidates } = await supabase
          .from('properties')
          .select('codigo, titulo, tipo, dormitorios, bairro')
          .ilike('tipo', `${tipoMatch[1]}%`)
          .ilike('bairro', `%${bairroNorm}%`)
          .eq('dormitorios', quartosMatch ? parseInt(quartosMatch[1]) : 0)
          .limit(1)
          .maybeSingle()

        if (candidates) {
          const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          const tipoSlug = slugify(candidates.tipo || 'imovel')
          const quartos = candidates.dormitorios ?? 0
          const bairroSlug = slugify(candidates.bairro || 'porto-alegre')
          const codigoSlug = slugify(candidates.codigo)
          const slug = quartos > 0
            ? `${tipoSlug}-${quartos}-quartos-${bairroSlug}-${codigoSlug}`
            : `${tipoSlug}-para-venda-${bairroSlug}-${codigoSlug}`
          imovelUrl = `https://uhome.com.br/imovel/${slug}`
          if (candidates.titulo) imovelTitulo = candidates.titulo
          console.log(`[crm-webhook] Resolved from interest: ${bairroInteresse} → ${candidates.codigo} → ${imovelUrl}`)
        }
      }
    }

    // ── Fallback: resolve from pagina_url (extract slug/codigo from URL) ──
    if (!imovelUrl && !imovelCodigo && !imovelSlug && paginaUrl) {
      const imovelMatch = paginaUrl.match(/\/imovel\/([^?#]+)/)
      if (imovelMatch) {
        const urlSlug = imovelMatch[1]
        const possibleCodigo = extractCodigoFromSlug(urlSlug)
        if (possibleCodigo) {
          const { data: imovelFromUrl } = await supabase
            .from('properties')
            .select('codigo, titulo, tipo, dormitorios, bairro')
            .eq('codigo', possibleCodigo)
            .limit(1)
            .maybeSingle()

          if (imovelFromUrl) {
            const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            const tipoSlug = slugify(imovelFromUrl.tipo || 'imovel')
            const quartos = imovelFromUrl.dormitorios ?? 0
            const bairroSlug = slugify(imovelFromUrl.bairro || 'porto-alegre')
            const codigoSlug = slugify(imovelFromUrl.codigo)
            const slug = quartos > 0
              ? `${tipoSlug}-${quartos}-quartos-${bairroSlug}-${codigoSlug}`
              : `${tipoSlug}-para-venda-${bairroSlug}-${codigoSlug}`
            imovelUrl = `https://uhome.com.br/imovel/${slug}`
            if (!imovelTitulo && imovelFromUrl.titulo) imovelTitulo = imovelFromUrl.titulo
            console.log(`[crm-webhook] Resolved from pagina_url: ${possibleCodigo} → ${imovelUrl}`)
          } else {
            imovelUrl = paginaUrl
            imovelTitulo = imovelTitulo || 'Imóvel do site (ver link)'
          }
        } else {
          imovelUrl = paginaUrl
          imovelTitulo = imovelTitulo || 'Imóvel do site (ver link)'
        }
      } else if (!imovelTitulo) {
        imovelTitulo = 'Lead Geral (sem imóvel específico)'
      }
    } else if (!imovelUrl && !imovelCodigo && !imovelSlug && !paginaUrl && !imovelTitulo) {
      imovelTitulo = 'Lead Geral (sem imóvel específico)'
    }

    let pipelineLeadId: string | null = null
    let isExisting = false
    let existingCorretorId: string | null = null

    if (tipo === 'lead' || tipo === 'agendamento' || tipo === 'captacao') {
      // ── Dedup by phone ──
      let existingLead = null
      if (leadTelefone) {
        const normalizado = leadTelefone.replace(/\D/g, '').slice(-11)
        const { data } = await supabase
          .from('pipeline_leads')
          .select('id, corretor_id, nome')
          .eq('telefone_normalizado', normalizado)
          .limit(1)
          .maybeSingle()
        existingLead = data
      }

      if (existingLead) {
        // ── EXISTING LEAD: update and notify current corretor ──
        pipelineLeadId = existingLead.id
        isExisting = true
        existingCorretorId = existingLead.corretor_id

        const updateObsParts = [`[Site uhome.com.br] ${tipo} - ${imovelTitulo || 'sem imóvel'} (${new Date().toLocaleDateString('pt-BR')})`]
        if (imovelCodigo || imovelSlug) updateObsParts.push(`Cód/Slug: ${imovelCodigo || imovelSlug}`)
        if (imovelUrl) updateObsParts.push(`Link: ${imovelUrl}`)
        if (paginaUrl) updateObsParts.push(`Página: ${paginaUrl}`)

        await supabase
          .from('pipeline_leads')
          .update({
            arquivado: false,
            stage_id: NOVO_LEAD_STAGE_ID,
            stage_changed_at: new Date().toISOString(),
            dados_site: record,
            tipo_acao: tipo,
            origem_ref: origemRef,
            imovel_codigo: imovelCodigo || undefined,
            imovel_url: imovelUrl || undefined,
            observacoes: updateObsParts.join(' | '),
            updated_at: new Date().toISOString(),
            // Fix: set aceite_status based on whether lead already has a corretor
            aceite_status: existingCorretorId ? 'aceito' : 'pendente_distribuicao',
          })
          .eq('id', existingLead.id)

        console.log(`[crm-webhook] Dedup: lead ${existingLead.id} updated, corretor=${existingCorretorId}`)
      } else {
        // ── NEW LEAD: insert WITHOUT corretor, let trigger handle roleta ──
        const telefoneNorm = leadTelefone.replace(/\D/g, '').slice(-11)
        const obsParts = [`[Site uhome.com.br] ${tipo}${imovelTitulo ? ` - ${imovelTitulo}` : ''}`]
        if (imovelCodigo || imovelSlug) obsParts.push(`Cód/Slug: ${imovelCodigo || imovelSlug}`)
        if (imovelUrl) obsParts.push(`Link: ${imovelUrl}`)
        if (paginaUrl) obsParts.push(`Página: ${paginaUrl}`)

        const insertData: Record<string, unknown> = {
          nome: leadNome,
          telefone: leadTelefone,
          telefone_normalizado: telefoneNorm,
          email: leadEmail,
          origem: 'site_uhome',
          origem_detalhe: origemDetalheLabel || origemComponente || `site_${tipo}`,
          origem_ref: origemRef,
          tipo_acao: tipo,
          dados_site: record,
          stage_id: NOVO_LEAD_STAGE_ID,
          stage_changed_at: new Date().toISOString(),
          empreendimento: imovelTitulo,
          imovel_codigo: imovelCodigo,
          imovel_url: imovelUrl,
          observacoes: obsParts.join(' | '),
          // NO corretor_id — trigger trg_auto_distribute_new_lead handles roleta
          aceite_status: 'pendente_distribuicao',
        }

        const { data: newLead, error: insertErr } = await supabase
          .from('pipeline_leads')
          .insert(insertData)
          .select('id, corretor_id')
          .single()

        if (insertErr) {
          console.error('[crm-webhook] Insert error:', insertErr)
          return errorResponse(`Insert failed: ${insertErr.message}`, 500)
        }

        pipelineLeadId = newLead.id
        existingCorretorId = newLead.corretor_id // may be set by trigger
        console.log(`[crm-webhook] New lead ${newLead.id} → Novo Lead stage, corretor from trigger: ${existingCorretorId || 'fila_ceo'}`)
      }

      // Sync to leads table
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

    // ── Build notification ──
    const tipoLabel = tipo === 'lead' ? 'Novo lead' 
      : tipo === 'agendamento' ? 'Visita agendada'
      : tipo === 'captacao' ? 'Nova captação' 
      : 'Clique no WhatsApp'

    const notifTipo = tipo === 'lead' ? 'novo_lead' : tipo
    const notifTitulo = isExisting
      ? `🔄 ${tipoLabel} — ${leadNome} (atualização)`
      : `⚡ ${tipoLabel} via site`
    const notifMensagem = isExisting
      ? `${leadNome} interagiu novamente pelo site${imovelTitulo ? ` — ${imovelTitulo}` : ''}`
      : `${leadNome}${imovelTitulo ? ` — ${imovelTitulo}` : ''} entrou pelo site uhome.com.br`

    // Send notification to the corretor (existing or assigned by trigger)
    if (existingCorretorId) {
      await supabase.from('notifications').insert({
        user_id: existingCorretorId,
        tipo: notifTipo,
        categoria: 'leads',
        titulo: notifTitulo,
        mensagem: notifMensagem,
        dados: {
          pipeline_lead_id: pipelineLeadId,
          lead_nome: leadNome,
          lead_telefone: leadTelefone,
          imovel_titulo: imovelTitulo,
          imovel_url: imovelUrl,
          pagina_url: paginaUrl,
          tipo_acao: tipo,
          origem_ref: origemRef,
          origem_componente: origemComponente,
          is_update: isExisting,
        },
        lida: false,
      })
    }

    console.log(`[crm-webhook] Done: tipo=${tipo} existing=${isExisting} corretor=${existingCorretorId || 'roleta'} lead=${pipelineLeadId}`)

    return jsonResponse({
      ok: true,
      tipo,
      pipeline_lead_id: pipelineLeadId,
      corretor_id: existingCorretorId,
      is_existing: isExisting,
    })
  } catch (err) {
    console.error('[crm-webhook] Error:', err)
    return errorResponse((err as Error).message, 500)
  }
})
