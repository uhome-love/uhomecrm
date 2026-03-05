import { useState, useEffect, useRef, useCallback } from "react";
import { useOAFila, useOARegistrarTentativa, useOATemplates, type OALista, type OALead } from "@/hooks/useOfertaAtiva";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Phone, MessageCircle, Mail, Copy, User, Building2, Calendar, History, CheckCircle, Flame, Target, Lock, CalendarCheck, Zap, ChevronDown, Pencil, LogOut, Timer, SkipForward, Clock, Thermometer, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useCorretorDailyStats, useCorretorDailyGoals } from "@/hooks/useCorretorDailyStats";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import AttemptModal from "./AttemptModal";
import ScriptPanel from "./ScriptPanel";
import AttemptHistory from "./AttemptHistory";
import ScoringLegend from "./ScoringLegend";
import { motion, AnimatePresence } from "framer-motion";

/** Format Brazilian phone */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

/** Lead freshness based on data_lead age */
function getLeadFreshness(dataLead: string | null): { label: string; emoji: string; color: string; tip: string } {
  if (!dataLead) return { label: "Sem data", emoji: "❓", color: "text-muted-foreground", tip: "Data de entrada não informada" };
  const days = Math.floor((Date.now() - new Date(dataLead).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 3) return { label: "Quente", emoji: "🔥", color: "text-red-500", tip: `Lead de ${days === 0 ? "hoje" : `${days} dia(s)`} — alta chance de atendimento!` };
  if (days <= 14) return { label: "Morno", emoji: "☀️", color: "text-amber-500", tip: `Lead de ${days} dias — ainda é boa hora` };
  if (days <= 30) return { label: "Esfriando", emoji: "🌤️", color: "text-blue-400", tip: `Lead de ${days} dias — ser rápido e direto` };
  return { label: "Frio", emoji: "❄️", color: "text-blue-600", tip: `Lead de ${days} dias — abordagem diferenciada` };
}

/** Motivational messages based on progress */
function getMotivationalMessage(tentativas: number, aproveitados: number, streak: number, metaLig: number): string {
  if (streak >= 5) return "🔥 PEGOU FOGO! Sequência incrível!";
  if (streak >= 3) return "💪 Tá voando! Mantém o ritmo!";
  if (aproveitados > 0 && tentativas < 5) return "🎯 Já aproveitou lead! Bora continuar!";
  if (tentativas === 0) return "☕ Bora começar! O primeiro é o mais difícil.";
  if (tentativas <= 3) return "🚀 Aquecendo... as melhores ligações vêm agora!";
  if (tentativas <= 10) return "👊 Tá no ritmo! Segue firme!";
  if (tentativas >= metaLig) return "🏆 META BATIDA! Cada ligação agora é bônus!";
  if (tentativas >= metaLig * 0.8) return "⚡ Quase lá! Faltam poucas pra meta!";
  if (tentativas >= metaLig * 0.5) return "🎯 Metade da meta! Bora fechar!";
  return "📞 Cada ligação te aproxima do resultado!";
}

interface Props {
  lista: OALista;
  onBack: () => void;
}

export default function DialingModeWithScript({ lista, onBack }: Props) {
  const { fila, isLoading, lockLead, unlockLead, refetch } = useOAFila(lista.id);
  const { registrar } = useOARegistrarTentativa();
  const { templates } = useOATemplates(lista.empreendimento);
  const { stats } = useCorretorDailyStats();
  const { goals, saveGoals } = useCorretorDailyGoals();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionTaken, setActionTaken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [lockStatus, setLockStatus] = useState<"idle" | "locking" | "locked" | "failed">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [editingMetas, setEditingMetas] = useState(false);
  const [metaLig, setMetaLig] = useState("");
  const [metaAprov, setMetaAprov] = useState("");
  const [metaVis, setMetaVis] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [streak, setStreak] = useState(0);
  const [sessionStart] = useState(() => Date.now());
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showMilestone, setShowMilestone] = useState<string | null>(null);
  const currentLeadIdRef = useRef<string | null>(null);

  // Clamp currentIndex when fila changes — but NEVER during active call or modal
  useEffect(() => {
    // If call is active or modal is open, don't touch the index
    if (callActive || showModal || actionTaken) return;
    
    if (fila.length > 0 && currentIndex >= fila.length) {
      // Try to find the lead we were working on by ID
      if (currentLeadIdRef.current) {
        const idx = fila.findIndex(l => l.id === currentLeadIdRef.current);
        if (idx >= 0) {
          setCurrentIndex(idx);
          return;
        }
      }
      // Fallback: clamp to last valid index
      setCurrentIndex(fila.length - 1);
    }
  }, [fila, currentIndex, callActive, showModal, actionTaken]);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionSeconds(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  const formatSessionTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h${m.toString().padStart(2, "0")}min`;
    return `${m}min`;
  };

  // Call timer logic
  const startTimer = useCallback(() => {
    setCallTimer(0);
    setCallActive(true);
    timerRef.current = setInterval(() => setCallTimer(prev => prev + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    setCallActive(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Milestone check
  const checkMilestone = useCallback((totalAttempts: number) => {
    const milestones: Record<number, string> = {
      5: "🎯 5 ligações! Aqueceu!",
      10: "🔟 10 ligações! Tá on fire!",
      15: "💪 15! Você é uma máquina!",
      20: "🏆 20 ligações! Poucos chegam aqui!",
      25: "⭐ 25! Desempenho de elite!",
      30: "👑 30! Você é LENDA!",
      50: "🚀 50 LIGAÇÕES! HISTÓRICO!",
    };
    if (milestones[totalAttempts]) {
      setShowMilestone(milestones[totalAttempts]);
      setTimeout(() => setShowMilestone(null), 3000);
    }
  }, []);

  // Mini-break suggestion
  const shouldSuggestBreak = stats.tentativas > 0 && stats.tentativas % 15 === 0;

  const metaLigacoes = goals?.meta_ligacoes || 30;
  const metaAproveitados = goals?.meta_aproveitados || 5;
  const metaVisitas = goals?.meta_visitas_marcadas || 3;
  const progLig = Math.min(100, Math.round((stats.tentativas / metaLigacoes) * 100));
  const progAprov = Math.min(100, Math.round((stats.aproveitados / metaAproveitados) * 100));
  const progVisitas = Math.min(100, Math.round((stats.visitas_marcadas / metaVisitas) * 100));

  const lead = fila[currentIndex] ?? null;
  const nextLead = fila[currentIndex + 1] ?? null;

  // Track current lead ID for index recovery after refetch
  useEffect(() => {
    if (lead) currentLeadIdRef.current = lead.id;
  }, [lead?.id]);

  // Lock lead when active
  const prevLeadIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Don't re-lock or advance during active call/modal
    if (callActive || showModal) return;
    
    if (lead && lead.id !== prevLeadIdRef.current) {
      prevLeadIdRef.current = lead.id;
      setLockStatus("locking");
      lockLead(lead.id).then(result => {
        if (result.locked) {
          setLockStatus("locked");
        } else {
          setLockStatus("failed");
          if (result.reason === "locked_by_another") {
            toast.error("Lead em atendimento por outro corretor. Avançando...");
            setTimeout(() => {
              if (currentIndex < fila.length - 1) setCurrentIndex(prev => prev + 1);
            }, 1000);
          }
        }
      });
    }
    return () => {
      if (prevLeadIdRef.current && !callActive && !showModal) unlockLead(prevLeadIdRef.current);
    };
  }, [lead?.id, lockLead, unlockLead, callActive, showModal]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleAction = (canal: string) => {
    if (!lead) return;

    if (canal === "ligacao") {
      // 2-step flow: just start the timer, NO modal
      setActionTaken("ligacao");
      startTimer();
      return;
    }

    // For WhatsApp / Email: open external app then show modal
    setActionTaken(canal);

    if (canal === "whatsapp" && lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, "");
      const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
      const template = templates.find(t => t.canal === "whatsapp" && t.tipo === "primeiro_contato");
      const msg = template
        ? template.conteudo.replace("{nome}", lead.nome).replace("{empreendimento}", lead.empreendimento || "")
        : `Olá ${lead.nome}! Vi que você se interessou pelo ${lead.empreendimento || "nosso empreendimento"}. Podemos conversar?`;
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    } else if (canal === "email" && lead.email) {
      const subject = `${lead.empreendimento || "Oportunidade"} - Informações`;
      const body = `Olá ${lead.nome},\n\nGostaria de apresentar mais detalhes sobre o ${lead.empreendimento || "empreendimento"}.\n\nPodemos agendar uma conversa?`;
      window.open(`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
    }

    setTimeout(() => setShowModal(true), 500);
  };

  /** Called when user clicks "Finalizar Ligação" */
  const handleFinalizarLigacao = () => {
    stopTimer();
    setShowModal(true);
  };

  /** WhatsApp during active call — open without ending call */
  const handleWhatsAppDuringCall = () => {
    if (!lead?.telefone) return;
    const phone = lead.telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const template = templates.find(t => t.canal === "whatsapp" && t.tipo === "primeiro_contato");
    const msg = template
      ? template.conteudo.replace("{nome}", lead.nome).replace("{empreendimento}", lead.empreendimento || "")
      : `Olá ${lead.nome}! Vi que você se interessou pelo ${lead.empreendimento || "nosso empreendimento"}. Podemos conversar?`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleResultSubmit = async (resultado: string, feedback: string, visitaMarcada?: boolean) => {
    if (!lead || !actionTaken || submitting) return;
    setSubmitting(true);
    try {
      const result = await registrar(lead, actionTaken, resultado, feedback, lista);
      if (!result?.success) { setSubmitting(false); return; }

      // Update streak
      if (resultado === "com_interesse") {
        setStreak(prev => prev + 1);
        toast.success("🎉 APROVEITADO! +3 pontos! Mandou bem!", { duration: 4000 });
      } else if (resultado === "nao_atendeu") {
        setStreak(0);
        toast("📞 Não atendeu — lead volta à fila com cooldown", { duration: 2000 });
      } else if (resultado === "sem_interesse") {
        setStreak(0);
        toast("👋 Sem interesse — lead removido da fila", { duration: 2000 });
      } else if (resultado === "numero_errado") {
        toast("❌ Número errado — removido", { duration: 2000 });
      }

      checkMilestone(stats.tentativas + 1);

      // Se marcou visita, incrementar no checkpoint
      if (visitaMarcada && user) {
        try {
          const today = new Date().toISOString().split("T")[0];
          const { data: tm } = await supabase
            .from("team_members")
            .select("id, gerente_id")
            .eq("user_id", user.id)
            .eq("status", "ativo")
            .maybeSingle();

          if (tm) {
            let { data: cp } = await supabase
              .from("checkpoints")
              .select("id")
              .eq("gerente_id", tm.gerente_id)
              .eq("data", today)
              .maybeSingle();

            if (!cp) {
              const { data: newCp } = await supabase
                .from("checkpoints")
                .insert({ gerente_id: tm.gerente_id, data: today })
                .select("id")
                .single();
              cp = newCp;
            }

            if (cp) {
              const { data: line } = await supabase
                .from("checkpoint_lines")
                .select("id, real_visitas_marcadas")
                .eq("checkpoint_id", cp.id)
                .eq("corretor_id", tm.id)
                .maybeSingle();

              if (line) {
                await supabase
                  .from("checkpoint_lines")
                  .update({ real_visitas_marcadas: (line.real_visitas_marcadas || 0) + 1 })
                  .eq("id", line.id);
              } else {
                await supabase
                  .from("checkpoint_lines")
                  .insert({ checkpoint_id: cp.id, corretor_id: tm.id, real_visitas_marcadas: 1 } as any);
              }
            }
          }
          toast.success("📅 Visita marcada contabilizada no checkpoint!");
        } catch (err) {
          console.error("Erro ao atualizar visita no checkpoint:", err);
        }
      }

      stopTimer();
      setShowModal(false);
      setActionTaken(null);
      queryClient.invalidateQueries({ queryKey: ["corretor-daily-stats"] });
      queryClient.invalidateQueries({ queryKey: ["checkpoint"] });

      if (currentIndex < fila.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        refetch();
        setCurrentIndex(0);
      }
    } catch (err: any) {
      console.error("Erro ao registrar tentativa:", err);
      toast.error("Erro ao registrar tentativa. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-redirect when leads run out
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (!lead && !isLoading && fila.length === 0 && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      toast.info("📋 Leads desta lista acabaram! Escolha outra lista para continuar.", { duration: 5000 });
      const timer = setTimeout(() => onBack(), 3000);
      return () => clearTimeout(timer);
    }
  }, [lead, isLoading, fila.length, onBack]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!lead) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <p className="font-bold text-lg text-foreground">Fila concluída! 🎉</p>
          <p className="text-sm text-muted-foreground mt-1">Todos os leads de <strong>{lista.empreendimento}</strong> foram trabalhados.</p>
          <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
            <p>📊 Sessão: <strong className="text-foreground">{formatSessionTime(sessionSeconds)}</strong></p>
            <p>📞 Tentativas: <strong className="text-foreground">{stats.tentativas}</strong> · Aproveitados: <strong className="text-emerald-600">{stats.aproveitados}</strong></p>
          </div>
          <p className="text-xs text-muted-foreground mt-3 animate-pulse">Redirecionando para as listas em instantes...</p>
          <Button className="mt-4" onClick={onBack}>Voltar às listas agora</Button>
        </CardContent>
      </Card>
    );
  }

  const freshness = getLeadFreshness(lead.data_lead);
  const motivationalMsg = getMotivationalMessage(stats.tentativas, stats.aproveitados, streak, metaLigacoes);

  return (
    <div className="space-y-3">
      {/* Milestone Animation */}
      <AnimatePresence>
        {showMilestone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="text-center p-4 rounded-2xl bg-gradient-to-r from-primary/20 to-amber-500/20 border-2 border-primary/30"
          >
            <p className="text-lg font-bold text-foreground">{showMilestone}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini-break suggestion */}
      {shouldSuggestBreak && (
        <div className="text-center p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700">
          ☕ <strong>{stats.tentativas} ligações!</strong> Que tal uma pausa rápida de 2 min? Voltar descansado rende mais.
        </div>
      )}

      {/* Motivational bar + session info */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium text-muted-foreground">{motivationalMsg}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatSessionTime(sessionSeconds)}</span>
          {streak >= 2 && (
            <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
              🔥 {streak}x
            </Badge>
          )}
        </div>
      </div>

      {/* Daily Progress Mini-Summary */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-card space-y-2">
        {editingMetas ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Editar Metas</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Ligações</label>
                <Input type="number" value={metaLig} onChange={e => setMetaLig(e.target.value)} className="h-8 mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Aproveitados</label>
                <Input type="number" value={metaAprov} onChange={e => setMetaAprov(e.target.value)} className="h-8 mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Visitas</label>
                <Input type="number" value={metaVis} onChange={e => setMetaVis(e.target.value)} className="h-8 mt-0.5" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={async () => {
                await saveGoals(parseInt(metaLig) || 30, parseInt(metaAprov) || 5, parseInt(metaVis) || 3);
                setEditingMetas(false);
                toast.success("Metas atualizadas!");
                queryClient.invalidateQueries({ queryKey: ["corretor-daily-goals"] });
              }}>Salvar</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingMetas(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm">
                  <Flame className="h-4 w-4 text-primary" />
                  <span className="font-bold text-foreground">{stats.tentativas}</span>
                  <span className="text-muted-foreground text-[10px]">/ {metaLigacoes}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Target className="h-4 w-4 text-emerald-500" />
                  <span className="font-bold text-foreground">{stats.aproveitados}</span>
                  <span className="text-muted-foreground text-[10px]">/ {metaAproveitados}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <CalendarCheck className="h-4 w-4 text-amber-500" />
                  <span className="font-bold text-foreground">{stats.visitas_marcadas}</span>
                  <span className="text-muted-foreground text-[10px]">/ {metaVisitas}</span>
                </div>
                <span className="text-xs font-bold text-primary">{stats.pontos} pts</span>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                  setMetaLig((goals?.meta_ligacoes || 30).toString());
                  setMetaAprov((goals?.meta_aproveitados || 5).toString());
                  setMetaVis((goals?.meta_visitas_marcadas || 3).toString());
                  setEditingMetas(true);
                }}>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
                {stats.tentativas >= metaLigacoes && (
                  <Badge variant="secondary" className="text-[10px] gap-1">🔥 Missão cumprida!</Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Progress value={progLig} className="h-1.5" />
              <Progress value={progAprov} className="h-1.5" />
              <Progress value={progVisitas} className="h-1.5" />
            </div>
          </>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ScoringLegend />
          <span className="text-[10px] text-muted-foreground">•</span>
          <span className="text-[10px] text-primary font-semibold">{lista.empreendimento}</span>
        </div>
        <div className="flex items-center gap-2">
          {fila.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => {
                if (currentIndex < fila.length - 1) {
                  setCurrentIndex(prev => prev + 1);
                  toast("Lead pulado — avançando para o próximo", { duration: 1500 });
                }
              }}
              disabled={currentIndex >= fila.length - 1 || callActive}
            >
              <SkipForward className="h-3.5 w-3.5" /> Pular
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={async () => {
              if (!user) return;
              setFinalizando(true);
              try {
                const { data, error } = await supabase.rpc("finalizar_trabalho_corretor", { p_user_id: user.id });
                if (error) throw error;
                const result = data as any;
                if (result?.success) {
                  toast.success(`Trabalho finalizado! ${result.tentativas} tentativas e ${result.aproveitados} aproveitados enviados.`);
                  onBack();
                } else {
                  toast.error(result?.message || "Erro ao finalizar trabalho.");
                }
              } catch (err: any) {
                toast.error("Erro ao finalizar: " + err.message);
              } finally {
                setFinalizando(false);
              }
            }}
            disabled={finalizando || stats.tentativas === 0}
          >
            <LogOut className="h-3.5 w-3.5" /> {finalizando ? "Enviando..." : "Finalizar"}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Lead <strong className="text-foreground">{currentIndex + 1}</strong> de {fila.length}</span>
        <div className="flex items-center gap-2">
          {lockStatus === "locked" && (
            <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/30 text-emerald-600">
              <Lock className="h-3 w-3" /> Reservado
            </Badge>
          )}
          {lockStatus === "locking" && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Loader2 className="h-3 w-3 animate-spin" /> Reservando...
            </Badge>
          )}
          {lockStatus === "failed" && (
            <Badge variant="outline" className="gap-1 text-[10px] border-destructive/30 text-destructive">
              <Lock className="h-3 w-3" /> Bloqueado
            </Badge>
          )}
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${((currentIndex + 1) / fila.length) * 100}%` }} />
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Lead Card (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <Card className={`border-2 ${lead.tentativas_count > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-primary/20"}`}>
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> {lead.nome}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" /> {lead.empreendimento}
                    {lead.campanha && <span>· {lead.campanha}</span>}
                    {lead.origem && <span>· {lead.origem}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Lead Freshness Badge */}
                  <Badge variant="outline" className={`text-[10px] gap-1 ${freshness.color}`} title={freshness.tip}>
                    {freshness.emoji} {freshness.label}
                  </Badge>
                  {lead.tentativas_count > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700">
                      <History className="h-3 w-3" /> {lead.tentativas_count}x
                    </Badge>
                  )}
                </div>
              </div>

              {/* Call Timer — prominent during active call */}
              {callActive && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border-2 border-red-500/30">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                      </span>
                      <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">Em ligação</span>
                    </div>
                    <span className="text-2xl font-mono font-bold text-red-500">{formatTimer(callTimer)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-green-600 hover:bg-green-500/10"
                      onClick={handleWhatsAppDuringCall}
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white gap-1"
                      onClick={handleFinalizarLigacao}
                    >
                      <Phone className="h-3.5 w-3.5 rotate-[135deg]" /> Finalizar Ligação
                    </Button>
                  </div>
                </div>
              )}

              {/* Contact info — tap phone to copy */}
              <div className="grid gap-2">
                {lead.telefone && (
                  <div
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted/80 transition-colors active:scale-[0.98]"
                    onClick={() => copyToClipboard(lead.telefone!, "Telefone")}
                  >
                    <div>
                      <p className="text-[10px] text-muted-foreground">Telefone principal · toque para copiar</p>
                      <p className="text-base font-mono font-bold text-foreground">{formatPhone(lead.telefone)}</p>
                    </div>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
                {lead.telefone2 && (
                  <div
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
                    onClick={() => copyToClipboard(lead.telefone2!, "Telefone 2")}
                  >
                    <div>
                      <p className="text-[10px] text-muted-foreground">Telefone secundário · toque para copiar</p>
                      <p className="text-sm font-mono text-foreground">{formatPhone(lead.telefone2)}</p>
                    </div>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
                {lead.email && (
                  <div
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
                    onClick={() => copyToClipboard(lead.email!, "E-mail")}
                  >
                    <div>
                      <p className="text-[10px] text-muted-foreground">E-mail · toque para copiar</p>
                      <p className="text-xs text-foreground">{lead.email}</p>
                    </div>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Extra info */}
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {lead.data_lead && (
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Lead de {lead.data_lead}</span>
                )}
                {lead.observacoes && <span className="italic">"{lead.observacoes}"</span>}
              </div>

              {/* Attempt History */}
              {lead.tentativas_count > 0 && <AttemptHistory leadId={lead.id} />}

              {/* Action Buttons — 2-step flow for calls */}
              {!callActive ? (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button
                    size="lg"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-12 text-sm"
                    onClick={() => handleAction("ligacao")}
                    disabled={lockStatus !== "locked" || showModal}
                  >
                    <Phone className="h-4 w-4" /> Iniciar Ligação
                  </Button>
                  <Button
                    size="lg"
                    className="gap-1.5 bg-green-600 hover:bg-green-700 h-12 text-sm"
                    onClick={() => handleAction("whatsapp")}
                    disabled={lockStatus !== "locked" || showModal}
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-1.5 h-12 text-sm"
                    onClick={() => handleAction("email")}
                    disabled={lockStatus !== "locked" || !lead.email || showModal}
                  >
                    <Mail className="h-4 w-4" /> E-mail
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <Button
                    size="lg"
                    className="gap-2 bg-red-600 hover:bg-red-700 h-14 text-base text-white"
                    onClick={handleFinalizarLigacao}
                  >
                    <Phone className="h-5 w-5 rotate-[135deg]" /> Finalizar Ligação · {formatTimer(callTimer)}
                  </Button>
                </div>
              )}

              {actionTaken && !showModal && !callActive && (
                <div className="text-center text-xs text-muted-foreground animate-pulse">
                  Registre o resultado para continuar...
                </div>
              )}

              {/* Next Lead Preview */}
              {nextLead && !callActive && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50 text-[10px] text-muted-foreground">
                  <ChevronRight className="h-3 w-3" />
                  <span>Próximo: <strong className="text-foreground">{nextLead.nome}</strong></span>
                  {nextLead.tentativas_count > 0 && <span>({nextLead.tentativas_count}x tent.)</span>}
                  {nextLead.data_lead && (
                    <span className={getLeadFreshness(nextLead.data_lead).color}>
                      {getLeadFreshness(nextLead.data_lead).emoji}
                    </span>
                  )}
                </div>
              )}

              {/* Objeções Rápidas */}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Zap className="h-4 w-4 text-amber-500" /> OBJEÇÕES RÁPIDAS
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {[
                    { objecao: "Já tenho corretor", resposta: "Entendo! Meu papel não é substituir ninguém, mas complementar. Posso te mostrar condições exclusivas deste empreendimento que talvez seu corretor não tenha acesso." },
                    { objecao: "Não tenho interesse", resposta: "Sem problemas! Só por curiosidade, o que te fez preencher o formulário? Às vezes temos condições que mudam a perspectiva." },
                    { objecao: "Estou sem tempo agora", resposta: "Claro! Posso te ligar em outro horário? Leva menos de 2 minutos. Qual o melhor horário pra você?" },
                    { objecao: "Está muito caro", resposta: "Entendo sua preocupação. Temos planos de pagamento facilitados e condições especiais de lançamento. Posso te mostrar uma simulação rápida?" },
                    { objecao: "Preciso falar com meu cônjuge", resposta: "Faz todo sentido! Que tal agendarmos uma visita juntos? Assim vocês podem conhecer o empreendimento e tirar todas as dúvidas de uma vez." },
                    { objecao: "Já comprei outro imóvel", resposta: "Parabéns pela aquisição! Muitos dos nossos clientes investem em um segundo imóvel para renda. Já pensou nisso?" },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-background">
                      <p className="text-xs font-bold text-destructive mb-1">❌ "{item.objecao}"</p>
                      <p className="text-xs text-foreground">✅ {item.resposta}</p>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>

        {/* Right: Script Panel (2 cols) */}
        <div className="lg:col-span-2">
          <div className="sticky top-4">
            <ScriptPanel empreendimento={lista.empreendimento} lead={lead} />
          </div>
        </div>
      </div>

      {/* Attempt Modal */}
      {showModal && lead && (
        <AttemptModal
          open={showModal}
          onClose={() => { setShowModal(false); setActionTaken(null); stopTimer(); }}
          onSubmit={handleResultSubmit}
          leadName={lead.nome}
          callDuration={actionTaken === "ligacao" ? callTimer : undefined}
        />
      )}
    </div>
  );
}
