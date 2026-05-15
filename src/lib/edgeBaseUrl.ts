// Base URL para chamadas diretas a edge functions.
// Runtime 15/05/2026 v4 — DIRETO ÚNICO: sempre o host Supabase oficial.
// DNS Cloudflare (api.uhomesales.com) não é mais usado pelo frontend.
//
// IMPORTANTE: este é apenas o ORIGIN. Os callers concatenam `/functions/v1/<name>`.

const DIRECT_API_BASE = "https://hunbxqzhvuemgntklyzb.supabase.co";

export const EDGE_BASE_URL = DIRECT_API_BASE;

export function getEdgeBaseUrl(): string {
  return EDGE_BASE_URL;
}
