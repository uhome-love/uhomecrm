import { cn } from "@/lib/utils";
import { STATUS_LABELS, type VisitaStatus } from "@/hooks/useVisitas";

const STATUS_CHIP_COLORS: Record<string, string> = {
  marcada: "bg-amber-100 text-amber-700 border-amber-300",
  confirmada: "bg-blue-100 text-blue-700 border-blue-300",
  realizada: "bg-green-100 text-green-700 border-green-300",
  reagendada: "bg-purple-100 text-purple-700 border-purple-300",
  cancelada: "bg-gray-100 text-gray-600 border-gray-300",
  no_show: "bg-red-100 text-red-700 border-red-300",
};

const STATUS_EMOJIS: Record<string, string> = {
  marcada: "🟡", confirmada: "🔵", realizada: "✅", reagendada: "🔄", cancelada: "⚫", no_show: "❌",
};

const STATUSES: VisitaStatus[] = ["marcada", "confirmada", "realizada", "reagendada", "no_show", "cancelada"];

export type QuickFilterKey = "" | "nao_confirmadas" | "sem_feedback";

interface VisitasQuickFiltersProps {
  statusFilter: string;
  onStatusChange: (s: string) => void;
  quickFilter: QuickFilterKey;
  onQuickFilterChange: (k: QuickFilterKey) => void;
  counts: Record<string, number>;
  totalCount: number;
}

export default function VisitasQuickFilters({
  statusFilter, onStatusChange,
  quickFilter, onQuickFilterChange,
  counts, totalCount,
}: VisitasQuickFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => { onStatusChange("all"); onQuickFilterChange(""); }}
        className={cn(
          "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border",
          statusFilter === "all" && !quickFilter
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
        )}
      >
        Todas ({totalCount})
      </button>

      {STATUSES.map(s => {
        const count = counts[s] || 0;
        const isActive = statusFilter === s && !quickFilter;
        return (
          <button
            key={s}
            onClick={() => {
              onQuickFilterChange("");
              onStatusChange(statusFilter === s ? "all" : s);
            }}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border",
              isActive
                ? STATUS_CHIP_COLORS[s] + " shadow-sm"
                : count === 0
                  ? "bg-muted/20 text-muted-foreground/30 border-transparent cursor-default"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
            )}
          >
            {STATUS_EMOJIS[s]} {STATUS_LABELS[s]} ({count})
          </button>
        );
      })}

      <span className="mx-1 h-4 w-px bg-border/50" />

      {([
        { key: "nao_confirmadas" as QuickFilterKey, label: "⚠️ Não confirmadas" },
        { key: "sem_feedback" as QuickFilterKey, label: "🔴 Sem feedback" },
      ]).map(qf => (
        <button
          key={qf.key}
          onClick={() => {
            if (quickFilter === qf.key) {
              onQuickFilterChange("");
              onStatusChange("all");
            } else {
              onQuickFilterChange(qf.key);
              // These filters handle their own status/pending logic
              onStatusChange(qf.key === "nao_confirmadas" ? "marcada" : "all");
            }
          }}
          className={cn(
            "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border",
            quickFilter === qf.key
              ? "bg-amber-100 text-amber-700 border-amber-300 shadow-sm"
              : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
          )}
        >
          {qf.label}
        </button>
      ))}
    </div>
  );
}
