/**
 * Type-safe wrappers for supabase.auth methods.
 * Centralizes auth calls to avoid TypeScript inference issues
 * with the auto-generated Database type.
 */
import { supabase } from "@/integrations/supabase/client";

export async function getAuthSession() {
  const result = await (supabase.auth as any).getSession();
  return (result as any)?.data?.session ?? null;
}

export async function getAuthAccessToken(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.access_token ?? null;
}

export async function getAuthUserId(): Promise<string | null> {
  const result = await supabase.auth.getUser();
  return (result as any)?.data?.user?.id ?? null;
}
