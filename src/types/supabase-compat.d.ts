/**
 * Type compatibility augmentations.
 * Uses proper module augmentation (not replacement) to add missing types.
 */

// Must be a module for augmentation to work
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

  // Fix SupabaseAuthClient missing methods
  interface SupabaseAuthClient {
    getSession(): Promise<{ data: { session: Session | null }; error: any }>;
    getUser(): Promise<{ data: { user: User | null }; error: any }>;
  }
}

declare module "@tanstack/react-query" {
  export const keepPreviousData: any;
}
