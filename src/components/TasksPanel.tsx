import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Clock, Phone, MessageSquare, Mail, Gift, Archive, ChevronDown, ChevronUp, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LeadTask } from "@/lib/taskGenerator";

interface TasksPanelProps {
  tasks: LeadTask[];
  onTaskStatusChange: (taskId: string, status: LeadTask["status"]) => void;
}

import { PRIORITY_CONFIG } from "@/lib/leadUtils";

const TASK_ICONS: Record<string, typeof Phone> = {
  "Ligar AGORA": Phone,
  "Enviar follow-up hoje": MessageSquare,
  "Incluir em campanha": Mail,
  "Reativar com oferta": Gift,
  "Última tentativa": Archive,
};

type FilterTab = "pendente" | "em_andamento" | "concluida" | "todas";

export default function TasksPanel({ tasks, onTaskStatusChange }: TasksPanelProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("pendente");
  const [expanded, setExpanded] = useState(true);

  const filteredTasks = useMemo(() => {
    if (activeTab === "todas") return tasks;
    return tasks.filter((t) => t.status === activeTab);
  }, [tasks, activeTab]);

  const counts = useMemo(() => ({
    pendente: tasks.filter((t) => t.status === "pendente").length,
    em_andamento: tasks.filter((t) => t.status === "em_andamento").length,
    concluida: tasks.filter((t) => t.status === "concluida").length,
    todas: tasks.length,
  }), [tasks]);

  if (tasks.length === 0) return null;

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "pendente", label: `Pendentes (${counts.pendente})` },
    { key: "em_andamento", label: `Em andamento (${counts.em_andamento})` },
    { key: "concluida", label: `Concluídas (${counts.concluida})` },
    { key: "todas", label: `Todas (${counts.todas})` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <ListTodo className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-semibold text-foreground text-sm">
              Tarefas dos Corretores
            </h3>
            <p className="text-xs text-muted-foreground">
              {counts.pendente} pendentes • {counts.em_andamento} em andamento
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2 flex gap-1 flex-wrap">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="px-4 pb-4 space-y-2 max-h-96 overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma tarefa nesta categoria.
                </p>
              ) : (
                filteredTasks.map((task) => {
                  const Icon = TASK_ICONS[task.titulo] || Circle;
                  const pConfig = PRIORITY_CONFIG[task.prioridade];
                  const isDone = task.status === "concluida";

                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        isDone
                          ? "border-border/50 bg-muted/20 opacity-60"
                          : "border-border bg-background hover:bg-muted/20"
                      }`}
                    >
                      <button
                        onClick={() =>
                          onTaskStatusChange(
                            task.id,
                            isDone ? "pendente" : "concluida"
                          )
                        }
                        className="mt-0.5 shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-accent" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.titulo}
                          </span>
                          <Badge variant="outline" className={`text-[10px] ${pConfig.className}`}>
                            {pConfig.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-medium">{task.leadNome}</span>
                          {task.leadTelefone && ` • ${task.leadTelefone}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {task.descricao}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          Vence: {new Date(task.venceEm + "T12:00:00").toLocaleDateString("pt-BR")}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {!isDone && task.status === "pendente" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] px-2"
                            onClick={() => onTaskStatusChange(task.id, "em_andamento")}
                          >
                            Iniciar
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
