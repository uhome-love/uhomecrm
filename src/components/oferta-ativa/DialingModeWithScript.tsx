import { useState, useEffect, useRef, useCallback } from "react";
import { useOAServerQueue, useOARegistrarTentativa, useOATemplates, type OALista, type OALead } from "@/hooks/useOfertaAtiva";
import { useOAPendingQueue } from "@/hooks/useOAPendingQueue";
import { useOASessionGuard } from "@/hooks/useOASessionGuard";
import { supabase } from "@/integrations/supabase/client";
import { createVisitaFromOA } from "@/hooks/useVisitas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Phone, MessageCircle, Mail, Copy, User, Building2, Calendar, History, CheckCircle, Zap, ChevronDown, LogOut, SkipForward, Clock, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import DailyProgressCard from "@/components/corretor/DailyProgressCard";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import AttemptModal from "./AttemptModal";
import ScriptPanel from "./ScriptPanel";
import AttemptHistory from "./AttemptHistory";
import ScoringLegend from "./ScoringLegend";
import RecentCallsHistory from "./RecentCallsHistory";
import PendingAttemptsBar from "./PendingAttemptsBar";
import SessionCoachingModal, { type SessionMetrics } from "./SessionCoachingModal";
import { motion, AnimatePresence } from "framer-motion";
import { playSoundSuccess, playSoundDing } from "@/lib/celebrations";

/** Format Brazilian phone */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

