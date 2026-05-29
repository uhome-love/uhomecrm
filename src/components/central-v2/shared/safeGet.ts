/**
 * safeGet — acesso defensivo a campos de jsonb retornado pelas RPCs da Central.
 *
 * Em DEV emite console.warn quando o caminho esperado é undefined, ajudando a
 * detectar mismatches RPC ↔ frontend rapidamente. Em produção, falha silenciosa
 * com fallback `null` (UI renderiza "—").
 */
export function safeGet<T = unknown>(
  obj: unknown,
  path: string,
  label: string
): T | null {
  const value = path.split(".").reduce<unknown>(
    (acc, key) => (acc == null ? acc : (acc as Record<string, unknown>)[key]),
    obj
  );

  const rootEmpty =
    obj == null ||
    (typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj as object).length === 0);

  if (import.meta.env.DEV && value === undefined && !rootEmpty) {
    // eslint-disable-next-line no-console
    console.warn(`[Central v2] Missing field: ${label} at ${path}`, obj);
  }

  return (value ?? null) as T | null;
}
