// Retry com TETO (3 tentativas), parada imediata em erros de auth (401/403/JWT)
// e backoff exponencial com jitter — proteção contra amplificação durante
// rede instável OU sessão quebrada (não reentra em /token quando JWT já está bad).
const DEFAULT_RETRY_ATTEMPTS = 3;
// Sleep ENTRE tentativas (após attempt N, antes de attempt N+1).
// Com 3 tentativas, são usados delays[0] e delays[1] — delays[2] fica como
// safety-net se algum caller subir attempts manualmente.
const RETRY_BACKOFF_MS = [250, 600, 1500] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(base: number) {
  // ±25% jitter
  const spread = base * 0.25;
  return Math.round(base + (Math.random() * 2 - 1) * spread);
}

export function normalizeQueryError(error: unknown, fallback = "Erro ao carregar dados") {
  if (error instanceof Error) return error;
  if (typeof error === "string" && error.trim()) return new Error(error);

  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: string }).message || fallback).trim();
    return new Error(message || fallback);
  }

  return new Error(fallback);
}

export function isTransientFetchError(error: unknown) {
  const message = normalizeQueryError(error).message;
  return /failed to fetch|fetch failed|load failed|networkerror|network request failed/i.test(message);
}

/**
 * Detecta erro de autenticação — NUNCA tentar de novo.
 * Re-tentar com JWT ruim só amplifica 401/403 e atrapalha o fluxo de refresh.
 * Cobre: status HTTP, error.code do PostgREST/GoTrue, e palavras-chave na mensagem.
 */
export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;

  const status = typeof e.status === "number" ? e.status : Number(e.status);
  if (status === 401 || status === 403) return true;

  const code = typeof e.code === "string" ? e.code : "";
  // PGRST301 = JWT expired (PostgREST). 401/403 também aparecem como string.
  if (code === "PGRST301" || code === "401" || code === "403") return true;

  const message = String((e as { message?: string }).message || "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("jwt") ||
    message.includes("invalid claim") ||
    message.includes("missing sub") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("not authenticated") ||
    message.includes("unauthorized")
  );
}

export async function runQueryWithRetry<T>(
  run: () => Promise<{ data: T | null; error: unknown }>,
  options?: { attempts?: number; baseDelayMs?: number },
): Promise<{ data: T | null; error: Error | null }> {
  const attempts = Math.max(1, options?.attempts ?? DEFAULT_RETRY_ATTEMPTS);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let rawError: unknown = null;
    try {
      const result = await run();
      if (!result.error) return { data: result.data, error: null };
      rawError = result.error;
      lastError = normalizeQueryError(result.error);
    } catch (error) {
      rawError = error;
      lastError = normalizeQueryError(error);
    }

    // PARADA IMEDIATA em erro de auth — não amplificar JWT quebrado.
    if (isAuthError(rawError)) {
      return { data: null, error: lastError };
    }

    // Erro não-transiente OU última tentativa: devolve.
    if (!isTransientFetchError(lastError) || attempt === attempts) {
      return { data: null, error: lastError };
    }

    const delay = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
    await sleep(jitter(delay));
  }

  return { data: null, error: lastError ?? new Error("Erro ao carregar dados") };
}

export async function fetchInBatchesWithRetry<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<{ data: T[] | null; error: unknown }>,
  options?: { chunkSize?: number; minChunkSize?: number; attempts?: number },
): Promise<{ rows: T[]; errors: Error[] }> {
  const chunkSize = options?.chunkSize ?? 50;
  const minChunkSize = options?.minChunkSize ?? 10;
  const attempts = options?.attempts ?? DEFAULT_RETRY_ATTEMPTS;

  const fetchRecursive = async (chunk: string[]): Promise<{ rows: T[]; errors: Error[] }> => {
    if (chunk.length === 0) return { rows: [], errors: [] };

    const { data, error } = await runQueryWithRetry(() => fetchChunk(chunk), { attempts });
    if (!error) {
      return { rows: data || [], errors: [] };
    }

    if (!isTransientFetchError(error) || chunk.length <= minChunkSize) {
      return { rows: [], errors: [error] };
    }

    const middle = Math.ceil(chunk.length / 2);
    const left = await fetchRecursive(chunk.slice(0, middle));
    const right = await fetchRecursive(chunk.slice(middle));

    return {
      rows: [...left.rows, ...right.rows],
      errors: [...left.errors, ...right.errors],
    };
  };

  const allRows: T[] = [];
  const allErrors: Error[] = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const result = await fetchRecursive(chunk);
    allRows.push(...result.rows);
    allErrors.push(...result.errors);
  }

  return { rows: allRows, errors: allErrors };
}
