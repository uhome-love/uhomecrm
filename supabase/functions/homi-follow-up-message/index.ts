import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { searchMateriaisForHomi } from '../_shared/materiais-context.ts';
import { requireRealUser } from '../_shared/ai-auth.ts';

// Gera 3 variações de mensagem de follow-up personalizadas para um lead,
// usando contexto do CRM (perfil, histórico WhatsApp, motivo de descarte)
// + materiais selecionados no share.

interface Payload {
  lead_id?: string | null;
  lead_nome?: string | null;
  empreendimento_nome: string;
  materiais: Array<{ titulo: string; kind: string }>;
  /** IDs dos materiais selecionados — quando presente, a IA usa o conteúdo real (resumo_ia/tags/descrição). */
  material_ids?: string[];
  share_url?: string | null;
  tom?: 'amigavel' | 'consultivo' | 'urgencia';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const _auth = await requireRealUser(req, {});
  if (_auth.error) return _auth.error;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
  const userId = claims.claims.sub;

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY missing' }, 500);

  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  if (!body?.empreendimento_nome || !Array.isArray(body.materiais) || body.materiais.length === 0) {
    return json({ error: 'empreendimento_nome e materiais são obrigatórios' }, 400);
  }

  const tom = body.tom ?? 'amigavel';

  // Buscar contexto do lead se lead_id foi informado
  let leadContext = '';
  let leadNome = body.lead_nome || 'cliente';

  if (body.lead_id) {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: lead } = await admin
      .from('pipeline_leads')
      .select('nome, segmento_id, faixa_valor, prazo_decisao, observacoes, motivo_descarte, updated_at')
      .eq('id', body.lead_id)
      .maybeSingle();

    if (lead) {
      leadNome = (lead as any).nome || leadNome;
      const partes: string[] = [];
      const l = lead as any;
      if (l.faixa_valor) partes.push(`Faixa de valor: ${l.faixa_valor}`);
      if (l.prazo_decisao) partes.push(`Prazo de decisão: ${l.prazo_decisao}`);
      if (l.motivo_descarte) partes.push(`Motivo do último descarte: ${l.motivo_descarte}`);
      if (l.observacoes) partes.push(`Observações: ${String(l.observacoes).slice(0, 400)}`);
      if (partes.length) leadContext += '\n\nPERFIL DO LEAD:\n' + partes.join('\n');
    }

    const { data: msgs } = await admin
      .from('whatsapp_mensagens')
      .select('direcao, texto, created_at')
      .eq('lead_id', body.lead_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (msgs && msgs.length) {
      const hist = msgs.reverse()
        .map((m: any) => `[${m.direcao === 'in' ? 'Cliente' : 'Corretor'}] ${String(m.texto || '').slice(0, 200)}`)
        .join('\n');
      leadContext += `\n\nÚLTIMAS MENSAGENS:\n${hist}`;
    }
  }

  // ── Materiais extras sugeridos por IA (semântico do empreendimento + perfil) ──
  let materiaisSugeridos: Array<{ titulo: string; empreendimento: string | null; resumo: string }> = [];
  try {
    const searchQuery = [body.empreendimento_nome, leadNome, leadContext.slice(0, 400)]
      .filter(Boolean).join(" | ");
    const enc = await searchMateriaisForHomi(searchQuery, {
      limit: 3,
      empreendimentoNome: body.empreendimento_nome,
    });
    materiaisSugeridos = enc.map((m) => ({
      titulo: m.titulo,
      empreendimento: m.empreendimento,
      resumo: (m.resumo_ia || m.snippet || '').slice(0, 200),
    }));
  } catch (e) {
    console.error('[homi-follow-up-message] materiais suggest skipped:', e);
  }

