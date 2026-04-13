import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Plus, X } from "lucide-react";
import { format, addDays } from "date-fns";
import { dateToBRT } from "@/lib/utils";

const TIPO_BUTTONS = [
  { value: "ligar", label: "Ligar", emoji: "📞" },
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "follow_up", label: "Follow-up", emoji: "📋" },
  { value: "enviar_proposta", label: "Proposta", emoji: "📄" },
  { value: "marcar_visita", label: "Visita", emoji: "🏠" },
];

interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefaTitulo: string;
  leadNome?: string;
  onConfirm: (obs: string, novaTarefa?: { tipo: string; vence_em: string; hora_vencimento: string; obs: string }) => void;
}

export default function TaskCompletionDialog({ open, onOpenChange, tarefaTitulo, leadNome, onConfirm }: TaskCompletionDialogProps) {
  const [obs, setObs] = useState("");
  const [criarNova, setCriarNova] = useState(false);
  const [novoTipo, setNovoTipo] = useState("follow_up");
  const [novoData, setNovoData] = useState(dateToBRT(addDays(new Date(), 1)));
  const [novoHora, setNovoHora] = useState("10:00");
  const [novoObs, setNovoObs] = useState("");

  const reset = () => {
    setObs("");
    setCriarNova(false);
    setNovoTipo("follow_up");
    setNovoData(dateToBRT(addDays(new Date(), 1)));
    setNovoHora("10:00");
    setNovoObs("");
  };

  const handleConcluirSemNova = () => {
    onConfirm(obs);
    reset();
  };

  const handleConcluirComNova = () => {
    onConfirm(obs, {
      tipo: novoTipo,
      vence_em: novoData,
      hora_vencimento: novoHora,
      obs: novoObs,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-[420px] p-5 gap-3">
        <DialogHeader className="p-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Tarefa Concluída
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {tarefaTitulo}{leadNome ? ` • ${leadNome}` : ""}
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              📝 Observação (opcional)
            </label>
            <Textarea
              placeholder="O que aconteceu? Ex: Cliente atendeu, vai pensar..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              className="min-h-[60px] text-sm resize-none"
              rows={2}
            />
          </div>

          {!criarNova ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs gap-1.5"
                onClick={() => setCriarNova(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Criar próxima tarefa
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 text-xs gap-1.5"
                onClick={handleConcluirSemNova}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
              </Button>
            </div>
          ) : (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-primary">📋 Nova tarefa</p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCriarNova(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {TIPO_BUTTONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setNovoTipo(t.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      novoTipo === t.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Data</label>
                  <Input type="date" value={novoData} onChange={(e) => setNovoData(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Horário</label>
                  <Input type="time" value={novoHora} onChange={(e) => setNovoHora(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              <Textarea
                placeholder="Observação da próxima tarefa..."
                value={novoObs}
                onChange={(e) => setNovoObs(e.target.value)}
                className="min-h-[40px] text-xs resize-none"
                rows={2}
              />

              <Button
                size="sm"
                className="w-full h-9 text-xs gap-1.5"
                onClick={handleConcluirComNova}
                disabled={!novoData}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Concluir e Criar Tarefa
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
