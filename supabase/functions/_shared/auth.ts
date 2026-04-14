/**
 * _shared/auth.ts — Shared JWT authentication helper for Edge Functions
 *
 * Usage:
 *   import { requireAuth } from "../_shared/auth.ts";
 *   import { errorResponse } from "../_shared/cors.ts";
 *
 *   const auth = await requireAuth(req);
 *   if (auth.error) return auth.error;
 *   const userId = auth.userId;
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "./cors.ts";

export interface AuthResult {
  userId: string;
  error: null;
}

export interface AuthError {
  userId: null;
  error: Response;
}

/**
 * Validate the Authorization header and return the authenticated user ID.
 * Returns an error Response if authentication fails.
 */
export async function requireAuth(req: Request): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null, error: errorResponse("Unauthorized", 401) };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return { userId: null, error: errorResponse("Unauthorized", 401) };
  }

  return { userId: data.claims.sub as string, error: null };
}