  // ── Conteúdo real dos materiais selecionados (resumo_ia + tags + descrição) ──
  let materiaisDetalhados: Array<{ titulo: string; kind: string; resumo: string; tags: string[] }> = [];
  if (Array.isArray(body.material_ids) && body.material_ids.length > 0) {
    try {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: mats } = await admin
        .from('materiais_links')
        .select('id, titulo, categoria, descricao, resumo_ia, tags')
        .in('id', body.material_ids);
      if (mats?.length) {
        materiaisDetalhados = mats.map((m: any) => ({
          titulo: m.titulo,
          kind: m.categoria || 'material',
          resumo: (m.resumo_ia || m.descricao || '').toString().slice(0, 500),
          tags: Array.isArray(m.tags) ? m.tags.slice(0, 6) : [],
        }));
      }
    } catch (e) {
      console.error('[homi-follow-up-message] material_ids fetch skipped:', e);
    }
  }

  const materiaisTxt = (materiaisDetalhados.length > 0 ? materiaisDetalhados : body.materiais.map((m) => ({ titulo: m.titulo, kind: m.kind, resumo: '', tags: [] as string[] })))
    .map((m, i) => {
      const extras: string[] = [];
      if (m.tags?.length) extras.push(`   Tags: ${m.tags.join(', ')}`);
      if (m.resumo) extras.push(`   Resumo: ${m.resumo}`);
      return `${i + 1}. [${m.kind}] ${m.titulo}${extras.length ? '\n' + extras.join('\n') : ''}`;
    })
    .join('\n');

  const materiaisSugeridosTxt = materiaisSugeridos.length
    ? `\n\nMATERIAIS ADICIONAIS DA BASE (pode mencionar naturalmente se fizerem sentido):\n${materiaisSugeridos.map((m, i) => `${i + 1}. "${m.titulo}"${m.empreendimento ? ` — ${m.empreendimento}` : ''}${m.resumo ? `\n   ${m.resumo}` : ''}`).join('\n')}`
    : '';

  const tomInstrucao = {
    amigavel: 'tom amigável, próximo, sem pressão',
    consultivo: 'tom consultivo e informativo, como especialista',
    urgencia: 'tom de oportunidade com senso de urgência sutil, sem ser agressivo',
  }[tom];

  const systemPrompt = `Você é um corretor da U.Home, imobiliária premium de Porto Alegre. Escreva mensagens de WhatsApp curtas (máximo 3 parágrafos, 4-6 linhas total), em português brasileiro, primeira pessoa. NUNCA use emojis excessivos (máx 1). NUNCA prometa preços/prazos. NUNCA use "prezado", "cordialmente". Estilo direto, humano, gancho concreto.`;

  const userPrompt = `Gere 3 variações de mensagem de follow-up para retomar contato com ${leadNome} sobre o empreendimento "${body.empreendimento_nome}".

CONTEXTO:
- ${tomInstrucao}
- Materiais que serão compartilhados:
${materiaisTxt}
${body.share_url ? `- Link da landing: ${body.share_url}` : ''}${leadContext}${materiaisSugeridosTxt}

REGRAS:
- Cada mensagem: 3 parágrafos no máximo, sob 500 caracteres.
- Referenciar 1 dor/interesse do histórico (se houver) + 1 gancho concreto dos materiais + CTA para abrir o link.
- Variação 1: mais curta e direta. Variação 2: mais consultiva. Variação 3: com pergunta aberta no final.
- Não invente dados. Se não souber, use "separei um material que faz sentido pro seu perfil".

Responda EXATAMENTE neste JSON (sem markdown, sem texto extra):
{"mensagens":[{"titulo":"Curta e direta","texto":"..."},{"titulo":"Consultiva","texto":"..."},{"titulo":"Com pergunta","texto":"..."}]}`;

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Lovable-API-Key': LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: 'google/gemini-3.6-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (resp.status === 402) return json({ error: 'Créditos IA esgotados' }, 402);
  if (resp.status === 429) return json({ error: 'Muitas requisições, aguarde' }, 429);
  if (!resp.ok) {
    const t = await resp.text();
    console.error('[homi-follow-up-message] AI error', resp.status, t);
    return json({ error: 'Falha na IA' }, 500);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return json({ error: 'IA retornou vazio' }, 500);

  let parsed: any;
  try { parsed = JSON.parse(content); } catch {
    console.error('[homi-follow-up-message] JSON parse fail', content);
    return json({ error: 'Formato inválido da IA' }, 500);
  }

  const mensagens = Array.isArray(parsed?.mensagens) ? parsed.mensagens.slice(0, 3) : [];
  if (mensagens.length === 0) return json({ error: 'IA não gerou mensagens' }, 500);

  // Log leve para observabilidade
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    await admin.from('ops_events').insert({
      tipo: 'homi_follow_up_gerado',
      severidade: 'info',
      usuario_id: userId,
      payload: {
        empreendimento: body.empreendimento_nome,
        materiais_count: body.materiais.length,
        tom,
        lead_id: body.lead_id,
      },
    });
  } catch (_) { /* best effort */ }

  return json({ mensagens });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
