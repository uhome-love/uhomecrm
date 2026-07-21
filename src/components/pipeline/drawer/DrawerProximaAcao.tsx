import { parseDateBRTSafe } from "@/lib/utils";
import { formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ListChecks, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NextTaskLike {
  id?: string;
  tipo?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  vence_em?: string | null;
}

interface Props {
  nextTask: NextTaskLike | null;
  /** texto livre opcional (lead.proxima_acao) usado como fallback */
  proximaAcaoTexto?: string | null;
  /** total de tarefas pendentes do lead — se >1 exibe aviso */
  pendingCount?: number;
  /** Concluir a próxima tarefa (abre popup na aba Tarefas) */
  onComplete?: (taskId: string) => void;
  /** Ver todas as tarefas (troca para aba Tarefas) */
  onSeeAll?: () => void;
  /** Criar nova tarefa (abre NextActionModal) — usado no estado vazio */
  onCreateTask?: () => void;
}

/** Detecta o tipo canônico (ligar/whatsapp/email/visita) a partir do tipo+titulo da tarefa. */
export function parseNextActionType(task: NextTaskLike | null, fallbackText?: string | null):
  "ligar" | "whatsapp" | "email" | "visita" | "followup" | null {
  const bag = `${task?.tipo ?? ""} ${task?.titulo ?? ""} ${task?.descricao ?? ""} ${fallbackText ?? ""}`.toLowerCase();
  if (!bag.trim()) return null;
  if (/\b(ligaca|liga[rç]|call|telefon)/.test(bag)) return "ligar";
  if (/\b(whats|zap|wpp)/.test(bag)) return "whatsapp";
  if (/\b(email|e-mail|mail)/.test(bag)) return "email";
  if (/\b(visita|tour|encontro|reuni)/.test(bag)) return "visita";
  if (/\b(follow|retorno)/.test(bag)) return "followup";
  return null;
}

const META: Record<NonNullable<ReturnType<typeof parseNextActionType>>, { icon: string; label: string }> = {
  ligar:    { icon: "📞", label: "Ligar" },
  whatsapp: { icon: "💬", label: "WhatsApp" },
  email:    { icon: "📨", label: "Enviar email" },
  visita:   { icon: "🏠", label: "Visita" },
  followup: { icon: "🔁", label: "Follow-up" },
};

/**
 * Caixa destacada "PRÓXIMA AÇÃO" com gradient indigo→roxo.
 * Estado vazio em cinza claro com CTA para criar tarefa.
 */
export default function DrawerProximaAcao({
  nextTask,
  proximaAcaoTexto,
  pendingCount,
  onComplete,
  onSeeAll,
  onCreateTask,
}: Props) {
  const multiplePending = (pendingCount ?? 0) > 1;

  // Estado vazio — sem próxima tarefa
  if (!nextTask) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Próxima ação
        </div>
        <div className="text-sm text-muted-foreground italic mb-2">
          Sem próxima ação definida
        </div>
        {onCreateTask && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={onCreateTask}
          >
            <Plus className="h-3.5 w-3.5" />
            Criar tarefa
          </Button>
        )}
      </div>
    );
  }

  const tipo = parseNextActionType(nextTask, proximaAcaoTexto);
  const meta = tipo ? META[tipo] : { icon: "✅", label: nextTask.titulo || nextTask.descricao || "Próxima ação" };

  const dueDate = parseDateBRTSafe(nextTask.vence_em ?? undefined);
  const now = new Date();
  const overdue = !!dueDate && dueDate.getTime() < now.getTime();
  const relativo = dueDate
    ? `${overdue ? "atrasado há" : "em"} ${formatDistance(dueDate, now, { locale: ptBR })}`
    : null;
  const absoluto = dueDate
    ? dueDate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className="rounded-lg border border-indigo-200/60 dark:border-indigo-900/50 px-4 py-3"
      style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05))" }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Próxima ação
          </span>
        </div>
        {multiplePending && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
            ⚠ {pendingCount} tarefas pendentes
          </span>
        )}
      </div>
      <div className="text-base font-semibold text-foreground">
        <span className="mr-1.5">{meta.icon}</span>{meta.label}
        {nextTask.titulo && tipo && (
          <span className="ml-2 font-normal text-sm text-muted-foreground truncate">— {nextTask.titulo}</span>
        )}
      </div>
      {(absoluto || relativo) && (
        <div className={`text-sm mt-1 ${overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
          {absoluto}{absoluto && relativo ? " · " : ""}{relativo}
        </div>
      )}

      {(onComplete || onSeeAll) && (
        <div className="flex items-center gap-2 mt-2.5">
          {onComplete && nextTask.id && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => onComplete(nextTask.id!)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Concluir agora
            </Button>
          )}
          {onSeeAll && multiplePending && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1.5"
              onClick={onSeeAll}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Ver todas ({pendingCount})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
