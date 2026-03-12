const APP_DOMAIN = "https://uhomesales.com";

/**
 * Generates the shareable vitrine URL that includes Open Graph meta tags
 * for rich WhatsApp/social media previews with property images.
 * The OG page auto-redirects users to the SPA vitrine page.
 */
export function getVitrineShareUrl(vitrineId: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/vitrine-og?id=${vitrineId}`;
}

/**
 * Direct SPA URL for the vitrine (no OG preview).
 */
export function getVitrineDirectUrl(vitrineId: string): string {
  return `${APP_DOMAIN}/vitrine/${vitrineId}`;
}
