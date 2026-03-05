import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneOff, ThumbsDown, ThumbsUp, AlertCircle, PhoneMissed, Loader2, CalendarCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: string, feedback: string, visitaMarcada?: boolean) => Promise<void> | void;
  leadName: string;
}

const RESULTS = [
  { key: "nao_atendeu", label: "Não atendeu", icon: PhoneMissed, color: "border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600" },
  { key: "numero_errado", label: "Número errado", icon: PhoneOff, color: "border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-600" },
  { key: "sem_interesse", label: "Sem interesse", icon: ThumbsDown, color: "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600" },
  { key: "com_interesse", label: "Com interesse", icon: ThumbsUp, color: "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600" },
];

export default function AttemptModal({ open, onClose, onSubmit, leadName }: Props) {
  const [resultado, setResultado] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [visitaMarcada, setVisitaMarcada] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!resultado || submitting) return;
    if (feedback.trim().length < 10) { toast.error("Feedback mínimo de 10 caracteres"); return; }
    setSubmitting(true);
    try {
      await onSubmit(resultado, feedback.trim(), resultado === "com_interesse" ? visitaMarcada : false);
      setResultado("");
      setFeedback("");
      setVisitaMarcada(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Resultado da tentativa</DialogTitle>
          <p className="text-sm text-muted-foreground">Lead: <strong>{leadName}</strong></p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Result options */}
          <div className="grid grid-cols-2 gap-2">
            {RESULTS.map(r => {
              const Icon = r.icon;
              const selected = resultado === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setResultado(r.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    selected ? `${r.color} ring-2 ring-offset-2 ring-current` : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium text-center">{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Marquei Visita — só aparece quando resultado é com_interesse */}
          {resultado === "com_interesse" && (
            <div
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                visitaMarcada
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30"
              }`}
              onClick={() => setVisitaMarcada(!visitaMarcada)}
            >
              <Checkbox
                checked={visitaMarcada}
                onCheckedChange={(v) => setVisitaMarcada(!!v)}
                className="h-5 w-5"
              />
              <div className="flex items-center gap-2">
                <CalendarCheck className={`h-4 w-4 ${visitaMarcada ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">Marquei visita</p>
                  <p className="text-[10px] text-muted-foreground">Será contabilizado nas visitas marcadas do checkpoint</p>
                </div>
              </div>
            </div>
          )}

          {/* Feedback */}
          <div>
            <label className="text-sm font-medium text-foreground">Feedback obrigatório</label>
            <Textarea
              className="mt-1.5"
              placeholder='Ex: "Já comprou", "Quer 2D, orçamento 450k", "Pediu contato mês que vem"'
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-muted-foreground">Mínimo 10 caracteres</p>
              <p className={`text-[10px] ${feedback.trim().length >= 10 ? "text-emerald-500" : "text-muted-foreground"}`}>
                {feedback.trim().length}/10
              </p>
            </div>
          </div>

          {resultado === "nao_atendeu" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700">
              <PhoneMissed className="h-4 w-4 shrink-0 mt-0.5" />
              <span>O lead <strong>voltará para a fila</strong> após o período de cooldown. Será tentado novamente até atingir o limite máximo.</span>
            </div>
          )}

          {resultado === "com_interesse" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700">
              <ThumbsUp className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Este lead será movido para <strong>"Aproveitados"</strong> e ficará com você para cadastro no Jetimob.</span>
            </div>
          )}

          {resultado === "numero_errado" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Este lead será <strong>removido permanentemente</strong> da fila e o telefone será bloqueado.</span>
            </div>
          )}

          {resultado === "sem_interesse" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700">
              <ThumbsDown className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Este lead será <strong>removido definitivamente</strong> da fila.</span>
            </div>
          )}

          <Button
            className="w-full gap-2"
            disabled={!resultado || feedback.trim().length < 10 || submitting}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Registrando..." : "Registrar e ir para próximo lead"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
