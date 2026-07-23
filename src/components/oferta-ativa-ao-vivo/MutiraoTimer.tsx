import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { secondsUntil } from "@/lib/brtTime";

/**
 * Timer isolado — re-renderiza apenas o próprio componente a cada segundo,
 * sem forçar re-render do CorretorScreen inteiro.
 */
export function MutiraoTimer({ fimAt }: { fimAt: string | null | undefined }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const secLeft = fimAt ? Math.max(0, Math.floor(secondsUntil(fimAt) ?? 0)) : 0;
  const hh = Math.floor(secLeft / 3600).toString().padStart(2, "0");
  const mm = Math.floor((secLeft % 3600) / 60).toString().padStart(2, "0");
  const ss = (secLeft % 60).toString().padStart(2, "0");
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 h-8 text-sm font-mono tabular-nums text-foreground">
      <Timer className="w-3.5 h-3.5 text-muted-foreground" />
      {hh}:{mm}:{ss}
    </div>
  );
}
