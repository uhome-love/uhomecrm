import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ClipboardList, AlertTriangle, CalendarX } from "lucide-react";
import type { PipelineLead } from "@/hooks/usePipeline";
import { differenceInHours, isBefore, startOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Props {
  leads: PipelineLead[];
  corretorNomes: Record<string, string>;
}

export default function PipelineManagerActions({ leads, corretorNomes }: Props) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const today = startOfDay(new Date());

  // 1. Leads sem tarefa (no data_proxima_acao AND no recent activity)
  const leadsSemTarefa = useMemo(() => {
    return leads.filter(l => {
      if (!l.corretor_id) return false;
      const proxAcao = (l as any).data_proxima_acao;
      if (proxAcao) return false; // has task → skip
      const hoursInSystem = differenceInHours(new Date(), new Date(l.created_at));
      return hoursInSystem >= 2; // ignore brand new leads
    });
  }, [leads]);

  // 2. Leads com tarefa atrasada (data_proxima_acao < today)
  const leadsTarefaAtrasada = useMemo(() => {
    return leads.filter(l => {
      if (!l.corretor_id) return false;
      const proxAcao = (l as any).data_proxima_acao;
      if (!proxAcao) return false;
      return isBefore(new Date(proxAcao), today);
    });
  }, [leads, today]);

  // 3. Visitas atrasadas (data_visita < today and not completed)
  const visitasAtrasadas = useMemo(() => {
    return leads.filter(l => {
      if (!l.corretor_id) return false;
      const dataVisita = (l as any).data_visita;
      if (!dataVisita) return false;
      return isBefore(new Date(dataVisita), today);
    });
  }, [leads, today]);

  const totalAlerts = leadsSemTarefa.length + leadsTarefaAtrasada.length + visitasAtrasadas.length;

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
    {
      icon: CalendarX,
      label: "Visitas atrasadas",
      count: visitasAtrasadas.length,
      color: "text-orange-600",
      bg: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
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
        <div className="px-3 pb-3 grid grid-cols-3 gap-2">
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
