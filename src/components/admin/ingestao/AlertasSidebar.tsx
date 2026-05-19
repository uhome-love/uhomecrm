import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Activity } from "lucide-react";
import type { TripwireStatus, AlertaSaudeAtivo } from "@/hooks/useIngestaoStats";
import type { EdgeStats } from "@/hooks/useIngestaoEdgeStats";
import { AlertasSaudeCard } from "./AlertasSaudeCard";

interface Props {
  tripwire: TripwireStatus | undefined;
  edgeStats: EdgeStats | undefined;
  avulsoCount: number | undefined;
  alertasSaude: AlertaSaudeAtivo[] | undefined;
  alertasSaudeLoading: boolean;
}

export function AlertasSidebar({ tripwire, edgeStats, avulsoCount, alertasSaude, alertasSaudeLoading }: Props) {
  return (
    <div className="space-y-3">
      {/* Tripwire */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Tripwire de Secrets
        </h3>
        {!tripwire || tripwire.status === "unknown" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HelpCircle className="h-4 w-4" />
            Sem dados
          </div>
        ) : tripwire.status === "ok" ? (
          <div>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-500 font-medium text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Tudo OK
            </div>
            <div className="text-xs text-muted-foreground mt-1">{tripwire.message}</div>
            <div className="text-xs text-muted-foreground mt-1">
              última checagem há {tripwire.minutes_since}min
            </div>
          </div>
        ) : tripwire.status === "stale" ? (
          <div>
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 font-medium text-sm">
              <AlertTriangle className="h-4 w-4" />
              Checagem atrasada
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              última há {tripwire.minutes_since}min (esperado &lt;15min). Cron pode ter parado.
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 text-destructive font-medium text-sm">
              <XCircle className="h-4 w-4" />
              Secrets faltando
            </div>
            <div className="text-xs text-muted-foreground mt-1">{tripwire.message}</div>
          </div>
        )}
      </Card>

      {/* 503s */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Erros 503 (proxy via ops_events)
        </h3>
        {!edgeStats ? (
          <div className="text-sm text-muted-foreground">carregando…</div>
        ) : edgeStats.total_503 === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
            <CheckCircle2 className="h-4 w-4" /> Zero ocorrências
          </div>
        ) : (
          <div>
            <div className="text-2xl font-bold text-destructive">{edgeStats.total_503}</div>
            <div className="space-y-1 mt-2">
              {Object.entries(edgeStats.counts_503)
                .filter(([, n]) => n > 0)
                .map(([fn, n]) => (
                  <div key={fn} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{fn}</span>
                    <span className="font-mono">{n}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        {edgeStats?.note && (
          <div className="text-xs text-muted-foreground mt-2 italic">{edgeStats.note}</div>
        )}
      </Card>

      {/* Avulso ImovelWeb */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
          <Activity className="h-3 w-3" /> Avulso ImovelWeb
        </h3>
        {avulsoCount === undefined ? (
          <div className="text-sm text-muted-foreground">carregando…</div>
        ) : (
          <>
            <div className="text-2xl font-bold">{avulsoCount}</div>
            <div className="text-xs text-muted-foreground mt-1">
              leads ImovelWeb sem empreendimento mapeado
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
