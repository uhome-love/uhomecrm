/**
 * CarteiraKpis — Bloco "Estado da carteira" (4 KPIs régua).
 * Clicks abrem FocusModeModal com critério ou /pipeline-leads (Em dia).
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useCorretorKpisCarteira } from "@/hooks/useCorretorKpisCarteira";
import { logDashboard } from "@/lib/dashboardTelemetry";
import FocusModeModal from "@/components/pipeline/FocusModeModal";
import { useNavigate } from "react-router-dom";

type Criterio = "today" | "overdue_tasks" | "no_next_step";

export default function CarteiraKpis() {
  const { data, isLoading } = useCorretorKpisCarteira();
  const navigate = useNavigate();
  const [focusCriteria, setFocusCriteria] = useState<Criterio | null>(null);

  const buckets = data ?? { sem_tarefa: 0, atrasado: 0, para_hoje: 0, em_dia: 0, total: 0 };

  const openFoco = (kpi: string, criterio: Criterio) => {
    logDashboard("dashboard_kpi_click", { kpi });
    setFocusCriteria(criterio);
  };

  const openPipeline = () => {
    logDashboard("dashboard_kpi_click", { kpi: "em_dia" });
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
          onClick={() => openFoco("para_hoje", "today")}
          loading={isLoading}
        />
        <KpiBox
          value={buckets.atrasado}
          label="Atrasados"
          borderColor="#DC2626"
          onClick={() => openFoco("atrasados", "overdue_tasks")}
          loading={isLoading}
        />
        <KpiBoxAmber
          value={buckets.sem_tarefa}
          label="Sem tarefa"
          ativo={semTarefaAtivo}
          onClick={() => openFoco("sem_tarefa", "no_next_step")}
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

      <FocusModeModal
        open={focusCriteria !== null}
        onClose={() => setFocusCriteria(null)}
        pipelineTipo="leads"
        initialCriteria={focusCriteria ? [focusCriteria] : ["all"]}
      />
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
  // Quando ativo (>0): border 2px âmbar + bg sutil. Padding ajustado para evitar shift.
  const baseClass = "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary";
  const ativoStyle = ativo
    ? { border: "2px solid #F59E0B", backgroundColor: "rgba(245,158,11,0.04)" }
    : { border: "1px solid rgba(245,158,11,0.2)", backgroundColor: "rgba(245,158,11,0.02)" };
  // Compensar 1px de diferença na padding para não dar shift
  const padding = ativo ? "p-3 sm:p-4" : "px-[13px] py-[13px] sm:px-[17px] sm:py-[17px]";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={baseClass}
      style={ativoStyle}
    >
      <div className={padding}>
        <div className={`text-2xl sm:text-3xl font-black leading-none ${ativo ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>
          {loading ? "—" : value}
        </div>
        <div className={`text-xs font-medium mt-1.5 ${ativo ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{label}</div>
      </div>
    </Card>
  );
}
