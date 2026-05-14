import { useEffect, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface StaleDataBadgeProps {
  staleSince: Date | null;
  onRetry?: () => void;
}

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

function StaleDataBadgeInner({ staleSince, onRetry }: StaleDataBadgeProps) {
  // Hooks devem rodar incondicionalmente — guard de render fica no JSX.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!staleSince) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [staleSince]);

  if (!staleSince) return null;

  const elapsedMs = now - staleSince.getTime();
  const elapsedLabel = formatElapsed(elapsedMs);
  const fullTimestamp = staleSince.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "medium",
  });

  return (
    <div
      role="status"
      aria-live="polite"
      title={`Última atualização bem-sucedida: ${fullTimestamp} (BRT)`}
      className="flex items-center gap-2 px-3 py-1.5 text-[12px] bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/70 dark:border-amber-900/50 text-amber-800 dark:text-amber-200"
    >
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="font-medium">
        Dados de há {elapsedLabel} — reconectando…
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 text-amber-900 dark:text-amber-100 transition-colors"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Atualizar agora
        </button>
      )}
    </div>
  );
}

/**
 * Badge sutil que avisa quando o pipeline está exibindo cache antigo
 * (carga falhou mas snapshot anterior foi preservado).
 *
 * Wrappado em ErrorBoundary com fallback `null` — se o badge crashar por
 * qualquer motivo, ele simplesmente não aparece, sem nunca derrubar a tela.
 */
export default function StaleDataBadge(props: StaleDataBadgeProps) {
  return (
    <ErrorBoundary
      fallback={null}
      onError={(err) =>
        console.error("[StaleDataBadge] crash:", err.message, err.stack)
      }
    >
      <StaleDataBadgeInner {...props} />
    </ErrorBoundary>
  );
}
