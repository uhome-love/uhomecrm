import { useBackendHealth } from "@/hooks/useBackendHealth";
import { Loader2 } from "lucide-react";

/**
 * Banner único global de reconexão.
 * - Aparece somente quando há 2+ falhas seguidas de ping ao backend.
 * - Some sozinho assim que o ping voltar a passar.
 * - Não bloqueia nenhuma interação — é só sinal visual.
 */
export default function BackendHealthBanner() {
  const { degraded } = useBackendHealth();
  if (!degraded) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9000] flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-lg backdrop-blur-md dark:border-amber-700/60 dark:bg-amber-950/80 dark:text-amber-100"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Reconectando ao servidor…
    </div>
  );
}
