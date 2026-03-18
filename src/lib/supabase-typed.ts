export function castData<T>(data: unknown): T[] {
  return (data ?? []) as T[];
}

export function castSingle<T>(data: unknown): T | null {
  return (data ?? null) as T | null;
}
