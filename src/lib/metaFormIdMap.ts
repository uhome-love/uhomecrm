/**
 * Mapping of Meta (Facebook/Instagram) Lead Ads form IDs to human-readable names.
 * Mirrors the map used in the `receive-meta-lead` edge function so that the UI
 * never displays raw numeric IDs (e.g. "3325414164266311") to users.
 *
 * When a new Meta form is launched, add the ID + name here AND in
 * `supabase/functions/receive-meta-lead/index.ts`.
 */
export const META_FORM_ID_MAP: Record<string, string> = {
  "960687922961852": "Seen Três Figueiras (Imagem)",
  "968777322384911": "Seen Três Figueiras (Imagem)",
  "1162388785694311": "Casa Bastian (Imagem)",
  "1193321542872133": "Shift (Video Gabriel)",
  "1407341861064013": "Open Bosque (Video Lucas)",
  "1176432314301412": "Open Bosque (Video Gabrielle)",
  "1593024068412518": "Melnick Day Alto Padrão (Video Gabrielle)",
  "1626788291996359": "Lake Eyre (Imagem)",
  "1435408764647078": "Lake Eyre (Video)",
  "1800577237319392": "Shift (Imagem)",
  "1877406309585794": "Melnick Day Médio Padrão (Video Bruno)",
  "2055662701942686": "Lake Eyre (Video Lucas)",
  "3325414164266311": "Casa Tua",
  "895837159874711": "Melnick Day Compactos (Video Gabriel)",
  "897551219671969": "Las Casas (Imagem)",
  "900345566146636": "High Garden Iguatemi",
  "945021998283301": "High Garden Iguatemi (Imagem)",
  "945250778357878": "Casa Bastian (Video)",
  "921991273926020": "Orygem (Vídeo Gabrielle)",
  "924855113517986": "Las Casas (Video Gabrielle)",
  "966583865699014": "Orygem (Vídeo Lucas)",
  "1253040266458947": "Casa Tua",
  "1486693902966370": "Casa Tua",
  "1853179655371596": "Casa Tua",
  "1581836316228994": "Alto Lindóia",
  "1575975843886888": "Alto Lindóia",
  "4369342313310610": "Lake Eyre",
};

/**
 * Resolves a raw form detail string to a human-readable name.
 * - If value is a known numeric Meta form ID → returns mapped name.
 * - If value is purely numeric and unmapped → returns "Formulário Meta" (never the raw number).
 * - Otherwise returns the original value (already a readable label).
 */
export function resolveFormName(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (META_FORM_ID_MAP[trimmed]) return META_FORM_ID_MAP[trimmed];
  if (/^\d{6,}$/.test(trimmed)) return "Formulário Meta";
  return trimmed;
}
