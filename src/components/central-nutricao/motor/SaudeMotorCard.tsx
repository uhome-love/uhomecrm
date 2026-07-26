import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Loader2, Signal } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { useMotorHeartbeat, useMotorResumoHoje, useMotorQuality, type QualityRating } from "@/hooks/useMotorReengajamento";
import { cn } from "@/lib/utils";

const QUALITY_STYLES: Record<QualityRating, { label: string; cls: string; dot: string }> = {
  GREEN: { label: "Verde", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-500" },
  YELLOW: { label: "Amarela", cls: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-500" },
  RED: { label: "Vermelha", cls: "bg-rose-100 text-rose-900 border-rose-300", dot: "bg-rose-500" },
  UNKNOWN: { label: "Sem leitura", cls: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
};

export function QualityBadge({ rating, size = "sm" }: { rating: QualityRating; size?: "sm" | "lg" }) {
  const s = QUALITY_STYLES[rating] ?? QUALITY_STYLES.UNKNOWN;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium", s.cls, size === "lg" ? "text-sm" : "text-[11px]")}>
      <span className={cn("h-2 w-2 rounded-full", s.dot)} />
      Qualidade {s.label}
    </span>
  );
}

export default function SaudeMotorCard() {
  const hb = useMotorHeartbeat();
  const resumo = useMotorResumoHoje();
  const quality = useMotorQuality();

  const last = hb.data;
  const status = last?.last_status ?? "unknown";
  const workerOk = status === "sent" || status === "skipped";
  const ageMs = last?.updated_at ? Date.now() - new Date(last.updated_at).getTime() : Infinity;
  const workerStale = ageMs > 3 * 60_000;

  const r = resumo.data ?? { total: 0, sent: 0, delivered: 0, read: 0, failed: 0, responded: 0, sim: 0, nao: 0 };
  const deliveryPct = r.sent > 0 ? Math.round((r.delivered / r.sent) * 100) : 0;
  const readPct = r.delivered > 0 ? Math.round((r.read / r.delivered) * 100) : 0;
  const failPct = r.sent > 0 ? Math.round((r.failed / r.sent) * 100) : 0;
  const deliveryAlert = r.sent >= 20 && deliveryPct < 70;

  const q = quality.data;
  const rating: QualityRating = q?.quality_rating ?? "UNKNOWN";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Saúde do motor
          </CardTitle>
          <QualityBadge rating={rating} size="lg" />
        </div>
        {q?.display_phone_number && (
          <p className="text-[11px] text-muted-foreground mt-1">
            {q.verified_name} · {q.display_phone_number} · Tier {q.messaging_limit_tier || "—"}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Worker heartbeat */}
        <div className="rounded-lg border p-3 bg-muted/30">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium">
              {hb.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : workerStale ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              ) : workerOk ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Signal className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              Worker · {workerStale ? "sem sinal" : status}
            </div>
            <span className="text-[11px] text-muted-foreground">
              Último tick: {last?.updated_at ? formatBRT(last.updated_at, "dd/MM HH:mm:ss") : "—"}
            </span>
          </div>
          {last?.last_reason && (
            <p className="text-[11px] text-muted-foreground mt-1">Motivo: {last.last_reason}</p>
          )}
          {last?.last_error && (
            <p className="text-[11px] text-rose-700 mt-1">Erro: {last.last_error}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>Último batch: {last?.last_batch_size ?? 0}</span>
            <span>Enviados: {last?.last_sent ?? 0}</span>
          </div>
        </div>

        {/* Delivery funnel */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Entrega hoje</span>
            {deliveryAlert && (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <XCircle className="h-3 w-3" /> Entrega &lt; 70%
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <FunnelStat label="Enviadas" value={r.sent} />
            <FunnelStat label="Entregues" value={r.delivered} pct={deliveryPct} tone={deliveryAlert ? "warn" : "ok"} />
            <FunnelStat label="Lidas" value={r.read} pct={readPct} />
            <FunnelStat label="Respostas" value={r.responded} extra={`${r.sim} SIM · ${r.nao} NÃO`} />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground"><span>Entrega</span><span>{deliveryPct}%</span></div>
            <Progress value={deliveryPct} className="h-1.5" />
            {failPct > 0 && (
              <>
                <div className="flex justify-between text-[11px] text-rose-700"><span>Falhas</span><span>{r.failed} ({failPct}%)</span></div>
                <Progress value={failPct} className="h-1.5" />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStat({ label, value, pct, extra, tone }: { label: string; value: number; pct?: number; extra?: string; tone?: "ok" | "warn" }) {
  return (
    <div className={cn("rounded-md border px-2 py-2", tone === "warn" ? "bg-amber-50 border-amber-200" : "bg-card")}>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {pct !== undefined && <div className="text-[10px] text-muted-foreground mt-0.5">{pct}%</div>}
      {extra && <div className="text-[10px] text-muted-foreground mt-0.5">{extra}</div>}
    </div>
  );
}
