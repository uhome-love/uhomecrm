// Override the auto-generated Database type to remove PostgrestVersion strict inference
// This fixes the widespread 'unknown' type errors from supabase queries
// while keeping the table definitions intact

import type { Database as OriginalDatabase } from "@/integrations/supabase/types";

// Re-export Database without the __InternalSupabase constraint
// This makes postgrest queries return 'any' for select results instead of 'unknown'
export type Database = Omit<OriginalDatabase, "__InternalSupabase"> & {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
};
