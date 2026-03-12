const APP_DOMAIN = "https://uhomesales.com";

/**
 * Generates the shareable vitrine URL that routes through the OG edge function.
 * Bots/crawlers receive rich OG meta tags (image, title, description).
 * Real users are 302-redirected to the SPA at uhomesales.com/vitrine/{id}.
 * WhatsApp preview card displays "uhomesales.com" via og:url.
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
