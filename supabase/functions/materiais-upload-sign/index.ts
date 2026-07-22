import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BUCKET = 'materiais-uhome';
const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_PREFIXES = ['image/', 'video/'];
const ALLOWED_EXACT = ['application/pdf'];

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
  const userId = claimsData.claims.sub as string;

  // Confere role (gestor/admin) via user_roles
  const { data: roles } = await userClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  const allowed = (roles ?? []).some((r: any) => r.role === 'admin' || r.role === 'gestor');
  if (!allowed) return json({ error: 'forbidden' }, 403);

  let body: {
    empreendimento_id?: string;
    filename?: string;
    mime?: string;
    size?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { empreendimento_id, filename, mime, size } = body;
  if (!empreendimento_id || !/^[0-9a-f-]{36}$/i.test(empreendimento_id)) {
    return json({ error: 'empreendimento_id inválido' }, 400);
  }
  if (!filename || typeof filename !== 'string' || filename.length > 200) {
    return json({ error: 'filename inválido' }, 400);
  }
  if (!mime || typeof mime !== 'string') return json({ error: 'mime obrigatório' }, 400);
  const mimeOk =
    ALLOWED_EXACT.includes(mime) || ALLOWED_PREFIXES.some((p) => mime.startsWith(p));
  if (!mimeOk) return json({ error: `mime não suportado: ${mime}` }, 400);
  if (typeof size !== 'number' || size <= 0 || size > MAX_BYTES) {
    return json({ error: `tamanho inválido (max ${MAX_BYTES})` }, 400);
  }

  // Confirma que o empreendimento existe
  const { data: emp } = await userClient
    .from('materiais_empreendimentos')
    .select('id')
    .eq('id', empreendimento_id)
    .maybeSingle();
  if (!emp) return json({ error: 'empreendimento não encontrado' }, 404);

  const uid = crypto.randomUUID();
  const path = `${empreendimento_id}/${uid}-${slugify(filename)}`;

  // Usa service role pra gerar signed upload URL (bypass RLS; já validamos role acima)
  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: signed, error: signErr } = await service
    .storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (signErr || !signed) {
    console.error('[materiais-upload-sign] sign error', signErr);
    return json({ error: 'sign_failed' }, 500);
  }

  return json({
    path,
    token: signed.token,
    signed_url: signed.signedUrl,
    bucket: BUCKET,
    max_bytes: MAX_BYTES,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
