/**
 * CarteiraKpis — "Saúde da carteira" por CONTATO real (Nova Gestão).
 * % em dia + distribuição (Em dia / Atenção / Desatualizado). Clicks vão pro
 * Pipeline já filtrado pela saúde.
 */
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useCarteiraSaude } from "@/hooks/useCarteiraSaude";
import { logDashboard } from "@/lib/dashboardTelemetry";
import { useNavigate } from "react-router-dom";

const BIG =
  "p-3 sm:p-4 [&>p:nth-child(2)]:text-2xl sm:[&>p:nth-child(2)]:text-3xl [&>p:nth-child(2)]:font-black [&>p:nth-child(1)]:text-xs [&>p:nth-child(1)]:normal-case [&>p:nth-child(1)]:tracking-normal";

export default function CarteiraKpis() {
  const { data, isLoading } = useCarteiraSaude();
  const navigate = useNavigate();
  const s = data ?? { pct_em_dia: 0, em_dia: 0, atencao: 0, desatualizado: 0, estagnado: 0, total: 0, ativos: 0 };

  const goPipeline = (filtro: string, kpi: string) => {
    logDashboard("dashboard_kpi_click", { kpi, destination: "pipeline" });
    navigate(`/pipeline-leads?filtro=${filtro}`);
  };

  const val = (n: number) =>
    isLoading ? ((<Skeleton className="h-7 w-12 sm:h-8" />) as unknown as string) : n;

  return (
    <section className="space-y-2">
      <h2 className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Saúde da carteira
        {!isLoading && (
          <span className="rounded-full bg-success-500/12 px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal text-success-700 dark:text-success-500">
            {s.pct_em_dia}% em dia
          </span>
        )}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Em dia"
          value={val(s.em_dia)}
          tone="success"
          onClick={() => goPipeline("em_dia", "em_dia")}
          className={BIG}
        />
        <StatCard
          label="Atenção"
          value={val(s.atencao)}
          tone="warning"
          accent={s.atencao > 0}
          onClick={() => goPipeline("sem_tarefa", "atencao")}
          className={BIG}
        />
        <StatCard
          label="Desatualizado"
          value={val(s.desatualizado)}
          tone="danger"
          accent={s.desatualizado > 0}
          onClick={() => goPipeline("atrasado", "desatualizado")}
          className={BIG}
        />
      </div>
    </section>
  );
}
