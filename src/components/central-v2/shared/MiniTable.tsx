import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface MiniColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  className?: string;
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
  maxRows = 5,
}: Props<T>) {
  return (
    <div className="central-card overflow-hidden">
      {title ? (
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
          {title}
        </div>
      ) : null}

      {loading ? (
        <div className="p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-2 flex gap-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    c.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, maxRows).map((row, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-2.5 text-foreground",
                      c.align === "right" ? "text-right" : "text-left",
                      c.className
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
