// Captura window.fetch ANTES de qualquer outro import patchá-lo.
// Importar como PRIMEIRO import em src/main.tsx.
export const originalFetch: typeof fetch =
  typeof window !== "undefined" && typeof window.fetch === "function"
    ? window.fetch.bind(window)
    : ((globalThis as any).fetch?.bind(globalThis) as typeof fetch);
