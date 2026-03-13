/**
 * Vitrine public URL generator.
 *
 * Shared links go through the vitrine-og edge function so that
 * WhatsApp / Telegram / social-media crawlers receive real OG meta
 * tags (title, description, image) from the vitrine data.
 *
 * The edge function detects bots → serves OG HTML.
 * Regular browsers → 302 redirect to the SPA route.
 */

const SUPABASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  "https://hunbxqzhvuemgntklyzb.supabase.co";

/**
 * Returns the share-safe URL for a vitrine.
 * Routes through the vitrine-og edge function so crawlers see real OG tags.
 */
export function getVitrinePublicUrl(vitrineId: string): string {
  return `${SUPABASE_URL}/functions/v1/vitrine-og?id=${vitrineId}`;
}

/** @deprecated Use getVitrinePublicUrl instead */
export const getVitrineShareUrl = getVitrinePublicUrl;

/** @deprecated Use getVitrinePublicUrl instead */
export const getVitrineDirectUrl = getVitrinePublicUrl;
