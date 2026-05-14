// Mais tentativas + backoff maior para sobreviver ao "Load failed" do Safari/iOS
// no PWA (rede flapando, túnel celular, ServiceWorker proxying).
const DEFAULT_RETRY_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function runQueryWithRetry<T>(
  run: () => Promise<{ data: T | null; error: unknown }>,
  options?: { attempts?: number; baseDelayMs?: number },
): Promise<{ data: T | null; error: Error | null }> {
  const attempts = options?.attempts ?? DEFAULT_RETRY_ATTEMPTS;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await run();
      if (!result.error) return { data: result.data, error: null };

      lastError = normalizeQueryError(result.error);
      if (!isTransientFetchError(lastError) || attempt === attempts) {
        return { data: result.data, error: lastError };
      }
    } catch (error) {
      lastError = normalizeQueryError(error);
      if (!isTransientFetchError(lastError) || attempt === attempts) {
        return { data: null, error: lastError };
      }
    }

    await sleep(baseDelayMs * attempt);
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