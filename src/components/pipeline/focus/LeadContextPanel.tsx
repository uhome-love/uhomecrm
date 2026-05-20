import { ReactNode } from "react";
import LeadHeader from "./LeadHeader";
import HomiInsightCard from "./HomiInsightCard";
import PendingTasksCard from "./PendingTasksCard";
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
  homiLoading: boolean;
  homiInsight: string;
  pendingTasks: Task[];
  onCompleteTask: (taskId: string, titulo: string) => void;
  onCreateNewTask: () => void;
  /** Slot para os tabs/ações (Follow-up, Ligar, Tarefa, Avançar, Descartar). */
  children?: ReactNode;
}

export default function LeadContextPanel({
  lead, homiLoading, homiInsight, pendingTasks,
  onCompleteTask, onCreateNewTask, children,
}: Props) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 space-y-4 h-full overflow-y-auto"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <LeadHeader lead={lead} onAlertClick={onCompleteTask} />
      <HomiInsightCard loading={homiLoading} insight={homiInsight} />
      <PendingTasksCard tasks={pendingTasks} onComplete={onCompleteTask} onCreateNew={onCreateNewTask} />
      {children}
    </div>
  );
}
