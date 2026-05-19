import { Card } from "@/components/ui/card";
import { useState } from "react";
import { ChevronDown, ChevronRight, AlertCircle, Info, AlertTriangle } from "lucide-react";
import type { OpsEventRow } from "@/hooks/useIngestaoStats";
import { formatBRT } from "@/lib/brtTime";

interface Props {
  rows: OpsEventRow[] | undefined;
  loading: boolean;
}

function LevelIcon({ level }: { level: string }) {
  if (level === "error") return <AlertCircle className="h-4 w-4 text-destructive" />;
  if (level === "warn") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

export function EventosRecentesTable({ rows, loading }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading && !rows) {
    return <Card className="p-6 h-64 animate-pulse bg-muted/30" />;
  }
  if (!rows || rows.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nenhum evento no período.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Eventos recentes</h3>
        <div className="text-xs text-muted-foreground">últimos {rows.length} eventos receive-*</div>
      </div>
      <div className="divide-y max-h-[480px] overflow-auto">
        {rows.map((r) => {
          const isOpen = expanded === r.id;
          return (
            <div key={r.id} className="text-xs">
              <button
                onClick={() => setExpanded(isOpen ? null : r.id)}
                className="w-full flex items-start gap-2 px-4 py-2 hover:bg-muted/40 text-left"
              >
                {isOpen ? <ChevronDown className="h-3 w-3 mt-1 shrink-0" /> : <ChevronRight className="h-3 w-3 mt-1 shrink-0" />}
                <LevelIcon level={r.level} />
                <span className="font-mono text-muted-foreground shrink-0">
                  {formatBRT(r.created_at, "HH:mm:ss")}
                </span>
                <span className="font-medium shrink-0">{r.fn}</span>
                <span className="text-muted-foreground shrink-0">[{r.category ?? "—"}]</span>
                <span className="truncate flex-1">{r.message}</span>
              </button>
              {isOpen && (
                <div className="px-10 pb-3 bg-muted/30 space-y-1">
                  {r.trace_id && (
                    <div>
                      <span className="font-medium">trace_id:</span> <span className="font-mono">{r.trace_id}</span>
                    </div>
                  )}
                  {r.ctx && (
                    <div>
                      <span className="font-medium">ctx:</span>
                      <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-auto">
                        {JSON.stringify(r.ctx, null, 2)}
                      </pre>
                    </div>
                  )}
                  {r.error_detail && (
                    <div>
                      <span className="font-medium">error_detail:</span>
                      <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-auto whitespace-pre-wrap">
                        {r.error_detail}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
