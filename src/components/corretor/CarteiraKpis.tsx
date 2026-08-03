/**
 * CarteiraKpis — Bloco "Estado da carteira" (4 KPIs régua).
 * Clicks navegam para Central de Tarefas (via ?tab=) ou Pipeline (Em dia).
 */
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useCorretorKpisCarteira } from "@/hooks/useCorretorKpisCarteira";
import { logDashboard } from "@/lib/dashboardTelemetry";
import { useNavigate } from "react-router-dom";

type Tab = "hoje" | "atrasadas" | "desatualizados";

// Preserva a prominência original dos números (text-2xl / sm:text-3xl)
// mantendo a casca canônica do StatCard.
const BIG =
  "p-3 sm:p-4 [&>p:nth-child(2)]:text-2xl sm:[&>p:nth-child(2)]:text-3xl [&>p:nth-child(2)]:font-black [&>p:nth-child(1)]:text-xs [&>p:nth-child(1)]:normal-case [&>p:nth-child(1)]:tracking-normal";

export default function CarteiraKpis() {
  const { data, isLoading } = useCorretorKpisCarteira();
  const navigate = useNavigate();

  const buckets = data ?? {
    tarefas_hoje: 0, tarefas_atrasadas: 0, leads_sem_tarefa: 0, leads_em_dia: 0, total_leads: 0,
    para_hoje: 0, atrasado: 0, sem_tarefa: 0, em_dia: 0, total: 0,
  };

  const openCentral = (kpi: string, tab: Tab) => {
    logDashboard("dashboard_kpi_click", { kpi, destination: "central_tarefas", tab });
    navigate(`/minhas-tarefas?tab=${tab}`);
  };

  const openPipeline = () => {
    logDashboard("dashboard_kpi_click", { kpi: "em_dia", destination: "pipeline" });
    navigate("/pipeline-leads");
  };

  const semTarefaAtivo = buckets.leads_sem_tarefa > 0;

  const val = (n: number) =>
    isLoading ? ((<Skeleton className="h-7 w-12 sm:h-8" />) as unknown as string) : n;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado da carteira</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          label="Para hoje"
          value={val(buckets.tarefas_hoje)}
          tone="primary"
          onClick={() => openCentral("para_hoje", "hoje")}
          className={BIG}
        />
        <StatCard
          label="Atrasadas"
          value={val(buckets.tarefas_atrasadas)}
          tone="danger"
          onClick={() => openCentral("atrasados", "atrasadas")}
          className={BIG}
        />
        <StatCard
          label="Leads sem tarefa"
          value={val(buckets.leads_sem_tarefa)}
          tone="warning"
          accent={semTarefaAtivo}
          active={semTarefaAtivo}
          onClick={() => openCentral("sem_tarefa", "desatualizados")}
          className={BIG}
        />
        <StatCard
          label="Em dia"
          value={val(buckets.leads_em_dia)}
          tone="success"
          onClick={openPipeline}
          className={BIG}
        />
      </div>
    </section>
  );
}
