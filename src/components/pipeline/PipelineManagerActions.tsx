import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ClipboardList, AlertTriangle } from "lucide-react";
import type { PipelineLead } from "@/hooks/usePipeline";
import { differenceInHours } from "date-fns";
import { getLeadStatusFilter, type ProximaTarefa } from "@/lib/taskQueryUtils";
import { useNavigate } from "react-router-dom";

interface Props {
  leads: PipelineLead[];
  corretorNomes: Record<string, string>;
  tarefasMap: Record<string, ProximaTarefa>;
  stageTypeById: Record<string, string>;
}

export default function PipelineManagerActions({ leads, corretorNomes, tarefasMap, stageTypeById }: Props) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  // 1. Leads sem tarefa pendente real
  const leadsSemTarefa = useMemo(() => {
    return leads.filter(l => {
      if (!l.corretor_id) return false;
      const status = getLeadStatusFilter(l, tarefasMap[l.id] || null, stageTypeById[l.stage_id]);
      if (status !== "desatualizado") return false;
      const hoursInSystem = differenceInHours(new Date(), new Date(l.created_at));
      return hoursInSystem >= 2;
    });
  }, [leads, tarefasMap, stageTypeById]);

  // 2. Leads com tarefa atrasada real
  const leadsTarefaAtrasada = useMemo(() => {
    return leads.filter(l => {
      if (!l.corretor_id) return false;
      return getLeadStatusFilter(l, tarefasMap[l.id] || null, stageTypeById[l.stage_id]) === "tarefa_atrasada";
    });
  }, [leads, tarefasMap, stageTypeById]);

  const totalAlerts = leadsSemTarefa.length + leadsTarefaAtrasada.length;

  const alerts = [
    {
      icon: ClipboardList,
      label: "Leads sem tarefa",
      count: leadsSemTarefa.length,
      color: "text-amber-600",
      bg: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
    },
    {
      icon: AlertTriangle,
      label: "Tarefas atrasadas",
      count: leadsTarefaAtrasada.length,
      color: "text-red-500",
      bg: "bg-red-500/10",
      borderColor: "border-red-500/30",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center justify-between w-full px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          🔔 Alertas Gerente
          {totalAlerts > 0 && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1.5">{totalAlerts}</Badge>
          )}
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          {alerts.map(a => (
            <div
              key={a.label}
              className={`flex flex-col items-center gap-1.5 rounded-xl border ${a.borderColor} ${a.bg} py-3 px-2 transition-all`}
            >
              <div className="flex items-center gap-1.5">
                <a.icon className={`h-4 w-4 ${a.color}`} />
                <span className={`text-lg font-bold ${a.color}`}>{a.count}</span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">{a.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
