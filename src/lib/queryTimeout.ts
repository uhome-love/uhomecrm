// Wrapper de timeout para qualquer Promise.
// Usa Promise.race + setTimeout. Quando o timeout vence, rejeita com Error
// rotulada — facilita logs e Sentry agruparem por origem.
//
// IMPORTANTE: NÃO cancela a promise original (não dá pra cancelar fetch sem AbortController);
// só desbloqueia o caller. A query subjacente pode continuar rodando em background.
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${label} demorou demais para responder (>${ms}ms)`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
