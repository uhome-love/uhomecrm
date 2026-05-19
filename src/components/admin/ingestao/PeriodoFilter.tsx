import { Button } from "@/components/ui/button";
import { Pause, Play, RefreshCw } from "lucide-react";
import type { Periodo } from "@/hooks/useIngestaoStats";

interface Props {
  periodo: Periodo;
  onPeriodoChange: (p: Periodo) => void;
  paused: boolean;
  onTogglePause: () => void;
  lastUpdate: Date | null;
}

const OPTIONS: { value: Periodo; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export function PeriodoFilter({ periodo, onPeriodoChange, paused, onTogglePause, lastUpdate }: Props) {
  const updatedSec = lastUpdate
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
    : null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1 rounded-md bg-muted p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onPeriodoChange(opt.value)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              periodo === opt.value
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={onTogglePause}>
        {paused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
        {paused ? "Retomar" : "Pausar"}
      </Button>

      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <RefreshCw className="h-3 w-3" />
        {paused
          ? "Pausado"
          : updatedSec !== null
          ? `atualizado há ${updatedSec}s`
          : "atualizando…"}
      </div>
    </div>
  );
}
