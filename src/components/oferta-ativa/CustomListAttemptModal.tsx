import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Timer, CalendarPlus, Phone, MessageCircle, Mail, ClipboardList, MapPin } from "lucide-react";
import { toast } from "sonner";

export interface ProximaAcao {
  tipo: string;
  titulo: string;
  venceEm: string;
  horaVencimento?: string;
  descricao?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: string, feedback: string, visitaMarcada?: boolean, interesseTipo?: string, proximaAcao?: ProximaAcao) => Promise<void> | void;
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

const ACAO_TIPOS = [
  { key: "ligar", label: "Ligar", emoji: "📞", icon: Phone },
  { key: "whatsapp", label: "WhatsApp", emoji: "💬", icon: MessageCircle },
  { key: "email", label: "E-mail", emoji: "✉️", icon: Mail },
  { key: "visita", label: "Visita", emoji: "🏠", icon: MapPin },
  { key: "outro", label: "Outro", emoji: "📋", icon: ClipboardList },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const QUICK_DATES = [
  { label: "Hoje", fn: todayISO },
  { label: "Amanhã", fn: tomorrowISO },
  { label: "+3 dias", fn: () => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); } },
  { label: "+7 dias", fn: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); } },
];

export default function CustomListAttemptModal({ open, onClose, onSubmit, leadName, callDuration }: Props) {
  const [resultado, setResultado] = useState("");
  const [subOption, setSubOption] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Próxima ação state
  const [criarAcao, setCriarAcao] = useState(false);
  const [acaoTipo, setAcaoTipo] = useState("ligar");
  const [acaoData, setAcaoData] = useState(tomorrowISO());
  const [acaoHora, setAcaoHora] = useState("10:00");
  const [acaoDesc, setAcaoDesc] = useState("");

  useEffect(() => {
    if (open) {
      setResultado("");
      setSubOption("");
      setFeedback("");
      setSubmitting(false);
      setCriarAcao(false);
      setAcaoTipo("ligar");
      setAcaoData(tomorrowISO());
      setAcaoHora("10:00");
      setAcaoDesc("");
    }
  }, [open]);

  // Auto-enable "criar ação" for nao_atendeu
  useEffect(() => {
    if (resultado === "nao_atendeu") {
      setCriarAcao(true);
      setAcaoTipo("ligar");
      setAcaoDesc("Retornar ligação — não atendeu");
    }
  }, [resultado]);

  // Auto-enable visit date/time when subOption=marcou_visita
  useEffect(() => {
    if (subOption === "marcou_visita") {
      setCriarAcao(true);
      setAcaoTipo("visita");
      setAcaoDesc(prev => prev || "Visita marcada com cliente");
    }
  }, [subOption]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
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
      const interesseTipo = resultado === "atendeu" ? subOption : resultado === "sem_interesse" ? subOption : undefined;

      const tipoLabels: Record<string, string> = { ligar: "Ligar", whatsapp: "WhatsApp", email: "E-mail", visita: "Visita", outro: "Ação" };
      const proximaAcao: ProximaAcao | undefined = criarAcao ? {
        tipo: acaoTipo,
        titulo: `${tipoLabels[acaoTipo] || "Ação"} — ${leadName}`,
        venceEm: acaoData,
        horaVencimento: acaoHora,
        descricao: acaoDesc || undefined,
      } : undefined;

      await onSubmit(resultado, feedback.trim(), isVisita, interesseTipo, proximaAcao);
      setResultado("");
      setSubOption("");
      setFeedback("");
      setCriarAcao(false);
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden" style={{ background: "var(--arena-card-bg)", border: "1px solid var(--arena-card-border)", borderRadius: 20 }}>
          <DialogHeader className="shrink-0">
            <DialogTitle style={{ fontSize: 20, fontWeight: 700, color: "var(--arena-text)" }}>Resultado da ligação</DialogTitle>
            <div className="flex items-center gap-3" style={{ fontSize: 14, color: "var(--arena-text-muted)" }}>
              <span>Lead: <strong>{leadName}</strong></span>
              {callDuration != null && callDuration > 0 && (
                <Badge variant="outline" className="gap-1 border-emerald-500/30" style={{ fontSize: 12, color: "var(--arena-text-muted)" }}>
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
                      selected ? r.selectedBorder : `border-[var(--arena-card-border)] ${r.hoverBorder}`
                    }`}
                    style={{ background: "var(--arena-card-bg)", border: selected ? undefined : "1px solid rgba(255,255,255,0.15)", borderWidth: selected ? 2 : 1, borderStyle: "solid", borderRadius: 12, padding: "14px 8px" }}
                  >
                    <span style={{ fontSize: 24 }}>{r.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--arena-text)", textAlign: "center", lineHeight: 1.3 }}>{r.label}</span>
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
                          : "border-[var(--arena-card-border)] bg-[var(--arena-card-bg)] hover:border-emerald-500/30 hover:bg-[var(--arena-subtle-bg)]"
                      }`}
                    >
                      <span className="text-sm font-medium text-[var(--arena-text)]">{opt.emoji} {opt.label}</span>
                      <span className="text-[10px] text-[var(--arena-text-muted)]">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-options for "Sem interesse" */}
            {resultado === "sem_interesse" && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Motivo (obrigatório)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SEM_INTERESSE_SUB.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setSubOption(opt.key)}
                      className={`flex flex-col items-start gap-0.5 p-2.5 rounded-lg border-2 transition-all text-left ${
                        subOption === opt.key
                          ? "border-rose-500/60 bg-rose-500/15 ring-1 ring-rose-500/30"
                          : "border-[var(--arena-card-border)] bg-[var(--arena-card-bg)] hover:border-rose-500/30 hover:bg-[var(--arena-subtle-bg)]"
                      }`}
                    >
                      <span className="text-sm font-medium text-[var(--arena-text)]">{opt.emoji} {opt.label}</span>
                      <span className="text-[10px] text-[var(--arena-text-muted)]">{opt.desc}</span>
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
                style={{ background: "var(--arena-bg-from)", border: "1px solid var(--arena-card-border)", borderRadius: 10, color: "var(--arena-text)", fontSize: 15, padding: 12 }}
                className="placeholder:text-neutral-500 focus-visible:ring-blue-500/40 focus-visible:border-blue-500"
              />
              <div className="flex items-center justify-between mt-1">
                <p style={{ fontSize: 10, color: "#64748B" }}>Mín. 10 chars · Ctrl+Enter enviar</p>
                <p style={{ fontSize: 10, color: feedback.trim().length >= 10 ? "#10B981" : "#64748B" }}>
                  {feedback.trim().length}/10
                </p>
              </div>
            </div>

            {/* ═══ CRIAR PRÓXIMA AÇÃO ═══ */}
            {resultado && resultado !== "descarte_oa" && (
              <div className="rounded-xl border border-[var(--arena-card-border)] overflow-hidden" style={{ background: "var(--arena-card-bg)" }}>
                <button
                  type="button"
                  onClick={() => setCriarAcao(!criarAcao)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CalendarPlus className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-semibold text-[var(--arena-text)]">Criar próxima ação</span>
                    {criarAcao && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 py-0">
                        Ativada
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={criarAcao}
                    onCheckedChange={setCriarAcao}
                    onClick={(e) => e.stopPropagation()}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </button>

                {criarAcao && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-[rgba(255,255,255,0.06)]">
                    {/* Tipo de ação */}
                    <div className="pt-2.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo da ação</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ACAO_TIPOS.map(t => (
                          <button
                            key={t.key}
                            onClick={() => setAcaoTipo(t.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              acaoTipo === t.key
                                ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                                : "border-[var(--arena-card-border)] text-[var(--arena-text-muted)] hover:border-amber-500/30 hover:bg-[rgba(255,255,255,0.03)]"
                            }`}
                          >
                            <span>{t.emoji}</span>
                            <span>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Data rápida */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Quando</p>
                      <div className="flex gap-1.5 mb-1.5">
                        {QUICK_DATES.map(qd => (
                          <button
                            key={qd.label}
                            onClick={() => setAcaoData(qd.fn())}
                            className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all ${
                              acaoData === qd.fn()
                                ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                                : "border-[var(--arena-card-border)] text-[var(--arena-text-muted)] hover:border-amber-500/30"
                            }`}
                          >
                            {qd.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={acaoData}
                          onChange={e => setAcaoData(e.target.value)}
                          className="flex-1 h-8 text-xs"
                          style={{ background: "var(--arena-bg-from)", border: "1px solid var(--arena-card-border)", color: "var(--arena-text)" }}
                        />
                        <Input
                          type="time"
                          value={acaoHora}
                          onChange={e => setAcaoHora(e.target.value)}
                          className="w-24 h-8 text-xs"
                          style={{ background: "var(--arena-bg-from)", border: "1px solid var(--arena-card-border)", color: "var(--arena-text)" }}
                        />
                      </div>
                    </div>

                    {/* Descrição opcional */}
                    <div>
                      <Input
                        placeholder="Observação da tarefa (opcional)"
                        value={acaoDesc}
                        onChange={e => setAcaoDesc(e.target.value)}
                        className="h-8 text-xs"
                        style={{ background: "var(--arena-bg-from)", border: "1px solid var(--arena-card-border)", color: "var(--arena-text)" }}
                      />
                    </div>

                    <p className="text-[10px] text-amber-500/70">
                      📌 Tarefa será criada automaticamente no Pipeline de Leads deste lead.
                    </p>
                  </div>
                )}
              </div>
            )}

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
                color: "var(--arena-text)",
                ...(!canSubmit || submitting
                  ? { background: "#374151", color: "#6B7280", cursor: "not-allowed" }
                  : { background: "#22C55E", boxShadow: "0 0 20px rgba(34,197,94,0.3)" })
              }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {submitting ? "Registrando..." : criarAcao ? "Registrar + criar ação ➜" : "Registrar e avançar ➜"}
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
