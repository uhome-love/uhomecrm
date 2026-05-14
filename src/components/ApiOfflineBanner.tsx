import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiHealth } from "@/lib/apiHealth";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Banner global de indisponibilidade da API/proxy.
 * Aparece quando apiHealth = degraded/offline. Some sozinho quando volta.
 */
export default function ApiOfflineBanner() {
  const health = useApiHealth();
  const qc = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  // Pequeno debounce para não piscar em blips (<1.5s)
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (health === "online") {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(t);
  }, [health]);

  if (!visible || health === "online") return null;

  const isOffline = health === "offline";

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await qc.invalidateQueries();
    } finally {
      window.setTimeout(() => setRetrying(false), 1200);
    }
  };

  return (
    <div
      role="status"
      className="w-full px-4 py-2 text-sm flex items-center justify-between gap-3"
      style={{
        background: isOffline ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)",
        color: isOffline ? "#fca5a5" : "#fde68a",
        borderBottom: `1px solid ${isOffline ? "rgba(239,68,68,0.35)" : "rgba(234,179,8,0.35)"}`,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {isOffline
            ? "Conexão com o servidor indisponível. Os dados exibidos podem estar desatualizados."
            : "Conexão com o servidor instável. Tentando reconectar..."}
        </span>
      </div>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-white/10 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
        Tentar novamente
      </button>
    </div>
  );
}
