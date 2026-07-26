import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Calendar } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { useMotorCapDia, useMotorConfig } from "@/hooks/useMotorReengajamento";

export default function WarmupCard() {
  const capQ = useMotorCapDia();
  const cfgQ = useMotorConfig();

  const cfg = cfgQ.data;
  const cap = capQ.data?.cap ?? 0;
  const enviados = capQ.data?.enviados ?? 0;
  const pct = cap > 0 ? Math.min(100, Math.round((enviados / cap) * 100)) : 0;

  const dia = (() => {
    if (!cfg?.warmup_started_at) return null;
    const start = new Date(cfg.warmup_started_at + "T00:00:00-03:00").getTime();
    const now = Date.now();
    return Math.max(1, Math.floor((now - start) / 86_400_000) + 1);
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-600" />
          Warm-up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Dia do ramp" value={dia ? `D${dia}` : "—"} />
          <Stat label="Cap do dia" value={cap.toString()} />
          <Stat label="Enviados" value={enviados.toString()} />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>Uso do cap</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground pt-1">
          <Calendar className="h-3 w-3" />
          <span>
            Início: {cfg?.warmup_started_at ? formatBRT(cfg.warmup_started_at + "T00:00:00-03:00", "dd/MM/yyyy") : "—"}
          </span>
          <span>·</span>
          <span>Inicial: {cfg?.warmup_inicial ?? 0}/dia</span>
          <span>·</span>
          <span>Incremento: +{cfg?.warmup_incremento_pct ?? 0}%/dia</span>
          {cfg?.warmup_pausado_ate && (
            <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 text-[10px]">
              Pausa segura até {formatBRT(cfg.warmup_pausado_ate + "T00:00:00-03:00", "dd/MM")}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-2 py-2">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
