const APP_DOMAIN = "https://uhomesales.com";

/**
 * Generates the shareable vitrine URL using the approved domain.
 * For social media / WhatsApp sharing with OG meta tags.
 */
export function getVitrineShareUrl(vitrineId: string): string {
  return `${APP_DOMAIN}/vitrine/${vitrineId}`;
}

/**
 * Direct SPA URL for the vitrine (no OG preview).
 */
export function getVitrineDirectUrl(vitrineId: string): string {
  return `${APP_DOMAIN}/vitrine/${vitrineId}`;
}
