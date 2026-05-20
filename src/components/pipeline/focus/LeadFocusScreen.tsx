import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Trophy } from "lucide-react";
import TimelineSection from "./TimelineSection";
import LeadContextPanel from "./LeadContextPanel";
import type { FocusLead } from "@/hooks/useFocusLeads";

interface Task {
  id: string;
  titulo: string;
  tipo: string | null;
  vence_em: string | null;
  hora_vencimento: string | null;
}

interface Props {
  lead: FocusLead;
  workedCount: number;
  homiLoading: boolean;
  homiInsight: string;
  pendingTasks: Task[];
  timelineRefreshKey?: number;
  onCompleteTask: (taskId: string, titulo: string) => void;
  onCompleteNextTask: () => void;
  onCreateNewTask: () => void;
  /** Slot do painel direito: tabs Follow-up/Ligar/Tarefa + ações Avançar/Descartar/Próximo. */
  panelChildren?: ReactNode;
}

export default function LeadFocusScreen({
  lead, workedCount, homiLoading, homiInsight, pendingTasks, timelineRefreshKey,
  onCompleteTask, onCompleteNextTask, onCreateNewTask, panelChildren,
}: Props) {
  const nextTask = lead.next_pending_task;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 max-w-[1400px] mx-auto w-full">
      {/* TOP CTA — sempre visível */}
      <div
        className="rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        style={{
          background: "linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.08))",
          border: "1px solid rgba(79,70,229,0.25)",
        }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            <Trophy className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <p className="text-xs text-gray-400 leading-tight">Trabalhados nesta sessão</p>
            <p className="text-lg font-bold text-white leading-tight" style={{ fontFamily: "var(--font-focus-display, inherit)" }}>
              {workedCount}
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 sm:px-3">
          {nextTask ? (
            <>
              <p className="text-[11px] uppercase tracking-wide text-indigo-300 font-semibold">Próxima ação</p>
              <p className="text-sm text-white truncate">{nextTask.titulo}</p>
            </>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wide text-amber-300 font-semibold">Sem tarefa pendente</p>
              <p className="text-sm text-gray-300">Registre uma atividade e agende a próxima.</p>
            </>
          )}
        </div>

        <Button
          onClick={nextTask ? onCompleteNextTask : onCreateNewTask}
          size="default"
          className="gap-2 shrink-0"
          style={{
            background: "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))",
            color: "#fff",
            border: 0,
          }}
        >
          <CheckCircle2 className="w-4 h-4" />
          {nextTask ? "Concluir tarefa e registrar" : "Criar próxima tarefa"}
        </Button>
      </div>

      {/* 70 / 30 GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-4 min-h-0">
        <div className="lg:col-span-7 min-h-[400px] lg:min-h-0">
          <TimelineSection leadId={lead.id} refreshKey={timelineRefreshKey} />
        </div>
        <div className="lg:col-span-3 min-h-0">
          <LeadContextPanel
            lead={lead}
            homiLoading={homiLoading}
            homiInsight={homiInsight}
            pendingTasks={pendingTasks}
            onCompleteTask={onCompleteTask}
            onCreateNewTask={onCreateNewTask}
          >
            {panelChildren}
          </LeadContextPanel>
        </div>
      </div>
    </div>
  );
}
