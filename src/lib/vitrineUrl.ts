/**
 * Vitrine public URL generator.
 *
 * Always returns the official uhomesales.com domain URL.
 * The edge function vitrine-og exists as internal infrastructure
 * for OG metadata generation but is NEVER exposed to end users.
 *
 * OG previews are handled via server-side rewrite/proxy at the
 * hosting layer (e.g. Cloudflare, Vercel, etc.) that internally
 * calls the edge function when a crawler is detected.
 */

const PUBLIC_DOMAIN = "https://uhomesales.com";

/**
 * Returns the official public URL for a vitrine.
 * Always uses the canonical uhomesales.com domain.
 */
export function getVitrinePublicUrl(vitrineId: string): string {
  return `${PUBLIC_DOMAIN}/vitrine/${vitrineId}`;
}

/** @deprecated Use getVitrinePublicUrl instead */
export const getVitrineShareUrl = getVitrinePublicUrl;

/** @deprecated Use getVitrinePublicUrl instead */
export const getVitrineDirectUrl = getVitrinePublicUrl;
