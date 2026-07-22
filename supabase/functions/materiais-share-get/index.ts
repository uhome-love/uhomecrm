import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Endpoint PÚBLICO consumido pela landing no site uhomesales.com
// GET  /materiais-share-get?id=<uuid>   -> retorna dados do share + info do corretor
// POST /materiais-share-get             { id, event: 'view' | 'clique' } -> incrementa contadores

const service = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) {
        return json({ error: 'id obrigatório' }, 400);
      }

      const { data: share, error } = await service
        .from('materiais_shares')
        .select(
          'id, corretor_id, empreendimento_slug, empreendimento_nome, titulo, mensagem, assets, views, cliques, expires_at, created_at',
        )
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[materiais-share-get] select error', error);
        return json({ error: 'internal' }, 500);
      }
      if (!share) return json({ error: 'not_found' }, 404);

      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return json({ error: 'expired' }, 410);
      }

      // Resolve storage_path -> signed URL (10min) para assets de upload
      const assets = Array.isArray(share.assets) ? share.assets : [];
      const BUCKET = 'materiais-uhome';
      const EXPIRES = 600;
      for (const a of assets) {
        const sp = a?.storage_path as string | undefined;
        if (sp) {
          const { data: signed } = await service.storage
            .from(BUCKET)
            .createSignedUrl(sp, EXPIRES);
          if (signed?.signedUrl) a.url = signed.signedUrl;
        }
        // Thumbs em storage também podem precisar (mesmo bucket)
        const tp = a?.thumb_storage_path as string | undefined;
        if (tp) {
          const { data: signedThumb } = await service.storage
            .from(BUCKET)
            .createSignedUrl(tp, EXPIRES);
          if (signedThumb?.signedUrl) a.thumb = signedThumb.signedUrl;
        }
      }
      share.assets = assets;

      let corretor: {
        id: string;
        nome: string | null;
        foto_url: string | null;
        avatar_url: string | null;
        telefone: string | null;
        creci: string | null;
        slug_ref: string | null;
      } | null = null;

      if (share.corretor_id) {
        const { data: c } = await service
          .from('profiles')
          .select('id, nome, foto_url, avatar_url, telefone, creci, slug_ref')
          .eq('id', share.corretor_id)
          .maybeSingle();
        if (c) corretor = c as typeof corretor;
      }

      return json({ share, corretor });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      const id = body?.id;
      const event = body?.event;
      if (!id || !['view', 'clique'].includes(event)) {
        return json({ error: 'payload inválido' }, 400);
      }

      const column = event === 'view' ? 'views' : 'cliques';
      const { data: row } = await service
        .from('materiais_shares')
        .select(column)
        .eq('id', id)
        .maybeSingle();

      if (!row) return json({ error: 'not_found' }, 404);

      const current = (row as Record<string, number>)[column] ?? 0;
      await service
        .from('materiais_shares')
        .update({ [column]: current + 1 })
        .eq('id', id);

      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('[materiais-share-get] fatal', e);
    return json({ error: 'internal' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
