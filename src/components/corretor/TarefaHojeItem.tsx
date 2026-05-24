/**
 * TarefaHojeItem — Item individual da lista lateral "📋 Hoje".
 */
import { Phone, MessageCircle, Home, Calendar, ListChecks } from "lucide-react";
import type { TarefaHoje } from "@/hooks/useTarefasHoje";
import { formatBRT } from "@/lib/brtTime";

interface Props {
  tarefa: TarefaHoje;
  onClick: () => void;
}

function iconForTipo(tipo: string | null) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("ligacao") || t.includes("ligação") || t.includes("call") || t.includes("telefone")) return { Icon: Phone, color: "bg-emerald-100 text-emerald-700" };
  if (t.includes("whats")) return { Icon: MessageCircle, color: "bg-green-100 text-green-700" };
  if (t.includes("visita")) return { Icon: Home, color: "bg-indigo-100 text-indigo-700" };
  if (t.includes("reuni") || t.includes("meeting")) return { Icon: Calendar, color: "bg-blue-100 text-blue-700" };
  return { Icon: ListChecks, color: "bg-slate-100 text-slate-700" };
}

export default function TarefaHojeItem({ tarefa, onClick }: Props) {
  const { Icon, color } = iconForTipo(tarefa.tipo);
  const meta = [tarefa.empreendimento, tarefa.stage_nome].filter(Boolean).join(" · ");
  const hora = formatBRT(tarefa.vence_em, "HH:mm");

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all p-2.5 flex gap-2.5 items-start"
    >
      <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">
          {tarefa.titulo || `Tarefa · ${tarefa.lead_nome}`}
        </div>
        {tarefa.titulo && (
          <div className="text-[11px] text-muted-foreground truncate">{tarefa.lead_nome}</div>
        )}
        {meta && (
          <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">{meta}</div>
        )}
      </div>
      <div className="shrink-0 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{hora}</div>
    </button>
  );
}
