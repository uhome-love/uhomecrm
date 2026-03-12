const APP_DOMAIN = "https://uhomesales.com";

/**
 * Returns the official public URL for a vitrine.
 * This is the ONLY URL that should be displayed, copied, or shared.
 * Never expose Supabase function URLs to the end user.
 */
export function getVitrinePublicUrl(vitrineId: string): string {
  return `${APP_DOMAIN}/vitrine/${vitrineId}`;
}

/** @deprecated Use getVitrinePublicUrl instead */
export const getVitrineShareUrl = getVitrinePublicUrl;

/** @deprecated Use getVitrinePublicUrl instead */
export const getVitrineDirectUrl = getVitrinePublicUrl;
