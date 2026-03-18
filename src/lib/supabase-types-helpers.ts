/**
 * Re-export Json type so application code doesn't need to import
 * from the auto-generated types.ts directly.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
