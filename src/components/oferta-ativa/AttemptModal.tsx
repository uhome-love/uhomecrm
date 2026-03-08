import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarCheck, Timer } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: string, feedback: string, visitaMarcada?: boolean, interesseTipo?: string) => Promise<void> | void;
  leadName: string;
  callDuration?: number; // seconds
}

const RESULTS = [
  { key: "nao_atendeu", label: "Não atendeu", emoji: "📵", hoverBorder: "hover:border-orange-500/60", selectedBorder: "border-orange-500 bg-orange-500/20", shortcut: "1" },
  { key: "numero_errado", label: "Número errado", emoji: "❌", hoverBorder: "hover:border-red-500/60", selectedBorder: "border-red-500 bg-red-500/20", shortcut: "2" },
  { key: "sem_interesse", label: "Sem interesse", emoji: "😐", hoverBorder: "hover:border-yellow-500/60", selectedBorder: "border-yellow-500 bg-yellow-500/20", shortcut: "3" },
  { key: "com_interesse", label: "Com interesse", emoji: "✅", hoverBorder: "hover:border-green-500/60", selectedBorder: "border-green-500 bg-green-500/20", shortcut: "4" },
];

const INTERESSE_SUB_OPTIONS = [
  { key: "pediu_informacoes", label: "Pediu informações", emoji: "📋", desc: "→ Pipeline: Contato Inicial" },
  { key: "demonstrou_interesse", label: "Demonstrou interesse", emoji: "🔥", desc: "→ Pipeline: Atendimento" },
  { key: "quer_visitar", label: "Quer visitar", emoji: "🏠", desc: "→ Pipeline: Possibilidade de Visita" },
  { key: "visita_marcada", label: "Visita marcada", emoji: "📅", desc: "→ Pipeline: Visita Marcada" },
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
  const [interesseTipo, setInteresseTipo] = useState<string>("");
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
    if (resultado === "com_interesse" && !interesseTipo) { toast.error("Selecione o tipo de interesse"); return; }
    setSubmitting(true);
    try {
      const isVisita = interesseTipo === "visita_marcada" || visitaMarcada;
      await onSubmit(resultado, feedback.trim(), isVisita, resultado === "com_interesse" ? interesseTipo : undefined);
      setResultado("");
      setFeedback("");
      setVisitaMarcada(false);
      setInteresseTipo("");
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden" style={{ background: "#1C2128", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20 }}>
          <DialogHeader className="shrink-0">
            <DialogTitle style={{ fontSize: 20, fontWeight: 700, color: "white" }}>Resultado da tentativa</DialogTitle>
            <div className="flex items-center gap-3" style={{ fontSize: 14, color: "#94A3B8" }}>
              <span>Lead: <strong>{leadName}</strong></span>
              {callDuration != null && callDuration > 0 && (
                <Badge variant="outline" className="gap-1 border-emerald-500/30" style={{ fontSize: 12, color: "#94A3B8" }}>
                  <Timer className="h-3 w-3" /> {formatDuration(callDuration)}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
            {/* Result options */}
            <div className="grid grid-cols-4 gap-2">
              {RESULTS.map(r => {
                const selected = resultado === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => { setResultado(r.key); setFeedback(""); }}
                    className={`flex flex-col items-center gap-2 transition-all ${
                      selected ? r.selectedBorder : `border-[rgba(255,255,255,0.15)] ${r.hoverBorder}`
                    }`}
                    style={{ background: "#1C2128", border: selected ? undefined : "1px solid rgba(255,255,255,0.15)", borderWidth: selected ? 2 : 1, borderStyle: "solid", borderRadius: 12, padding: "16px 12px" }}
                  >
                    <span style={{ fontSize: 28 }}>{r.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#E2E8F0", textAlign: "center", lineHeight: 1.3 }}>{r.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Interest sub-type selection */}
            {resultado === "com_interesse" && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo de interesse (obrigatório)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {INTERESSE_SUB_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setInteresseTipo(opt.key);
                        if (opt.key === "visita_marcada") setVisitaMarcada(true);
                      }}
                      className={`flex flex-col items-start gap-0.5 p-2 rounded-lg border-2 transition-all text-left ${
                        interesseTipo === opt.key
                          ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                          : "border-border hover:border-emerald-500/20"
                      }`}
                    >
                      <span className="text-xs font-medium">{opt.emoji} {opt.label}</span>
                      <span className="text-[9px] text-muted-foreground">{opt.desc}</span>
                    </button>
                  ))}
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
              <Textarea
                placeholder='Ex: "Já comprou", "Quer 2D, orçamento 450k"'
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                rows={2}
                style={{ background: "#0A0F1E", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "white", fontSize: 15, padding: 12 }}
                className="placeholder:text-[#64748B] focus-visible:ring-blue-500/40 focus-visible:border-blue-500"
              />
              <div className="flex items-center justify-between mt-1">
                <p style={{ fontSize: 10, color: "#64748B" }}>Mín. 10 chars · Ctrl+Enter enviar</p>
                <p style={{ fontSize: 10, color: feedback.trim().length >= 10 ? "#10B981" : "#64748B" }}>
                  {feedback.trim().length}/10
                </p>
              </div>
            </div>

            {/* Contextual info - compact */}
            {resultado === "nao_atendeu" && (
              <p className="text-[10px] text-blue-600 bg-blue-500/10 rounded px-2 py-1">Lead volta para a fila após cooldown. +1 pt.</p>
            )}
            {resultado === "com_interesse" && interesseTipo && (
              <p className="text-[10px] text-emerald-600 bg-emerald-500/10 rounded px-2 py-1">
                ✅ Lead vai direto para o Pipeline ({INTERESSE_SUB_OPTIONS.find(o => o.key === interesseTipo)?.desc}). +3 pts! 🎉
              </p>
            )}
            {resultado === "numero_errado" && (
              <p className="text-[10px] text-red-600 bg-red-500/10 rounded px-2 py-1">Lead removido permanentemente. 0 pts.</p>
            )}
            {resultado === "sem_interesse" && (
              <p className="text-[10px] text-amber-600 bg-amber-500/10 rounded px-2 py-1">Lead removido da fila. +1 pt.</p>
            )}
          </div>

          {/* Submit button fixed at bottom */}
          <div className="shrink-0 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              id="attempt-submit-btn"
              className="w-full gap-2 flex items-center justify-center"
              disabled={!resultado || feedback.trim().length < 10 || submitting || (resultado === "com_interesse" && !interesseTipo)}
              onClick={handleSubmit}
              style={{
                height: 52,
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 12,
                color: "white",
                ...((!resultado || feedback.trim().length < 10 || submitting || (resultado === "com_interesse" && !interesseTipo))
                  ? { background: "#374151", color: "#6B7280", boxShadow: "none", cursor: "not-allowed" }
                  : { background: "#22C55E", boxShadow: "0 0 20px rgba(34,197,94,0.3)" })
              }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {submitting ? "Registrando..." : "Registrar e avançar ➜"}
            </button>
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
