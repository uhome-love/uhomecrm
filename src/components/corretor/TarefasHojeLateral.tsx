/**
 * TarefasHojeLateral — Coluna lateral fixa 280px (desktop) com tarefas de hoje.
 * Em mobile (<1024px) vira accordion fechado por padrão.
 */
import { useState } from "react";
import { useTarefasHoje } from "@/hooks/useTarefasHoje";
import { useNavigate } from "react-router-dom";
import TarefaHojeItem from "@/components/corretor/TarefaHojeItem";
import { logDashboard } from "@/lib/dashboardTelemetry";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface Props {
  variant: "desktop" | "mobile";
}

export default function TarefasHojeLateral({ variant }: Props) {
  const { data: tarefas = [], isLoading } = useTarefasHoje();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleClick = (taskId: string, leadId: string) => {
    logDashboard("dashboard_task_click", { task_id: taskId, lead_id: leadId, action: "open_drawer" });
    navigate(`/pipeline-leads?lead=${leadId}`);
  };

  const toggleAccordion = () => {
    const next = !open;
    setOpen(next);
    logDashboard("dashboard_tasks_accordion_toggled", { opened: next });
  };

  const content = (
    <div className="space-y-2">
      {isLoading ? (
        <div className="text-xs text-muted-foreground p-3">Carregando...</div>
      ) : tarefas.length === 0 ? (
        <div className="text-center py-8 px-3">
          <Sparkles className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
          <div className="text-sm font-semibold text-foreground">Você está em dia</div>
          <div className="text-xs text-muted-foreground mt-1">Nenhuma tarefa pendente para hoje</div>
          <button
            type="button"
            onClick={() => {
              logDashboard("dashboard_task_click", { action: "ver_proximas", tab: "semana" });
              navigate("/minhas-tarefas?tab=semana");
            }}
            className="mt-4 text-[11px] text-indigo-500 hover:text-indigo-600 hover:underline"
          >
            Ver próximas tarefas →
          </button>
        </div>
      ) : (
        tarefas.map((t) => (
          <TarefaHojeItem key={t.id} tarefa={t} onClick={() => handleClick(t.id, t.lead_id)} />
        ))
      )}
    </div>
  );

  if (variant === "desktop") {
    return (
      <aside className="rounded-xl border border-border bg-card/50 p-3 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <span>📋</span> Hoje
          </h3>
          <span className="text-[10px] font-bold bg-muted text-muted-foreground rounded-full px-2 py-0.5 tabular-nums">
            {tarefas.length}
          </span>
        </div>
        {content}
      </aside>
    );
  }

  // mobile accordion
  return (
    <section className="rounded-xl border border-border bg-card/50">
      <button
        type="button"
        onClick={toggleAccordion}
        className="w-full flex items-center justify-between p-3"
      >
        <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <span>📋</span> Hoje · {tarefas.length} tarefa{tarefas.length === 1 ? "" : "s"}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-3 pb-3">{content}</div>}
    </section>
  );
}
