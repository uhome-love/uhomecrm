/**
 * CarteiraKpis — Bloco "Estado da carteira" (4 KPIs régua).
 * Clicks navegam para Central de Tarefas (via ?tab=) ou Pipeline (Em dia).
 */
import { Card } from "@/components/ui/card";
import { useCorretorKpisCarteira } from "@/hooks/useCorretorKpisCarteira";
import { logDashboard } from "@/lib/dashboardTelemetry";
import { useNavigate } from "react-router-dom";

type Tab = "hoje" | "atrasadas" | "desatualizados";

export default function CarteiraKpis() {
  const { data, isLoading } = useCorretorKpisCarteira();
  const navigate = useNavigate();

  const buckets = data ?? { sem_tarefa: 0, atrasado: 0, para_hoje: 0, em_dia: 0, total: 0 };

  const openCentral = (kpi: string, tab: Tab) => {
    logDashboard("dashboard_kpi_click", { kpi, destination: "central_tarefas", tab });
    navigate(`/minhas-tarefas?tab=${tab}`);
  };

  const openPipeline = () => {
    logDashboard("dashboard_kpi_click", { kpi: "em_dia", destination: "pipeline" });
    navigate("/pipeline-leads");
  };

  const semTarefaAtivo = buckets.sem_tarefa > 0;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado da carteira</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiBox
          value={buckets.para_hoje}
          label="Para hoje"
          borderColor="#4F46E5"
          onClick={() => openCentral("para_hoje", "hoje")}
          loading={isLoading}
        />
        <KpiBox
          value={buckets.atrasado}
          label="Atrasados"
          borderColor="#DC2626"
          onClick={() => openCentral("atrasados", "atrasadas")}
          loading={isLoading}
        />
        <KpiBoxAmber
          value={buckets.sem_tarefa}
          label="Sem tarefa"
          ativo={semTarefaAtivo}
          onClick={() => openCentral("sem_tarefa", "desatualizados")}
          loading={isLoading}
        />
        <KpiBox
          value={buckets.em_dia}
          label="Em dia"
          borderColor="#22c55e"
          onClick={openPipeline}
          loading={isLoading}
        />
      </div>
    </section>
  );
}

interface KpiBoxProps {
  value: number;
  label: string;
  borderColor: string;
  onClick: () => void;
  loading?: boolean;
}

function KpiBox({ value, label, borderColor, onClick, loading }: KpiBoxProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary"
      style={{ borderTop: `3px solid ${borderColor}` }}
    >
      <div className="p-3 sm:p-4">
        <div className="text-2xl sm:text-3xl font-black text-foreground leading-none">
          {loading ? "—" : value}
        </div>
        <div className="text-xs font-medium text-muted-foreground mt-1.5">{label}</div>
      </div>
    </Card>
  );
}

function KpiBoxAmber({ value, label, ativo, onClick, loading }: { value: number; label: string; ativo: boolean; onClick: () => void; loading?: boolean }) {
  // Régua de cores preservada: borda âmbar visível em ambos estados.
  // Ativo (>0): border 2px + bg sutil. Vazio (=0): border 1px + sem bg.
  // borderTop 3px nos dois para igualar visualmente aos irmãos.
  const style = ativo
    ? {
        border: "2px solid #F59E0B",
        borderTop: "3px solid #F59E0B",
        backgroundColor: "rgba(245,158,11,0.04)",
      }
    : {
        border: "1px solid #F59E0B",
        borderTop: "3px solid #F59E0B",
        backgroundColor: "transparent",
      };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary"
      style={style}
    >
      <div className="p-3 sm:p-4">
        <div className={`text-2xl sm:text-3xl font-black leading-none ${ativo ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>
          {loading ? "—" : value}
        </div>
        <div className={`text-xs font-medium mt-1.5 ${ativo ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{label}</div>
      </div>
    </Card>
  );
}
