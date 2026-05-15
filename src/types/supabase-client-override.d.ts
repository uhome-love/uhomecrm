/**
 * Override the auto-generated Supabase client type to bypass
 * the PostgrestVersion: "14.1" setting that forces `unknown` returns.
 *
 * This makes all `.from()` queries return `any` instead of `unknown`,
 * restoring the default postgrest-js behavior.
 */
declare module "@/integrations/supabase/client" {
  import type { SupabaseClient } from "@supabase/supabase-js";
  export const supabase: SupabaseClient<any>;
}
