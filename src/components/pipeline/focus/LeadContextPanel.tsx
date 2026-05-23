import { ReactNode } from "react";
import LeadHeader from "./LeadHeader";
import HomiInsightCard from "./HomiInsightCard";
import PendingTasksCard from "./PendingTasksCard";
import ScriptsCard from "./ScriptsCard";
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
  homiInsight: string | null;
  onGenerateInsight: () => void;
  onRegenerateInsight: () => void;
  pendingTasks: Task[];
  /** R5 Item 5 — loading dos pending tasks (fetch dispara ao trocar de lead). */
  pendingTasksLoading?: boolean;
  onCompleteTask: (taskId: string, titulo: string) => void;
  onCreateNewTask: () => void;
  /** Slot para ações finais (Descartar, etc). */
  children?: ReactNode;
}

export default function LeadContextPanel({
  lead, homiLoading, homiInsight, onGenerateInsight, onRegenerateInsight,
  pendingTasks, pendingTasksLoading, onCompleteTask, onCreateNewTask, children,
}: Props) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 space-y-4 h-full overflow-y-auto"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <LeadHeader lead={lead} onAlertClick={onCompleteTask} />
      <HomiInsightCard
        loading={homiLoading}
        insight={homiInsight}
        onGenerate={onGenerateInsight}
        onRegenerate={onRegenerateInsight}
      />
      <PendingTasksCard tasks={pendingTasks} loading={pendingTasksLoading} onComplete={onCompleteTask} onCreateNew={onCreateNewTask} />
      <ScriptsCard
        leadName={lead.name}
        leadEmpreendimento={lead.interest ?? undefined}
        leadStage={lead.stage}
      />
      {children}
    </div>
  );
}
