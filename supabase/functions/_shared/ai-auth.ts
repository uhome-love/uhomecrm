/**
 * _shared/ai-auth.ts — Guard forte para Edge Functions de IA.
 *
 * Problema resolvido: `supabase.auth.getClaims(anonKey)` valida a assinatura da
 * chave anônima pública e devolve claims (`role: 'anon'`), então o guard antigo
 * deixava qualquer pessoa com a anon key queimar créditos de IA.
 *
 * Regras:
 *   1. service-role (Bearer service key ou header x-cron-secret) → libera,
 *      apenas se `allowServiceRole: true`.
 *   2. Token igual à SUPABASE_ANON_KEY → 401 imediato.
 *   3. Claims válidos, `sub` presente e `role === 'authenticated'` → OK.
 *   4. Se `roles` for informado, exige um dos papéis em public.user_roles.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

function deny(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface RealUserOk {
  userId: string | null;
  roles: string[];
  isServiceRole: boolean;
  error: null;
}
export interface RealUserErr {
  userId: null;
  roles: never[];
  isServiceRole: false;
  error: Response;
}

export async function requireRealUser(
  req: Request,
  opts: { allowServiceRole?: boolean; roles?: string[] } = {},
): Promise<RealUserOk | RealUserErr> {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const providedCron = req.headers.get("x-cron-secret") ?? "";

  // 1. service-role / cron
  if (opts.allowServiceRole) {
    if (serviceKey && token && token === serviceKey) {
      return { userId: null, roles: [], isServiceRole: true, error: null };
    }
    if (cronSecret && providedCron && providedCron === cronSecret) {
      return { userId: null, roles: [], isServiceRole: true, error: null };
    }
  }

  if (!token) return { userId: null, roles: [], isServiceRole: false, error: deny("Unauthorized", 401) };

  // 2. anon key nunca é usuário real
  if (anonKey && token === anonKey) {
    return { userId: null, roles: [], isServiceRole: false, error: deny("Unauthorized", 401) };
  }

  // 3. usuário real
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.auth.getClaims(token);
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (error || !claims?.sub || claims.role !== "authenticated") {
    return { userId: null, roles: [], isServiceRole: false, error: deny("Unauthorized", 401) };
  }
  const userId = claims.sub as string;

  // 4. papéis do banco
  let roles: string[] = [];
  if (opts.roles?.length || serviceKey) {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey || anonKey);
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", userId);
    roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  }

  if (opts.roles?.length && !opts.roles.some((r) => roles.includes(r))) {
    return { userId: null, roles: [], isServiceRole: false, error: deny("Forbidden", 403) };
  }

  return { userId, roles, isServiceRole: false, error: null };
}
