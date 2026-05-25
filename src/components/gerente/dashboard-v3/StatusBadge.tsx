import { cn } from "@/lib/utils";
import type { CorretorStatusV3 } from "@/hooks/useDashboardGerenteV3";

const MAP: Record<CorretorStatusV3, { label: string; cls: string }> = {
  top: { label: "Top", cls: "bg-success-50 text-success-700 ring-success-500/20" },
  em_alta: { label: "Em alta", cls: "bg-primary-50 text-primary-600 ring-primary-500/20" },
  ok: { label: "OK", cls: "bg-muted text-muted-foreground ring-border" },
  atencao: { label: "Atenção", cls: "bg-warning-50 text-warning-700 ring-warning-500/20" },
  critico: { label: "Crítico", cls: "bg-danger-50 text-danger-700 ring-danger-500/20" },
};

export function StatusBadge({ status }: { status: CorretorStatusV3 }) {
  const cfg = MAP[status] ?? MAP.ok;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  );
}
