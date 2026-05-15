// Base URL para chamadas diretas a edge functions.
// Runtime 15/05/2026 v4 — DIRETO ÚNICO: sempre o host Supabase oficial.
// DNS Cloudflare (api.uhomesales.com) não é mais usado pelo frontend.

const DIRECT_API_BASE = "https://hunbxqzhvuemgntklyzb.supabase.co";

export const EDGE_BASE_URL = `${DIRECT_API_BASE}/functions/v1`;

export function getEdgeBaseUrl(): string {
  return EDGE_BASE_URL;
}
