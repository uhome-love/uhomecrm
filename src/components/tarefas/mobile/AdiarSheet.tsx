import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { TarefaItem } from "@/hooks/useMinhasTarefas";

export const OPCOES_ADIAR = [
  { dias: 1, label: "Amanhã" },
  { dias: 2, label: "2 dias" },
  { dias: 7, label: "Próxima semana" },
];

interface Props {
  tarefa: TarefaItem | null;
  onClose: () => void;
  onEscolher: (t: TarefaItem, dias: number) => void;
}

export default function AdiarSheet({ tarefa, onClose, onEscolher }: Props) {
  return (
    <Dialog open={!!tarefa} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adiar tarefa</DialogTitle>
          <DialogDescription>{tarefa?.lead?.nome ?? "Anotação"} · {(tarefa?.titulo ?? "").split(" — ")[0]}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {OPCOES_ADIAR.map((o) => (
            <button key={o.dias} type="button" onClick={() => tarefa && onEscolher(tarefa, o.dias)}
              className="h-12 rounded-xl bg-muted text-base font-semibold text-foreground active:scale-[0.98]">
              {o.label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
