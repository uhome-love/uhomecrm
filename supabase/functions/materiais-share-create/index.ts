import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface AssetItem {
  kind: 'foto' | 'video' | 'planta' | 'pdf' | 'link';
  id?: string;
  titulo: string;
  url: string;
  thumb?: string | null;
  descricao?: string | null;
}

interface CreatePayload {
  empreendimento_slug: string;
  empreendimento_nome?: string;
  titulo?: string;
  mensagem?: string;
  assets: AssetItem[];
  expires_at?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = claimsData.claims.sub;

  let body: CreatePayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body?.empreendimento_slug || typeof body.empreendimento_slug !== 'string') {
    return new Response(JSON.stringify({ error: 'empreendimento_slug obrigatório' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!Array.isArray(body.assets) || body.assets.length === 0) {
    return new Response(JSON.stringify({ error: 'assets vazio' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (body.assets.length > 100) {
    return new Response(JSON.stringify({ error: 'máximo 100 assets por share' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sanitizedAssets = body.assets
    .filter((a) => a && typeof a.url === 'string' && typeof a.titulo === 'string')
    .map((a) => ({
      kind: ['foto', 'video', 'planta', 'pdf', 'link'].includes(a.kind) ? a.kind : 'link',
      id: a.id ?? null,
      titulo: String(a.titulo).slice(0, 300),
      url: String(a.url).slice(0, 2000),
      thumb: a.thumb ? String(a.thumb).slice(0, 2000) : null,
      descricao: a.descricao ? String(a.descricao).slice(0, 1000) : null,
    }));

  const { data, error } = await supabase
    .from('materiais_shares')
    .insert({
      corretor_id: userId,
      empreendimento_slug: body.empreendimento_slug.slice(0, 200),
      empreendimento_nome: body.empreendimento_nome?.slice(0, 300) ?? null,
      titulo: body.titulo?.slice(0, 300) ?? null,
      mensagem: body.mensagem?.slice(0, 2000) ?? null,
      assets: sanitizedAssets,
      expires_at: body.expires_at ?? null,
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('[materiais-share-create] insert error', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      id: data.id,
      created_at: data.created_at,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
