import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface MiniColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  className?: string;
  /** Quando fornecido, desenha uma barra de fundo proporcional ao valor. */
  bar?: (row: T) => number;
}

interface Props<T> {
  title?: string;
  columns: MiniColumn<T>[];
  rows?: T[];
  loading?: boolean;
  emptyLabel?: string;
  maxRows?: number;
}

export function MiniTable<T>({
  title,
  columns,
  rows,
  loading,
  emptyLabel = "Sem dados no período.",
  maxRows = 6,
}: Props<T>) {
  const visible = (rows ?? []).slice(0, maxRows);

  // Pré-calcula o máximo por coluna com barra (para proporção).
  const barMax: Record<string, number> = {};
  columns.forEach((c) => {
    if (c.bar) {
      barMax[c.key] = Math.max(...visible.map((r) => c.bar!(r) || 0), 1);
    }
  });

  return (
    <div className="central-card overflow-hidden">
      {title ? (
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
          {title}
        </div>
      ) : null}

      {loading ? (
        <div className="p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mb-2 flex gap-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    c.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
              >
                {columns.map((c) => {
                  const barPct = c.bar ? Math.max((c.bar(row) / barMax[c.key]) * 100, 0) : null;
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "relative px-4 py-2.5 text-foreground",
                        c.align === "right" ? "text-right" : "text-left",
                        c.className
                      )}
                    >
                      {barPct != null ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-1 left-2 -z-0 rounded bg-primary/[0.08]"
                          style={{ width: `calc(${barPct}% - 0.5rem)` }}
                        />
                      ) : null}
                      <span className="relative z-10">{c.render(row)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
