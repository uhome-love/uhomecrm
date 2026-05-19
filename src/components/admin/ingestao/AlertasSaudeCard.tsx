import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AlertaSaudeAtivo } from "@/hooks/useIngestaoStats";

interface Props {
  ativos: AlertaSaudeAtivo[] | undefined;
  loading: boolean;
}

export function AlertasSaudeCard({ ativos, loading }: Props) {
  return (
    <Card className="p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
        <Activity className="h-3 w-3" /> Alertas Ativos de Saúde
      </h3>

      {loading ? (
        <div className="text-sm text-muted-foreground">carregando…</div>
      ) : !ativos || ativos.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
          <CheckCircle2 className="h-4 w-4" /> Nenhum alerta ativo
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <AlertTriangle className="h-4 w-4" />
            {ativos.length} function{ativos.length > 1 ? "s" : ""} instável
            {ativos.length > 1 ? "is" : ""}
          </div>
          <ul className="space-y-1">
            {ativos.map((a) => {
              const pct = Math.round(a.error_rate * 100);
              return (
                <li
                  key={a.fn}
                  className="text-xs flex items-center justify-between gap-2"
                >
                  <span className="font-mono truncate" title={a.fn}>
                    {a.fn}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {pct}% · há{" "}
                    {formatDistanceToNow(new Date(a.alerted_at), {
                      locale: ptBR,
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="text-xs text-muted-foreground italic pt-1 border-t">
            Dedup: 1 alerta/function/24h. Auto-resolve silencioso quando taxa
            volta &lt;50%.
          </div>
        </div>
      )}
    </Card>
  );
}
