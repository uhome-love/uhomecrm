const PUBLISHED_APP_DOMAIN = "https://uhomeia.lovable.app";

function resolvePublicDomain(): string {
  if (typeof window === "undefined") return PUBLISHED_APP_DOMAIN;

  const origin = window.location.origin;
  const isPreview = origin.includes("lovableproject.com") || origin.includes("id-preview--");

  return isPreview ? PUBLISHED_APP_DOMAIN : origin;
}

/**
 * Returns the official public URL for a vitrine.
 * This is the ONLY URL that should be displayed, copied, or shared.
 * Never expose backend function URLs to the end user.
 */
export function getVitrinePublicUrl(vitrineId: string): string {
  const base = resolvePublicDomain().replace(/\/$/, "");
  return `${base}/vitrine/${vitrineId}`;
}

/** @deprecated Use getVitrinePublicUrl instead */
export const getVitrineShareUrl = getVitrinePublicUrl;

/** @deprecated Use getVitrinePublicUrl instead */
export const getVitrineDirectUrl = getVitrinePublicUrl;
