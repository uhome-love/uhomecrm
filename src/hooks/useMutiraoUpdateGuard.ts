import { useEffect, useState } from "react";

/**
 * Enquanto o corretor estiver em ligação (callState === "in_call"):
 * - Sinaliza `window.__uhomeInCall = true` para o registrador do SW não
 *   recarregar a página automaticamente após deploy.
 * - Adiciona `beforeunload` para alertar caso algo tente fechar/recarregar.
 *
 * Retorna `pendingReload` (true quando existe versão nova aguardando aplicar)
 * e uma função `applyPendingReload()` para recarregar manualmente.
 */
export function useMutiraoUpdateGuard(callState: "idle" | "in_call" | "ended") {
  const [pendingReload, setPendingReload] = useState<boolean>(
    () => typeof window !== "undefined" && (window as any).__uhomePendingReload === true,
  );

  useEffect(() => {
    const onPending = () => setPendingReload(true);
    window.addEventListener("uhome:pending-reload", onPending);
    // Poll leve pra pegar flag setada antes da assinatura do listener.
    const t = setInterval(() => {
      if ((window as any).__uhomePendingReload === true) setPendingReload(true);
    }, 5000);
    return () => {
      window.removeEventListener("uhome:pending-reload", onPending);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const inCall = callState === "in_call";
    (window as any).__uhomeInCall = inCall;
    if (!inCall) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      (window as any).__uhomeInCall = false;
    };
  }, [callState]);

  const applyPendingReload = () => {
    (window as any).__uhomePendingReload = false;
    window.location.reload();
  };

  return { pendingReload, applyPendingReload, inCall: callState === "in_call" };
}
