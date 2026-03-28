import { createClient } from "@supabase/supabase-js";

const SITE_URL = import.meta.env.VITE_UHOME_SITE_URL ?? "https://huigglwvvzuwwyqvpmec.supabase.co";
const SITE_ANON_KEY = import.meta.env.VITE_UHOME_SITE_ANON_KEY ?? "";

export const supabaseSite = createClient(SITE_URL, SITE_ANON_KEY);
