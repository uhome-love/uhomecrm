// Base URL para chamadas diretas a edge functions.
// Usa o proxy Cloudflare para evitar bloqueios de rede em *.supabase.co.
// Rollback: trocar para `${import.meta.env.VITE_SUPABASE_URL}` se necessário.
export const EDGE_BASE_URL = "https://api.uhomesales.com";
