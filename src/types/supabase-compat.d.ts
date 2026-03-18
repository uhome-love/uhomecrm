/**
 * Type compatibility augmentations.
 * 
 * 1. Override SupabaseClient.from() to return `any` — bypasses the
 *    PostgrestVersion: "14.1" that forces `unknown` returns.
 * 2. Add missing auth methods to SupabaseAuthClient.
 * 3. Fix keepPreviousData export.
 */

export {};

declare module "@supabase/supabase-js" {
  export interface User {
    id: string;
    email?: string;
    phone?: string;
    app_metadata: Record<string, any>;
    user_metadata: Record<string, any>;
    aud: string;
    created_at: string;
    [key: string]: any;
  }

  export interface Session {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
    token_type: string;
    user: User;
    [key: string]: any;
  }

  interface SupabaseClient {
    from(relation: string): any;
  }

  interface SupabaseAuthClient {
    getSession(): Promise<{ data: { session: Session | null }; error: any }>;
    getUser(jwt?: string): Promise<{ data: { user: User | null }; error: any }>;
    onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: { unsubscribe: () => void } } };
    signUp(credentials: any): Promise<{ data: any; error: any }>;
    signInWithPassword(credentials: any): Promise<{ data: any; error: any }>;
    signOut(): Promise<{ error: any }>;
    updateUser(attributes: any): Promise<{ data: any; error: any }>;
  }
}

declare module "@tanstack/react-query" {
  export const keepPreviousData: any;
}
