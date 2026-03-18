// Fix SupabaseAuthClient missing methods in newer type versions
import type { Session, User } from "@supabase/supabase-js";

declare module "@supabase/supabase-js" {
  interface SupabaseAuthClient {
    getSession(): Promise<{ data: { session: Session | null }; error: any }>;
    getUser(): Promise<{ data: { user: User | null }; error: any }>;
  }
}
