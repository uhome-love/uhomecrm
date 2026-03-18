// Module augmentation (not replacement) for supabase-js auth client
// Must have at least one top-level import/export to be treated as augmentation
import type { Session, User } from "@supabase/supabase-js";

declare module "@supabase/supabase-js" {
  interface SupabaseAuthClient {
    getSession(): Promise<{
      data: { session: Session | null };
      error: any;
    }>;
    getUser(): Promise<{
      data: { user: User | null };
      error: any;
    }>;
  }
}

export {};
