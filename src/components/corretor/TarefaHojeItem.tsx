/**
 * TarefaHojeItem — Item individual da lista lateral "📋 Hoje".
 * Fase 2 Motor de Próxima Ação: ações inline (Concluir + Adiar) com limite de 2 adiamentos.
 */
import { Phone, MessageCircle, Home, Calendar, ListChecks, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import type { TarefaHoje } from "@/hooks/useTarefasHoje";
import { formatBRT } from "@/lib/brtTime";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  tarefa: TarefaHoje;
  onClick: () => void;
  onConcluir: () => void;
  onAdiar: () => void;
}

function iconForTipo(tipo: string | null) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("ligacao") || t.includes("ligação") || t.includes("call") || t.includes("telefone")) return { Icon: Phone, color: "bg-emerald-100 text-emerald-700" };
  if (t.includes("whats")) return { Icon: MessageCircle, color: "bg-green-100 text-green-700" };
  if (t.includes("visita")) return { Icon: Home, color: "bg-indigo-100 text-indigo-700" };
  if (t.includes("reuni") || t.includes("meeting")) return { Icon: Calendar, color: "bg-blue-100 text-blue-700" };
  return { Icon: ListChecks, color: "bg-slate-100 text-slate-700" };
}

export default function TarefaHojeItem({ tarefa, onClick, onConcluir, onAdiar }: Props) {
  const { Icon, color } = iconForTipo(tarefa.tipo);
  const meta = [tarefa.empreendimento, tarefa.stage_nome].filter(Boolean).join(" · ");
  const hora = formatBRT(tarefa.vence_em, "HH:mm");
  const adiamentos = tarefa.adiamentos_count ?? 0;
  const bateuLimite = adiamentos >= 2;

  const stop = (e: React.MouseEvent) => { e.stopPropagation(); };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className="w-full text-left rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all p-2.5 cursor-pointer"
    >
      <div className="flex gap-2.5 items-start">
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
      </div>

      {/* Ações inline */}
      <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border/50" onClick={stop}>
        <button
          type="button"
          onClick={(e) => { stop(e); onConcluir(); }}
          className="flex items-center gap-1 h-6 px-1.5 rounded text-[10px] font-medium text-success-700 hover:bg-success-500/10 transition-colors"
        >
          <CheckCircle2 className="h-3 w-3" /> Concluir
        </button>
        {bateuLimite ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 h-6 px-1.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive cursor-help">
                <AlertTriangle className="h-3 w-3" /> Adiado 2x — resolver
              </span>
            </TooltipTrigger>
            <TooltipContent>Esta tarefa já foi adiada 2 vezes. Use Concluir para resolver o lead.</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={(e) => { stop(e); onAdiar(); }}
            title={adiamentos === 1 ? "Último adiamento disponível" : "Adiar tarefa"}
            className="flex items-center gap-1 h-6 px-1.5 rounded text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Clock className="h-3 w-3" /> Adiar{adiamentos === 1 ? " (último)" : ""}
          </button>
        )}
      </div>
    </div>
  );
}
