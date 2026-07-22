import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BUCKET = 'materiais-uhome';
const EXPIRES_SECONDS = 600; // 10 min

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);

  let body: { material_id?: string; storage_path?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  let path = body.storage_path?.trim();

  if (!path && body.material_id) {
    if (!/^[0-9a-f-]{36}$/i.test(body.material_id)) {
      return json({ error: 'material_id inválido' }, 400);
    }
    // RLS: SELECT em materiais_links é liberado a autenticados
    const { data: row } = await userClient
      .from('materiais_links')
      .select('storage_path')
      .eq('id', body.material_id)
      .maybeSingle();
    if (!row?.storage_path) return json({ error: 'not_found' }, 404);
    path = row.storage_path;
  }

  if (!path) return json({ error: 'storage_path ou material_id obrigatório' }, 400);
  if (path.length > 500) return json({ error: 'path inválido' }, 400);

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: signed, error: signErr } = await service
    .storage
    .from(BUCKET)
    .createSignedUrl(path, EXPIRES_SECONDS);

  if (signErr || !signed?.signedUrl) {
    console.error('[materiais-signed-read] sign error', signErr, 'path=', path);
    return json({ error: 'sign_failed' }, 500);
  }

  return json({ url: signed.signedUrl, expires_in: EXPIRES_SECONDS });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
