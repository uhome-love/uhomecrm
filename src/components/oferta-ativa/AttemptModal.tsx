import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PhoneOff, ThumbsDown, ThumbsUp, AlertCircle, PhoneMissed, Loader2, CalendarCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: string, feedback: string, visitaMarcada?: boolean) => Promise<void> | void;
  leadName: string;
}

const RESULTS = [
  { key: "nao_atendeu", label: "Não atendeu", icon: PhoneMissed, color: "border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600", shortcut: "1" },
  { key: "numero_errado", label: "Número errado", icon: PhoneOff, color: "border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-600", shortcut: "2" },
  { key: "sem_interesse", label: "Sem interesse", icon: ThumbsDown, color: "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600", shortcut: "3" },
  { key: "com_interesse", label: "Com interesse", icon: ThumbsUp, color: "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600", shortcut: "4" },
];

const QUICK_FEEDBACKS: Record<string, string[]> = {
  nao_atendeu: [
    "Chamou e caiu na caixa postal",
    "Chamou mas não atendeu, tentarei novamente",
    "Telefone chamou, desligou sem atender",
    "Caixa postal cheia, sem possibilidade de recado",
  ],
  numero_errado: [
    "Número não existe ou está desligado",
    "Pertence a outra pessoa que não conhece o lead",
    "Número de empresa/comercial, não é o lead",
  ],
  sem_interesse: [
    "Já comprou outro imóvel recentemente",
    "Fora da região, não tem interesse na localização",
    "Sem condições financeiras no momento",
    "Pediu para não ligar mais",
    "Disse que preencheu formulário por engano",
  ],
  com_interesse: [
    "Muito interessado, quer receber material completo",
    "Pediu simulação de valores e condições",
    "Quer visitar o decorado no fim de semana",
    "Já conhece a região, quer detalhes de planta e valores",
    "Interessado mas pediu para retornar em outro horário",
  ],
};

export default function AttemptModal({ open, onClose, onSubmit, leadName }: Props) {
  const [resultado, setResultado] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [visitaMarcada, setVisitaMarcada] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Keyboard shortcuts: 1-4 for results, Enter to submit
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't capture when typing in textarea
    if (e.target instanceof HTMLTextAreaElement) {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        document.getElementById("attempt-submit-btn")?.click();
      }
      return;
    }

    const resultMap: Record<string, string> = { "1": "nao_atendeu", "2": "numero_errado", "3": "sem_interesse", "4": "com_interesse" };
    if (resultMap[e.key]) {
      e.preventDefault();
      setResultado(resultMap[e.key]);
      setFeedback("");
    }
  }, []);

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

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

  const quickFeedbacks = resultado ? (QUICK_FEEDBACKS[resultado] || []) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Resultado da tentativa</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Lead: <strong>{leadName}</strong>
            <span className="ml-2 text-[10px] text-muted-foreground/70">(atalhos: 1-4 para resultado · Ctrl+Enter para enviar)</span>
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Result options with keyboard shortcuts */}
          <div className="grid grid-cols-2 gap-2">
            {RESULTS.map(r => {
              const Icon = r.icon;
              const selected = resultado === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => { setResultado(r.key); setFeedback(""); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all relative ${
                    selected ? `${r.color} ring-2 ring-offset-2 ring-current` : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <span className="absolute top-1.5 left-2 text-[9px] font-mono text-muted-foreground/50 bg-muted rounded px-1">{r.shortcut}</span>
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium text-center">{r.label}</span>
                  {r.key === "com_interesse" && (
                    <Badge className="text-[9px] bg-emerald-600 h-4">+3 pts</Badge>
                  )}
                  {r.key === "nao_atendeu" && (
                    <Badge variant="outline" className="text-[9px] h-4">+1 pt</Badge>
                  )}
                  {r.key === "sem_interesse" && (
                    <Badge variant="outline" className="text-[9px] h-4">+1 pt</Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Marquei Visita */}
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

          {/* Quick Feedback Chips */}
          {quickFeedbacks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Feedback rápido (clique para usar)</p>
              <div className="flex flex-wrap gap-1.5">
                {quickFeedbacks.map((qf) => (
                  <button
                    key={qf}
                    onClick={() => setFeedback(qf)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-all ${
                      feedback === qf
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:border-primary/30 hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {qf}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          <div>
            <label className="text-sm font-medium text-foreground">Feedback {feedback.length < 10 ? "(obrigatório)" : ""}</label>
            <Textarea
              className="mt-1.5"
              placeholder='Ex: "Já comprou", "Quer 2D, orçamento 450k", "Pediu contato mês que vem"'
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={2}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-muted-foreground">Mínimo 10 caracteres · Ctrl+Enter para enviar</p>
              <p className={`text-[10px] ${feedback.trim().length >= 10 ? "text-emerald-500" : "text-muted-foreground"}`}>
                {feedback.trim().length}/10
              </p>
            </div>
          </div>

          {/* Contextual info */}
          {resultado === "nao_atendeu" && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700">
              <PhoneMissed className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Lead <strong>volta para a fila</strong> após cooldown. +1 pt.</span>
            </div>
          )}

          {resultado === "com_interesse" && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700">
              <ThumbsUp className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Lead vai para <strong>"Aproveitados"</strong> com você. <strong>+3 pts!</strong> 🎉</span>
            </div>
          )}

          {resultado === "numero_errado" && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Lead <strong>removido permanentemente</strong>. 0 pts.</span>
            </div>
          )}

          {resultado === "sem_interesse" && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700">
              <ThumbsDown className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Lead <strong>removido da fila</strong>. +1 pt.</span>
            </div>
          )}

          <Button
            id="attempt-submit-btn"
            className="w-full gap-2 h-11"
            disabled={!resultado || feedback.trim().length < 10 || submitting}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Registrando..." : "Registrar e avançar ➜"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
