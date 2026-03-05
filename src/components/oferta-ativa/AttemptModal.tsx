import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PhoneOff, ThumbsDown, ThumbsUp, AlertCircle, PhoneMissed, Loader2, CalendarCheck, Timer } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: string, feedback: string, visitaMarcada?: boolean) => Promise<void> | void;
  leadName: string;
  callDuration?: number; // seconds
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function AttemptModal({ open, onClose, onSubmit, leadName, callDuration }: Props) {
  const [resultado, setResultado] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [visitaMarcada, setVisitaMarcada] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Keyboard shortcuts: 1-4 for results, Enter to submit
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
    } catch (err: any) {
      console.error("Erro no submit do modal:", err);
      toast.error("Erro ao registrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    // If user has started filling, confirm exit
    if (resultado || feedback.trim().length > 0) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const quickFeedbacks = resultado ? (QUICK_FEEDBACKS[resultado] || []) : [];

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base">Resultado da tentativa</DialogTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Lead: <strong>{leadName}</strong></span>
              {callDuration != null && callDuration > 0 && (
                <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/30 text-emerald-600">
                  <Timer className="h-3 w-3" /> {formatDuration(callDuration)}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
            {/* Result options */}
            <div className="grid grid-cols-4 gap-1.5">
              {RESULTS.map(r => {
                const Icon = r.icon;
                const selected = resultado === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => { setResultado(r.key); setFeedback(""); }}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all relative ${
                      selected ? `${r.color} ring-2 ring-offset-1 ring-current` : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium text-center leading-tight">{r.label}</span>
                    {r.key === "com_interesse" && <Badge className="text-[8px] bg-emerald-600 h-3.5 px-1">+3</Badge>}
                    {r.key === "nao_atendeu" && <Badge variant="outline" className="text-[8px] h-3.5 px-1">+1</Badge>}
                    {r.key === "sem_interesse" && <Badge variant="outline" className="text-[8px] h-3.5 px-1">+1</Badge>}
                  </button>
                );
              })}
            </div>

            {/* Marquei Visita */}
            {resultado === "com_interesse" && (
              <div
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                  visitaMarcada ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/30"
                }`}
                onClick={() => setVisitaMarcada(!visitaMarcada)}
              >
                <Checkbox checked={visitaMarcada} onCheckedChange={(v) => setVisitaMarcada(!!v)} className="h-4 w-4" />
                <CalendarCheck className={`h-3.5 w-3.5 ${visitaMarcada ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-foreground">Marquei visita</span>
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
              <Textarea
                placeholder='Ex: "Já comprou", "Quer 2D, orçamento 450k"'
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[10px] text-muted-foreground">Mín. 10 chars · Ctrl+Enter enviar</p>
                <p className={`text-[10px] ${feedback.trim().length >= 10 ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {feedback.trim().length}/10
                </p>
              </div>
            </div>

            {/* Contextual info - compact */}
            {resultado === "nao_atendeu" && (
              <p className="text-[10px] text-blue-600 bg-blue-500/10 rounded px-2 py-1">Lead volta para a fila após cooldown. +1 pt.</p>
            )}
            {resultado === "com_interesse" && (
              <p className="text-[10px] text-emerald-600 bg-emerald-500/10 rounded px-2 py-1">Lead vai para "Aproveitados". +3 pts! 🎉</p>
            )}
            {resultado === "numero_errado" && (
              <p className="text-[10px] text-red-600 bg-red-500/10 rounded px-2 py-1">Lead removido permanentemente. 0 pts.</p>
            )}
            {resultado === "sem_interesse" && (
              <p className="text-[10px] text-amber-600 bg-amber-500/10 rounded px-2 py-1">Lead removido da fila. +1 pt.</p>
            )}
          </div>

          {/* Submit button fixed at bottom */}
          <div className="shrink-0 pt-2 border-t">
            <Button
              id="attempt-submit-btn"
              className="w-full gap-2 h-10"
              disabled={!resultado || feedback.trim().length < 10 || submitting}
              onClick={handleSubmit}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Registrando..." : "Registrar e avançar ➜"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exit confirmation */}
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem registrar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você quer sair sem registrar o resultado? Isso pode gerar duplicidade na fila.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowExitConfirm(false)}>Voltar e registrar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowExitConfirm(false); onClose(); }} className="bg-destructive hover:bg-destructive/90">
              Sair sem registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