/** Lead freshness — always positive framing to motivate the broker */
function getLeadFreshness(dataLead: string | null): { label: string; emoji: string; color: string; tip: string } {
  if (!dataLead) return { label: "Lead novo", emoji: "✨", color: "text-primary", tip: "Sem data de entrada — trate como oportunidade!" };
  const days = Math.floor((Date.now() - new Date(dataLead).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 3) return { label: "Fresquíssimo", emoji: "🔥", color: "text-red-500", tip: `Lead de ${days === 0 ? "hoje" : `${days} dia(s)`} — alta chance de atendimento!` };
  if (days <= 14) return { label: "Boa janela", emoji: "☀️", color: "text-amber-500", tip: `Lead de ${days} dias — ainda é boa hora!` };
  if (days <= 30) return { label: "Oportunidade", emoji: "💎", color: "text-primary", tip: `Lead de ${days} dias — poucos corretores ligam, você sai na frente!` };
  return { label: "Diferencial", emoji: "🎯", color: "text-emerald-600", tip: `Lead de ${days} dias — abordagem diferenciada te destaca!` };
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
  const { currentLead: lead, isLoading, queueEmpty, fetchNext, startHeartbeat, stopHeartbeat, unlockLead } = useOAServerQueue(lista.id);
  const { registrar } = useOARegistrarTentativa();
  const { templates } = useOATemplates(lista.empreendimento);
  const { progress, goals, saveGoals, applyOptimisticUpdate } = useCorretorProgress();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addPending } = useOAPendingQueue();
  const { sessionId, blocked, otherSessionActive, claimSession } = useOASessionGuard();
  const [skipCount, setSkipCount] = useState(0);

  const [sessionLeadsServed, setSessionLeadsServed] = useState(0);
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string | null>(null);

  const [actionTaken, setActionTaken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [showCoachingModal, setShowCoachingModal] = useState(false);
  const [sessionMetricsSnapshot, setSessionMetricsSnapshot] = useState<SessionMetrics | null>(null);
  
  // === TIMESTAMP-BASED TIMER ===
  const [callStartTimestamp, setCallStartTimestamp] = useState<number | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [streak, setStreak] = useState(0);
  const [sessionStart] = useState(() => Date.now());
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showMilestone, setShowMilestone] = useState<string | null>(null);
  
  // === FETCH FIRST LEAD on mount ===
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchNext();
    }
  }, [fetchNext]);

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

  // TIMESTAMP-BASED call timer
  const startTimer = useCallback(() => {
    const now = Date.now();
    setCallStartTimestamp(now);
    setCallTimer(0);
    setCallActive(true);
    timerRef.current = setInterval(() => {
      setCallTimer(Math.floor((Date.now() - now) / 1000));
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    setCallActive(false);
    if (callStartTimestamp) {
      setCallTimer(Math.floor((Date.now() - callStartTimestamp) / 1000));
    }
    setCallStartTimestamp(null);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, [callStartTimestamp]);

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

  const shouldSuggestBreak = progress.tentativas > 0 && progress.tentativas % 15 === 0;

  // Start heartbeat when lead is locked
  useEffect(() => {
    if (lead) startHeartbeat(lead.id);
    return () => stopHeartbeat();
  }, [lead?.id, startHeartbeat, stopHeartbeat]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleAction = (canal: string) => {
    if (!lead) return;
    if (canal === "ligacao") {
      setActionTaken("ligacao");
      startTimer();
      setCurrentIdempotencyKey(`${user?.id}_${lead.id}_${Date.now()}`);
      return;
    }
    setActionTaken(canal);
    setCurrentIdempotencyKey(`${user?.id}_${lead.id}_${Date.now()}`);

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

  const handleFinalizarLigacao = () => {
    stopTimer();
    setShowModal(true);
  };

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

  const handleResultSubmit = async (resultado: string, feedback: string, visitaMarcada?: boolean, interesseTipo?: string) => {
    if (!lead || !actionTaken || submitting) return;
    setSubmitting(true);
    try {
      const result = await registrar(lead, actionTaken, resultado, feedback, lista, currentIdempotencyKey || undefined, visitaMarcada, interesseTipo);
      if (!result?.success) { setSubmitting(false); return; }

      if (!result.idempotent) {
        // Determine points for optimistic update
        const pontos = resultado === "com_interesse" ? 3 : resultado === "numero_errado" ? 0 : 1;
        // Apply optimistic update IMMEDIATELY so card updates without waiting for refetch
        applyOptimisticUpdate(resultado, actionTaken, pontos, visitaMarcada ?? false);

        if (resultado === "com_interesse") {
          setStreak(prev => prev + 1);
          playSoundSuccess();
          const tipoLabel = interesseTipo === "visita_marcada" ? "Visita Marcada" 
            : interesseTipo === "quer_visitar" ? "Possibilidade de Visita"
            : interesseTipo === "demonstrou_interesse" ? "Atendimento"
            : "Contato Inicial";
          toast.success(`🎉 APROVEITADO → Pipeline: ${tipoLabel}! +3 pontos!`, { duration: 4000 });
          if ((visitaMarcada || interesseTipo === "visita_marcada") && lead) {
            createVisitaFromOA({
              corretorId: user!.id,
              leadId: lead.id,
              nomeCliente: lead.nome,
              telefone: lead.telefone || undefined,
              empreendimento: lead.empreendimento || undefined,
              attemptId: (result as any).attempt_id || undefined,
              observacoes: feedback,
            });
            toast.success("📅 Visita registrada na Agenda de Visitas!");
          }
        } else if (resultado === "nao_atendeu") {
          setStreak(0);
          toast("📞 Não atendeu — lead volta à fila com cooldown progressivo", { duration: 2000 });
        } else if (resultado === "sem_interesse") {
          setStreak(0);
          toast("👋 Sem interesse — lead removido da fila", { duration: 2000 });
        } else if (resultado === "numero_errado") {
          toast("❌ Número errado — removido", { duration: 2000 });
        }
        checkMilestone(progress.tentativas + 1);
      }

      stopTimer();
      stopHeartbeat();
      setShowModal(false);
      setActionTaken(null);
      setCurrentIdempotencyKey(null);
      setSessionLeadsServed(prev => prev + 1);
      queryClient.invalidateQueries({ queryKey: ["checkpoint"] });
      queryClient.invalidateQueries({ queryKey: ["oa-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["oa-performance-live"] });

      // Fetch next lead from server (atomic, server-side selection)
      await fetchNext();
    } catch (err: any) {
      console.error("Erro ao registrar tentativa:", err);
      // Offline retry: save to pending queue
      if (lead && actionTaken && currentIdempotencyKey && user) {
        addPending({
          leadId: lead.id,
          corretorId: user.id,
          canal: actionTaken,
          resultado,
          feedback,
          listaId: lead.lista_id,
          empreendimento: lead.empreendimento,
          idempotencyKey: currentIdempotencyKey,
          visitaMarcada: visitaMarcada || false,
        });
        toast.error("Sem conexão — resultado salvo localmente. Será reenviado automaticamente.");
        // Still advance to next lead
        stopTimer();
        stopHeartbeat();
        setShowModal(false);
        setActionTaken(null);
        setCurrentIdempotencyKey(null);
        setSessionLeadsServed(prev => prev + 1);
        await fetchNext();
      } else {
        toast.error("Erro ao registrar tentativa. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-redirect when queue is empty
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (!lead && !isLoading && queueEmpty && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      toast.info("📋 Leads desta lista acabaram! Escolha outra lista para continuar.", { duration: 5000 });
      const timer = setTimeout(() => onBack(), 3000);
      return () => clearTimeout(timer);
    }
  }, [lead, isLoading, queueEmpty, onBack]);

  // Session guard: block if another tab is active
  if (blocked) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="font-bold text-lg text-foreground">Sessão ativa em outra aba</p>
          <p className="text-sm text-muted-foreground mt-1">Você já tem o discador aberto em outra aba do navegador.</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button onClick={claimSession}>Assumir esta aba</Button>
            <Button variant="outline" onClick={onBack}>Voltar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

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
            <p>📊 Sessão: <strong className="text-foreground">{formatSessionTime(sessionSeconds)}</strong> · Leads: <strong className="text-foreground">{sessionLeadsServed}</strong></p>
            <p>📞 Tentativas: <strong className="text-foreground">{progress.tentativas}</strong> · Aproveitados: <strong className="text-emerald-600">{progress.aproveitados}</strong></p>
          </div>
          <p className="text-xs text-muted-foreground mt-3 animate-pulse">Redirecionando para as listas em instantes...</p>
          <Button className="mt-4" onClick={onBack}>Voltar às listas agora</Button>
        </CardContent>
      </Card>
    );
  }

  const freshness = getLeadFreshness(lead.data_lead);
  const motivationalMsg = getMotivationalMessage(progress.tentativas, progress.aproveitados, streak, progress.metaLigacoes);

  return (
    <div className="space-y-3">
      {/* Pending attempts bar */}
      <PendingAttemptsBar />

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
          ☕ <strong>{progress.tentativas} ligações!</strong> Que tal uma pausa rápida de 2 min? Voltar descansado rende mais.
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

      {/* Daily Progress Mini-Summary — SHARED COMPONENT */}
      <DailyProgressCard
        progress={progress}
        goals={goals}
        saveGoals={saveGoals}
        variant="compact"
      />

      {/* Controls Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ScoringLegend />
          <span className="text-[10px] text-muted-foreground">•</span>
          <span className="text-[10px] text-primary font-semibold">{lista.empreendimento}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={async () => {
              if (lead && user) {
                // Log skip event
                setSkipCount(prev => prev + 1);
                try {
                  await supabase.from("oa_events" as any).insert({
                    event_type: "lead_skipped",
                    user_id: user.id,
                    lead_id: lead.id,
                    lista_id: lista.id,
                    session_id: sessionId,
                    metadata: { skip_number: skipCount + 1 },
                  });
                } catch {}
                await unlockLead(lead.id);
              }
              await fetchNext();
              toast("Lead pulado — próximo da fila", { duration: 1500 });
            }}
            disabled={callActive}
          >
            <SkipForward className="h-3.5 w-3.5" /> Pular
          </Button>
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
                  // Build session metrics snapshot for coaching
                  const atenderam = progress.aproveitados + (progress.tentativas - progress.ligacoes > 0 ? Math.round(progress.tentativas * 0.3) : Math.round(progress.tentativas * 0.25));
                  const snapshot: SessionMetrics = {
                    total_tentativas: progress.tentativas,
                    total_atenderam: Math.min(atenderam, progress.tentativas),
                    total_aproveitados: progress.aproveitados,
                    ligacoes: progress.ligacoes,
                    whatsapps: progress.whatsapps,
                    emails: progress.emails,
                    pontos: progress.pontos,
                    duracao_segundos: sessionSeconds,
                    empreendimento: lista.empreendimento,
                    lista_id: lista.id,
                    session_start: sessionStart,
                  };
                  setSessionMetricsSnapshot(snapshot);
                  setShowCoachingModal(true);
                } else {
                  toast.error(result?.message || "Erro ao finalizar trabalho.");
                }
              } catch (err: any) {
                toast.error("Erro ao finalizar: " + err.message);
              } finally {
                setFinalizando(false);
              }
            }}
            disabled={finalizando || progress.tentativas === 0}
          >
            <LogOut className="h-3.5 w-3.5" /> {finalizando ? "Enviando..." : "Finalizar"}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Lead <strong className="text-foreground">#{sessionLeadsServed + 1}</strong> desta sessão</span>
        <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/30 text-emerald-600">
          🔒 Reservado p/ você
        </Badge>
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

              {/* Call Timer */}
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

              {/* Contact info */}
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

              {/* Action Buttons */}
              {!callActive ? (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button
                    size="lg"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-12 text-sm"
                    onClick={() => handleAction("ligacao")}
                    disabled={showModal}
                  >
                    <Phone className="h-4 w-4" /> Iniciar Ligação
                  </Button>
                  <Button
                    size="lg"
                    className="gap-1.5 bg-green-600 hover:bg-green-700 h-12 text-sm"
                    onClick={() => handleAction("whatsapp")}
                    disabled={showModal}
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-1.5 h-12 text-sm"
                    onClick={() => handleAction("email")}
                    disabled={!lead.email || showModal}
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

              {/* Recent Calls History */}
              <RecentCallsHistory />

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

      {/* Session Coaching Modal */}
      {sessionMetricsSnapshot && (
        <SessionCoachingModal
          open={showCoachingModal}
          onClose={() => {
            setShowCoachingModal(false);
            onBack();
          }}
          metrics={sessionMetricsSnapshot}
          onViewLeadsQuentes={() => {
            setShowCoachingModal(false);
            onBack();
          }}
        />
      )}
    </div>
  );
}
