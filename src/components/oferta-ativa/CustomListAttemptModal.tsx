import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Timer } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: string, feedback: string, visitaMarcada?: boolean, interesseTipo?: string) => Promise<void> | void;
  leadName: string;
  callDuration?: number;
}

const RESULTS = [
  { key: "atendeu", label: "Atendeu", emoji: "📞", hoverBorder: "hover:border-green-500/60", selectedBorder: "border-green-500 bg-green-500/20" },
  { key: "nao_atendeu", label: "Não atendeu", emoji: "📵", hoverBorder: "hover:border-orange-500/60", selectedBorder: "border-orange-500 bg-orange-500/20" },
  { key: "sem_interesse", label: "Sem interesse", emoji: "🚫", hoverBorder: "hover:border-rose-500/60", selectedBorder: "border-rose-500 bg-rose-500/20" },
  { key: "descarte_oa", label: "Enviar p/ Oferta Ativa", emoji: "📤", hoverBorder: "hover:border-red-500/60", selectedBorder: "border-red-500 bg-red-500/20" },
];

const ATENDEU_SUB = [
  { key: "marcou_visita", label: "Marcou visita", emoji: "📅", desc: "→ Visita Marcada" },
  { key: "follow_up", label: "Follow-up agendado", emoji: "🔄", desc: "→ Tarefa criada" },
  { key: "proposta", label: "Pediu proposta", emoji: "📊", desc: "→ Negociação" },
  { key: "conversa_geral", label: "Conversa geral", emoji: "💬", desc: "→ Registrar no histórico" },
];

const SEM_INTERESSE_SUB = [
  { key: "nao_quer_produto", label: "Não quer o produto", emoji: "🏠", desc: "→ Sem interesse no imóvel" },
  { key: "ja_comprou", label: "Já comprou outro", emoji: "✅", desc: "→ Já adquiriu imóvel" },
  { key: "sem_condicao", label: "Sem condição financeira", emoji: "💰", desc: "→ Fora do orçamento" },
  { key: "nao_momento", label: "Não é o momento", emoji: "⏳", desc: "→ Pode retomar futuramente" },
];

const QUICK_FEEDBACKS: Record<string, string[]> = {
  atendeu: [
    "Atendeu, demonstrou interesse no empreendimento",
    "Atendeu, quer receber material por WhatsApp",
    "Atendeu, pediu para ligar outro dia",
    "Atendeu, quer agendar visita no fim de semana",
  ],
  nao_atendeu: [
    "Chamou e caiu na caixa postal",
    "Chamou mas não atendeu, tentarei novamente",
    "Telefone chamou, desligou sem atender",
  ],
  sem_interesse: [
    "Atendeu mas não tem interesse no produto oferecido",
    "Disse que já comprou outro imóvel recentemente",
    "Sem condições financeiras no momento",
    "Não é o momento, talvez no futuro",
    "Não gostou da localização/região",
  ],
  descarte_oa: [
    "Lead sem interesse, enviar para lista de oferta ativa",
    "Número errado, enviar para recontato via OA",
    "Pediu para não ligar mais",
  ],
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CustomListAttemptModal({ open, onClose, onSubmit, leadName, callDuration }: Props) {
  const [resultado, setResultado] = useState("");
  const [subOption, setSubOption] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setResultado("");
      setSubOption("");
      setFeedback("");
      setSubmitting(false);
    }
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLTextAreaElement) {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        document.getElementById("custom-attempt-submit-btn")?.click();
      }
      return;
    }
  }, []);

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const canSubmit = resultado && feedback.trim().length >= 10 && (resultado !== "atendeu" || subOption) && (resultado !== "sem_interesse" || subOption);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const isVisita = subOption === "marcou_visita";
      await onSubmit(resultado, feedback.trim(), isVisita, resultado === "atendeu" ? subOption : undefined);
      setResultado("");
      setSubOption("");
      setFeedback("");
    } catch {
      toast.error("Erro ao registrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
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
            <DialogTitle style={{ fontSize: 20, fontWeight: 700, color: "white" }}>Resultado da ligação</DialogTitle>
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
            {/* Main result options */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RESULTS.map(r => {
                const selected = resultado === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => { setResultado(r.key); setSubOption(""); setFeedback(QUICK_FEEDBACKS[r.key]?.[0] || ""); }}
                    className={`flex flex-col items-center gap-2 transition-all ${
                      selected ? r.selectedBorder : `border-[rgba(255,255,255,0.15)] ${r.hoverBorder}`
                    }`}
                    style={{ background: "#1C2128", border: selected ? undefined : "1px solid rgba(255,255,255,0.15)", borderWidth: selected ? 2 : 1, borderStyle: "solid", borderRadius: 12, padding: "14px 8px" }}
                  >
                    <span style={{ fontSize: 24 }}>{r.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#E2E8F0", textAlign: "center", lineHeight: 1.3 }}>{r.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-options for "Atendeu" */}
            {resultado === "atendeu" && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">O que aconteceu? (obrigatório)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ATENDEU_SUB.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setSubOption(opt.key)}
                      className={`flex flex-col items-start gap-0.5 p-2.5 rounded-lg border-2 transition-all text-left ${
                        subOption === opt.key
                          ? "border-emerald-500/60 bg-emerald-500/15 ring-1 ring-emerald-500/30"
                          : "border-[rgba(255,255,255,0.2)] bg-[#1C2128] hover:border-emerald-500/30 hover:bg-[#232a34]"
                      }`}
                    >
                      <span className="text-sm font-medium text-[#E2E8F0]">{opt.emoji} {opt.label}</span>
                      <span className="text-[10px] text-[#94A3B8]">{opt.desc}</span>
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

            {/* Feedback textarea */}
            <div>
              <Textarea
                placeholder='Descreva o resultado da ligação...'
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

            {/* Contextual info */}
            {resultado === "atendeu" && subOption && (
              <p className="text-[10px] text-emerald-600 bg-emerald-500/10 rounded px-2 py-1">
                ✅ Resultado registrado no histórico do lead no Pipeline. {subOption === "marcou_visita" ? "+Visita agendada!" : ""}
              </p>
            )}
            {resultado === "nao_atendeu" && (
              <p className="text-[10px] text-blue-600 bg-blue-500/10 rounded px-2 py-1">
                📝 Registrado no histórico do lead no Pipeline.
              </p>
            )}
            {resultado === "sem_interesse" && (
              <p className="text-[10px] text-rose-600 bg-rose-500/10 rounded px-2 py-1">
                🚫 Lead marcado como sem interesse na oferta. Registrado no histórico do Pipeline.
                {subOption === "nao_momento" ? " Poderá ser recontactado futuramente." : ""}
              </p>
            )}
            {resultado === "descarte_oa" && (
              <p className="text-[10px] text-red-600 bg-red-500/10 rounded px-2 py-1">
                📤 Lead será enviado para a lista de Oferta Ativa para recontato.
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="shrink-0 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              id="custom-attempt-submit-btn"
              className="w-full gap-2 flex items-center justify-center"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
              style={{
                height: 52,
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 12,
                color: "white",
                ...(!canSubmit || submitting
                  ? { background: "#374151", color: "#6B7280", cursor: "not-allowed" }
                  : { background: "#22C55E", boxShadow: "0 0 20px rgba(34,197,94,0.3)" })
              }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {submitting ? "Registrando..." : "Registrar e avançar ➜"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem registrar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você quer sair sem registrar o resultado?
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
