import { TrendingUp, CalendarCheck, Briefcase, TrendingDown, Minus } from "lucide-react";
import { SecondaryMetricCard } from "@/components/gerente/dashboard-v3/SecondaryMetricCard";
import { V4VendasHeroCard } from "./V4VendasHeroCard";
import type { KpisTopV4 } from "@/hooks/useDashboardGerenteV4Kpis";
import { cn } from "@/lib/utils";

interface Props {
  kpis: KpisTopV4 | undefined;
  isLoading: boolean;
}

function CardSkeleton() {
  return <div className="h-[164px] rounded-2xl border border-border bg-card animate-pulse" />;
}

/** Card customizado de visitas: "X realizadas" + "Y agendadas · meta Z". */
function VisitasCard({ kpis }: { kpis: KpisTopV4 }) {
  const delta = kpis.visitas_delta_pct;
  const DeltaIcon = delta == null ? Minus : delta >= 0 ? TrendingUp : TrendingDown;
  const deltaColor =
    delta == null ? "text-muted-foreground" : delta >= 0 ? "text-success-700" : "text-danger-700";
  const meta = kpis.visitas_meta || 0;
  const pct = meta > 0 ? Math.min(100, (kpis.visitas_realizadas / meta) * 100) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-700">
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", deltaColor)}>
          <DeltaIcon className="h-3.5 w-3.5" />
          {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">Visitas · Este mês</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {kpis.visitas_realizadas.toLocaleString("pt-BR")}
        </span>
        <span className="text-xs text-muted-foreground">realizadas</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {kpis.visitas_agendadas.toLocaleString("pt-BR")} agendadas
        {meta > 0 && <> · meta {meta.toLocaleString("pt-BR")}</>}
      </p>

      {pct != null && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-warning-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function V4KpisGrid({ kpis, isLoading }: Props) {
  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 dash-v4-kpis">
        {isLoading || !kpis ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <SecondaryMetricCard
              label="Leads recebidos · Este mês"
              value={kpis.leads_recebidos}
              meta={kpis.leads_meta}
              delta={kpis.leads_delta_pct}
              icon={TrendingUp}
              tone="primary"
            />
            <VisitasCard kpis={kpis} />
            <SecondaryMetricCard
              label="Negócios ativos"
              value={kpis.negocios_ativos}
              meta={kpis.negocios_meta}
              delta={null}
              icon={Briefcase}
              tone="success"
            />
            <V4VendasHeroCard
              vgv={Number(kpis.vendas_vgv) || 0}
              count={kpis.vendas_count}
              meta={Number(kpis.vendas_meta_vgv) || 0}
              deltaPct={kpis.vendas_delta_pct}
            />
          </>
        )}
      </div>

      <style>{`
        @media (min-width: 1100px) {
          .dash-v4-kpis {
            grid-template-columns: 1fr 1fr 1fr 1.3fr;
          }
        }
      `}</style>
    </>
  );
}
