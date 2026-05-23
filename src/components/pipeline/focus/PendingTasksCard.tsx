import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListChecks, Check } from "lucide-react";
import { todayBRT } from "@/lib/brtTime";

interface Task {
  id: string;
  titulo: string;
  tipo: string | null;
  vence_em: string | null;
  hora_vencimento: string | null;
}

interface Props {
  tasks: Task[];
  /** R5 Item 5 — quando true, exibe skeleton no lugar da lista (refetch ao trocar de lead). */
  loading?: boolean;
  onComplete: (taskId: string, titulo: string) => void;
  onCreateNew: () => void;
}

export default function PendingTasksCard({ tasks, loading, onComplete, onCreateNew }: Props) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-indigo-300 text-xs font-semibold">
            Tarefas pendentes {loading ? "" : `(${tasks.length})`}
          </span>
        </div>
        <button
          onClick={onCreateNew}
          className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30"
        >
          + Nova
        </button>
      </div>
      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg animate-pulse"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-gray-500 text-xs italic">Nenhuma tarefa pendente</p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {tasks.map((t) => {
            const today = todayBRT();
            const isOverdue = !!t.vence_em && t.vence_em < today;
            const isToday = t.vence_em === today;
            return (
              <div
                key={t.id}
                className="flex items-center gap-2 p-2 rounded-lg"
                style={{
                  background: isOverdue ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isOverdue ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 truncate">{t.titulo}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isOverdue ? (
                      <Badge className="text-[9px] border-0 px-1.5 py-0" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}>
                        ⏰ Atrasada · {t.vence_em}{t.hora_vencimento ? ` ${t.hora_vencimento.slice(0, 5)}` : ""}
                      </Badge>
                    ) : (
                      <Badge
                        className="text-[9px] border-0 px-1.5 py-0"
                        style={{
                          background: isToday ? "rgba(245,158,11,0.2)" : "rgba(148,163,184,0.15)",
                          color: isToday ? "#fbbf24" : "#94a3b8",
                        }}
                      >
                        {isToday ? "Hoje" : t.vence_em}{t.hora_vencimento ? ` ${t.hora_vencimento.slice(0, 5)}` : ""}
                      </Badge>
                    )}
                    {t.tipo && <span className="text-[9px] text-gray-500">{t.tipo}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onComplete(t.id, t.titulo)}
                  className="h-7 px-2 text-[10px] gap-1 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10"
                >
                  <Check className="w-3 h-3" /> Concluir
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
