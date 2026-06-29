import type { UseQueryResult } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Banknote, MapPin, PenLine, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { Sparkline } from "@/components/central-v2/shared/Sparkline";
import { fmtMoney } from "@/lib/fmtMoney";

interface Props {
  vendas: UseQueryResult<Record<string, unknown>>;
  visitas: UseQueryResult<Record<string, unknown>>;
}

function vgvSpark(data: Record<string, unknown> | undefined): number[] {
  const porDia = safeGet<Record<string, { vgv?: number }>>(data ?? {}, "extras.por_dia", "Exec por_dia");
  if (!porDia || typeof porDia !== "object") return [];
  return Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => Number(v?.vgv ?? 0));
}

/**
 * Hero do resumo executivo: 4 KPIs principais do período em destaque,
 * com delta vs. período anterior e sparkline de VGV.
 */
export function ExecutiveSummary({ vendas, visitas }: Props) {
  const vLoading = vendas.isLoading && !vendas.data;
  const visLoading = visitas.isLoading && !visitas.data;

  const vgv = safeGet<number>(vendas.data ?? {}, "vendas.vgv", "Exec VGV");
  const vgvFmt = vgv != null ? fmtMoney(vgv, "shortWithTooltip") : null;
  const vgvDelta = safeGet<number>(vendas.data ?? {}, "vendas.delta_pct", "Exec vendas.delta_pct");
  const ticket = safeGet<number>(vendas.data ?? {}, "vendas.ticket_medio", "Exec ticket");
  const assinados = safeGet<number>(vendas.data ?? {}, "vendas.count", "Exec vendas.count");
  const realizadas = safeGet<number>(visitas.data ?? {}, "visitas.realizadas", "Exec visitas.realizadas");
  const visDelta = safeGet<number>(visitas.data ?? {}, "visitas.delta_pct", "Exec visitas.delta_pct");

  const spark = vgvSpark(vendas.data);

  return (
    <div className="central-hero p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="VGV do período"
          icon={Banknote}
          loading={vLoading}
          error={!!vendas.error}
          value={vgvFmt?.display}
          title={vgvFmt?.title}
          delta={vgvDelta}
          big
        >
          {spark.length >= 2 ? <Sparkline data={spark} /> : null}
        </Stat>
        <Stat
          label="Visitas realizadas"
          icon={MapPin}
          loading={visLoading}
          error={!!visitas.error}
          value={realizadas != null ? Math.round(realizadas).toLocaleString("pt-BR") : undefined}
          delta={visDelta}
        />
        <Stat
          label="Negócios assinados"
          icon={PenLine}
          loading={vLoading}
          error={!!vendas.error}
          value={assinados != null ? Math.round(assinados).toLocaleString("pt-BR") : undefined}
        />
        <Stat
          label="Ticket médio"
          icon={Receipt}
          loading={vLoading}
          error={!!vendas.error}
          value={ticket != null ? fmtMoney(ticket, "short") : undefined}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  title,
  icon: Icon,
  delta,
  loading,
  error,
  big,
  children,
}: {
  label: string;
  value?: string;
  title?: string;
  icon: LucideIcon;
  delta?: number | null;
  loading?: boolean;
  error?: boolean;
  big?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col" title={title}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-9 w-32" />
      ) : (
        <div className="mt-1.5 flex items-baseline gap-2">
          <span
            className={cn(
              "font-display leading-none text-foreground",
              big ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
            )}
          >
            {error ? "—" : (value ?? "—")}
          </span>
          {typeof delta === "number" && Number.isFinite(delta) ? <Delta delta={delta} /> : null}
        </div>
      )}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function Delta({ delta }: { delta: number }) {
  const up = delta >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        up ? "bg-success/10 text-success" : "bg-danger-500/10 text-danger-500"
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}
