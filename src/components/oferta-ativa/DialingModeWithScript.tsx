import { useState, useEffect, useRef, useCallback } from "react";
import { useOAServerQueue, useOARegistrarTentativa, useOATemplates, type OALista, type OALead } from "@/hooks/useOfertaAtiva";
import { useOAPendingQueue } from "@/hooks/useOAPendingQueue";
import { useOASessionGuard } from "@/hooks/useOASessionGuard";
import { supabase } from "@/integrations/supabase/client";
import { createVisitaFromOA } from "@/hooks/useVisitas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Phone, MessageCircle, Mail, Copy, User, Building2, Calendar, History, CheckCircle, Zap, ChevronDown, LogOut, SkipForward, Clock, ChevronRight, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
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
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import { useIsMobile } from "@/hooks/use-mobile";

/** Format Brazilian phone */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

/** Lead freshness */
function getLeadFreshness(dataLead: string | null): { label: string; emoji: string; color: string; tip: string } {
  if (!dataLead) return { label: "Lead novo", emoji: "✨", color: "text-primary", tip: "Sem data de entrada" };
  const days = Math.floor((Date.now() - new Date(dataLead).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 3) return { label: "Fresquíssimo", emoji: "🔥", color: "text-red-500", tip: `Lead de ${days === 0 ? "hoje" : `${days} dia(s)`}` };
  if (days <= 14) return { label: "Boa janela", emoji: "☀️", color: "text-amber-500", tip: `Lead de ${days} dias` };
  if (days <= 30) return { label: "Oportunidade", emoji: "💎", color: "text-primary", tip: `Lead de ${days} dias` };
  return { label: "Diferencial", emoji: "🎯", color: "text-emerald-600", tip: `Lead de ${days} dias` };
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
  const isMobile = useIsMobile();
  const [skipCount, setSkipCount] = useState(0);

  const [sessionLeadsServed, setSessionLeadsServed] = useState(0);
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string | null>(null);

  const [actionTaken, setActionTaken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [showCoachingModal, setShowCoachingModal] = useState(false);
  const [sessionMetricsSnapshot, setSessionMetricsSnapshot] = useState<SessionMetrics | null>(null);

  // Timer
  const [callStartTimestamp, setCallStartTimestamp] = useState<number | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [streak, setStreak] = useState(0);
  const [sessionStart] = useState(() => Date.now());
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showMilestone, setShowMilestone] = useState<string | null>(null);
  const [expandedObj, setExpandedObj] = useState<number | null>(null);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);
  const [objectionInsert, setObjectionInsert] = useState<string | null>(null);
  const [inlineObs, setInlineObs] = useState("");
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [objAccordionOpen, setObjAccordionOpen] = useState(false);

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<"lead" | "script" | "whatsapp">("lead");

  // Script tab (desktop right column)
  const [scriptTab, setScriptTab] = useState<"ligacao" | "whatsapp">("ligacao");

  // Arena overlays
  const [showRound, setShowRound] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [arenaShake, setArenaShake] = useState(false);
  const [arenaConfetti, setArenaConfetti] = useState<string[]>([]);
  const prevLeadIdRef = useRef<string | null>(null);
  const objScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to objection response
  useEffect(() => {
    if (objectionInsert && expandedObj !== null && objScrollRef.current) {
      setTimeout(() => {
        const el = objScrollRef.current?.querySelector('[data-objection-block]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [objectionInsert, expandedObj]);

  useEffect(() => {
    if (lead && lead.id !== prevLeadIdRef.current) {
      prevLeadIdRef.current = lead.id;
      if (sessionLeadsServed > 0) {
        setShowFlash(true);
        setShowRound(true);
        setTimeout(() => setShowFlash(false), 350);
        setTimeout(() => setShowRound(false), 900);
      }
      setExpandedObj(null);
      setObjectionInsert(null);
      setInlineObs("");
      setSelectedResult(null);
      setShowResultPopup(false);
    }
  }, [lead?.id, sessionLeadsServed]);

  const triggerConfetti = useCallback(() => {
    const emojis = ['🎉', '✨', '🌟', '⭐', '🔥', '💫', '🎊', '✅', '💎', '🏆',
                    '🎉', '✨', '🌟', '⭐', '🔥', '💫', '🎊', '✅', '💎', '🏆'];
    setArenaConfetti(emojis);
    setTimeout(() => setArenaConfetti([]), 3000);
  }, []);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchNext();
    }
  }, [fetchNext]);

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

  const checkMilestone = useCallback((totalAttempts: number) => {
    const milestones: Record<number, string> = {
      5: "🎯 5 ligações! Aqueceu!", 10: "🔟 10 ligações! Tá on fire!",
      15: "💪 15! Você é uma máquina!", 20: "🏆 20 ligações! Poucos chegam aqui!",
      25: "⭐ 25! Desempenho de elite!", 30: "👑 30! Você é LENDA!", 50: "🚀 50 LIGAÇÕES! HISTÓRICO!",
    };
    if (milestones[totalAttempts]) {
      setShowMilestone(milestones[totalAttempts]);
      setTimeout(() => setShowMilestone(null), 3000);
    }
  }, []);

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
        const pontos = resultado === "com_interesse" ? 3 : resultado === "numero_errado" ? 0 : 1;
        applyOptimisticUpdate(resultado, actionTaken, pontos, visitaMarcada ?? false);

        if (resultado === "com_interesse") {
          setStreak(prev => prev + 1);
          playSoundSuccess();
          triggerConfetti();
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
          setArenaShake(true);
          setTimeout(() => setArenaShake(false), 500);
          toast("Próximo! 💪", { duration: 1500 });
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
      setInlineObs("");
      queryClient.invalidateQueries({ queryKey: ["checkpoint"] });
      queryClient.invalidateQueries({ queryKey: ["oa-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["oa-performance-live"] });

      await fetchNext();
    } catch (err: any) {
      console.error("Erro ao registrar tentativa:", err);
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
        toast.error("Sem conexão — resultado salvo localmente.");
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

  // Open result popup
  const handleOpenResultPopup = () => {
    if (!actionTaken) {
      setActionTaken("ligacao");
      setCurrentIdempotencyKey(`${user?.id}_${lead?.id}_${Date.now()}`);
    }
    stopTimer();
    setShowResultPopup(true);
  };

  // Quick result from popup
  const handlePopupResult = (resultado: string) => {
    if (!lead) return;
    setSelectedResult(resultado);
    if (resultado === "com_interesse" || resultado === "agendar") {
      setShowResultPopup(false);
      if (!actionTaken) {
        setActionTaken("ligacao");
        setCurrentIdempotencyKey(`${user?.id}_${lead.id}_${Date.now()}`);
      }
      setShowModal(true);
      return;
    }
  };

  const handlePopupConfirm = () => {
    if (!lead || !selectedResult) return;
    if (!actionTaken) {
      setActionTaken("ligacao");
      setCurrentIdempotencyKey(`${user?.id}_${lead.id}_${Date.now()}`);
    }
    const feedbackMap: Record<string, string> = {
      nao_atendeu: inlineObs.trim().length >= 10 ? inlineObs.trim() : "Não atendeu a ligação",
      sem_interesse: inlineObs.trim().length >= 10 ? inlineObs.trim() : "Sem interesse no momento",
      numero_errado: inlineObs.trim().length >= 10 ? inlineObs.trim() : "Número errado/inválido",
    };
    setShowResultPopup(false);
    setSelectedResult(null);
    handleResultSubmit(selectedResult, feedbackMap[selectedResult] || inlineObs.trim() || selectedResult);
  };

  // Inline result (quick buttons in right column)
  const handleInlineResult = (resultado: string) => {
    if (!lead) return;
    if (!actionTaken) {
      setActionTaken("ligacao");
      setCurrentIdempotencyKey(`${user?.id}_${lead.id}_${Date.now()}`);
    }
    if (resultado === "com_interesse" || resultado === "agendar") {
      setShowModal(true);
      return;
    }
    const feedbackMap: Record<string, string> = {
      nao_atendeu: inlineObs.trim().length >= 10 ? inlineObs.trim() : "Não atendeu a ligação",
      sem_interesse: inlineObs.trim().length >= 10 ? inlineObs.trim() : "Sem interesse no momento",
      numero_errado: inlineObs.trim().length >= 10 ? inlineObs.trim() : "Número errado/inválido",
    };
    handleResultSubmit(resultado, feedbackMap[resultado] || resultado);
  };

  // Auto-redirect when queue is empty
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (!lead && !isLoading && queueEmpty && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      toast.info("📋 Leads desta lista acabaram!", { duration: 5000 });
      const timer = setTimeout(() => onBack(), 3000);
      return () => clearTimeout(timer);
    }
  }, [lead, isLoading, queueEmpty, onBack]);

  // Session guard
  if (blocked) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="font-bold text-lg text-foreground">Sessão ativa em outra aba</p>
          <p className="text-sm text-muted-foreground mt-1">Você já tem o discador aberto em outra aba.</p>
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
          <p className="text-xs text-muted-foreground mt-3 animate-pulse">Redirecionando...</p>
          <Button className="mt-4" onClick={onBack}>Voltar às listas agora</Button>
        </CardContent>
      </Card>
    );
  }

  const freshness = getLeadFreshness(lead.data_lead);
  const leadScore = lead.data_lead
    ? Math.max(30, 95 - Math.floor((Date.now() - new Date(lead.data_lead).getTime()) / (1000 * 60 * 60 * 24)) * 2 - lead.tentativas_count * 10)
    : 65;
  const isHotLead = leadScore > 80;
  const timeAgo = lead.data_lead
    ? (() => { const h = Math.floor((Date.now() - new Date(lead.data_lead).getTime()) / (1000 * 60 * 60)); return h < 1 ? "agora" : h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)}d`; })()
    : null;

  const timerColorClass = callTimer <= 30 ? "arena-timer-green" : callTimer <= 60 ? "arena-timer-amber" : "arena-timer-red";

  const objections = [
    { emoji: "💰", label: "Está caro", answer: `Para o ${lead.empreendimento || "empreendimento"}: compare o m² com a região. Temos condições de entrada facilitada e financiamento. Posso montar uma simulação?` },
    { emoji: "🤔", label: "Preciso pensar", answer: `Faz sentido! Que tal uma visita sem compromisso? Muitos clientes decidem ao ver pessoalmente. Posso agendar algo rápido de 20 min?` },
    { emoji: "❌", label: "Não é o momento", answer: `Entendo! Mas o ${lead.empreendimento || "empreendimento"} já vendeu boa parte. As melhores unidades vão primeiro. Reservar sem custo garante a oportunidade.` },
    { emoji: "👫", label: "Falar c/ cônjuge", answer: `Claro! Que tal agendar uma visita juntos? Assim vocês conhecem e decidem juntos. Qual o melhor dia?` },
  ];

  // ─── LEAD CARD (protagonist, left column 55%) ───

  const LeadColumn = (
    <div className="space-y-2 min-w-0">
      {/* Lead card — compact */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: "#1C2128", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        {/* Badge row */}
        <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "#6B7280" }}>
          <span className={freshness.color}>{freshness.emoji} {freshness.label}</span>
          <span>·</span>
          <span className={isHotLead ? "text-yellow-400 font-semibold" : ""}>🎯 Score: {leadScore}</span>
          {timeAgo && <><span>·</span><span>⏱ {timeAgo}</span></>}
          {isHotLead && <span className="text-yellow-400 font-semibold">🔥 Quente</span>}
        </div>

        {/* Name — text-2xl */}
        <div>
          <h2 className="text-2xl font-bold text-white leading-tight">{lead.nome}</h2>
          <div className="flex items-center gap-2 mt-0.5" style={{ fontSize: "14px", color: "#94A3B8" }}>
            <Building2 className="h-3.5 w-3.5" /> {lead.empreendimento}
            {lead.campanha && <span>· {lead.campanha}</span>}
          </div>
        </div>

        {/* Contact — simple lines, no boxes */}
        <div>
          {lead.telefone && (
            <div
              className="flex items-center justify-between py-1 cursor-pointer transition-colors hover:bg-white/5 active:scale-[0.98]"
              onClick={() => copyToClipboard(lead.telefone!, "Telefone")}
            >
              <span className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" style={{ color: "#6B7280" }} />
                <span className="font-mono font-bold text-white" style={{ fontSize: "15px" }}>{formatPhone(lead.telefone)}</span>
              </span>
              <Copy className="h-3 w-3" style={{ color: "#4B5563" }} />
            </div>
          )}
          {lead.telefone2 && (
            <div
              className="flex items-center justify-between py-1 cursor-pointer transition-colors hover:bg-white/5"
              onClick={() => copyToClipboard(lead.telefone2!, "Telefone 2")}
            >
              <span className="flex items-center gap-2">
                <Phone className="h-3 w-3" style={{ color: "#4B5563" }} />
                <span className="font-mono text-neutral-400" style={{ fontSize: "13px" }}>{formatPhone(lead.telefone2)}</span>
              </span>
              <Copy className="h-3 w-3" style={{ color: "#374151" }} />
            </div>
          )}
          {lead.email && (
            <div
              className="flex items-center justify-between py-1 cursor-pointer transition-colors hover:bg-white/5"
              onClick={() => copyToClipboard(lead.email!, "E-mail")}
            >
              <span className="flex items-center gap-2">
                <Mail className="h-3 w-3" style={{ color: "#4B5563" }} />
                <span className="text-neutral-400 truncate" style={{ fontSize: "13px" }}>{lead.email}</span>
              </span>
              <Copy className="h-3 w-3" style={{ color: "#374151" }} />
            </div>
          )}
        </div>

        {/* Call Timer inline */}
        {callActive && (
          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Em ligação</span>
              <span className="text-lg font-mono font-bold text-red-400">{formatTimer(callTimer)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" className="h-6 text-[11px] text-green-400 hover:bg-green-500/10" onClick={handleWhatsAppDuringCall}>
                <MessageCircle className="h-3 w-3 mr-0.5" /> WhatsApp
              </Button>
              <Button size="sm" className="h-6 text-[11px] bg-red-600 hover:bg-red-700 text-white gap-1" onClick={handleOpenResultPopup}>
                <Phone className="h-3 w-3 rotate-[135deg]" /> Finalizar
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons — compact */}
        {!callActive && (
          <div className="space-y-2">
            <button
              className="arena-btn-call w-full gap-2 rounded-xl flex items-center justify-center"
              style={{ height: "44px", fontSize: "15px", fontWeight: 700 }}
              onClick={() => handleAction("ligacao")}
              disabled={showModal || showResultPopup}
            >
              <Phone className="h-4 w-4" /> LIGAR AGORA
            </button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                style={{ height: "36px", fontSize: "13px" }}
                onClick={() => setComunicacaoOpen(true)}
                disabled={showModal || showResultPopup}
              >
                <MessageCircle className="h-3.5 w-3.5" /> Mensagem
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-neutral-400 hover:text-white hover:bg-white/5"
                style={{ height: "36px", fontSize: "13px", border: "1px solid rgba(255,255,255,0.1)" }}
                onClick={() => handleAction("email")}
                disabled={!lead.email || showModal || showResultPopup}
              >
                <Mail className="h-3.5 w-3.5" /> E-mail
              </Button>
            </div>
          </div>
        )}

        {/* ⚡ Objeções Rápidas — accordion inside card */}
        <Collapsible open={objAccordionOpen} onOpenChange={setObjAccordionOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-1 cursor-pointer group">
            <span style={{ fontSize: 11, color: "#FBBF24", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>⚡ Objeções Rápidas</span>
            <ChevronDown className={`h-3 w-3 text-amber-400 transition-transform ${objAccordionOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-2 gap-1.5 pt-1.5">
              {objections.map((obj, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setExpandedObj(expandedObj === i ? null : i);
                    setObjectionInsert(obj.answer);
                  }}
                  className="transition-all text-left flex items-center"
                  style={{
                    background: expandedObj === i ? "rgba(245,158,11,0.12)" : "#1C2128",
                    border: expandedObj === i ? "1px solid rgba(245,158,11,0.4)" : "1px dashed rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: expandedObj === i ? "#FCD34D" : "#D1D5DB",
                    height: 32,
                  }}
                >
                  {obj.emoji} {obj.label}
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Recent calls — collapsed, outside card */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors w-full px-1">
          <History className="h-3 w-3" />
          <span>Últimas Ligações ({lead.tentativas_count})</span>
          <ChevronDown className="h-3 w-3 ml-auto" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <RecentCallsHistory />
          {lead.tentativas_count > 0 && <AttemptHistory leadId={lead.id} />}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  // ─── TOOLS COLUMN (right 45%): Scripts in tabs ───
  const ToolsColumn = (
    <div className="min-w-0 h-full flex flex-col gap-3">
      {/* Script Tabs — fixed header */}
      <div className="flex gap-1 p-1 rounded-lg shrink-0" style={{ background: "#161B22" }}>
        <button
          onClick={() => setScriptTab("ligacao")}
          className="flex-1 py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          style={{
            background: scriptTab === "ligacao" ? "rgba(34,197,94,0.15)" : "transparent",
            color: scriptTab === "ligacao" ? "#86EFAC" : "#6B7280",
            border: scriptTab === "ligacao" ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent",
          }}
        >
          📋 Script Ligação
        </button>
        <button
          onClick={() => setScriptTab("whatsapp")}
          className="flex-1 py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          style={{
            background: scriptTab === "whatsapp" ? "rgba(34,197,94,0.15)" : "transparent",
            color: scriptTab === "whatsapp" ? "#86EFAC" : "#6B7280",
            border: scriptTab === "whatsapp" ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent",
          }}
        >
          💬 Script WhatsApp
        </button>
      </div>

      {/* Scrollable content area: Script + Objection Response + CTA */}
      <div
        ref={objScrollRef}
        className="flex-1 min-h-0 rounded-xl overflow-y-auto"
        style={{
          background: scriptTab === "ligacao" ? "#1a2332" : "#0d1f0d",
          borderLeft: scriptTab === "ligacao" ? "3px solid rgba(34,197,94,0.3)" : "3px solid rgba(34,197,94,0.5)",
          scrollbarWidth: "thin",
        }}
      >
        <ScriptPanel empreendimento={lista.empreendimento} lead={lead} compact darkMode scriptFilter={scriptTab} />

        {/* Objection response block — inside scroll area */}
        <AnimatePresence>
          {objectionInsert && expandedObj !== null && (
            <motion.div
              data-objection-block
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mx-3 mb-3 p-3 rounded-lg text-sm leading-relaxed relative"
              style={{ background: "rgba(245,158,11,0.1)", borderLeft: "3px solid #F59E0B", color: "#E5E7EB" }}
            >
              <button
                onClick={() => { setExpandedObj(null); setObjectionInsert(null); }}
                className="absolute top-2 right-2 text-neutral-500 hover:text-white transition-colors"
                style={{ fontSize: 14, lineHeight: 1 }}
              >
                ✕
              </button>
              <div className="flex items-center gap-1.5 mb-1.5 pr-5">
                <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "#FBBF24" }} />
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FBBF24" }}>Resposta p/ objeção: {objections[expandedObj].label}</span>
              </div>
              <p style={{ fontSize: "14px", lineHeight: 1.6 }}>{objectionInsert}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // ─── RESULT POPUP ───
  const ResultPopup = showResultPopup && (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-4 rounded-xl p-6 space-y-5"
        style={{ background: "#1C2128", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-white">📊 Resultado da Ligação</h3>
          <p className="text-sm" style={{ color: "#94A3B8" }}>Lead: {lead.nome} · {lead.empreendimento}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "com_interesse", label: "✅ Aproveitado", bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.4)", color: "#86EFAC", hoverBg: "rgba(34,197,94,0.3)" },
            { key: "agendar", label: "📅 Agendar Visita", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", color: "#FCD34D", hoverBg: "rgba(245,158,11,0.3)" },
            { key: "nao_atendeu", label: "🔴 Não Atendeu", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", color: "#FCA5A5", hoverBg: "rgba(239,68,68,0.3)" },
            { key: "sem_interesse", label: "⏭️ Sem Interesse", bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.4)", color: "#9CA3AF", hoverBg: "rgba(107,114,128,0.3)" },
          ].map(r => (
            <button
              key={r.key}
              onClick={() => handlePopupResult(r.key)}
              className="flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                height: 56,
                background: selectedResult === r.key ? r.hoverBg : r.bg,
                border: selectedResult === r.key ? `2px solid ${r.border}` : `1px solid ${r.border}`,
                color: r.color,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <Textarea
          placeholder="📝 Observação (opcional)..."
          value={inlineObs}
          onChange={(e) => setInlineObs(e.target.value)}
          rows={2}
          className="resize-none text-xs"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#E2E8F0", borderRadius: 10 }}
        />

        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1 text-neutral-400 hover:text-white hover:bg-white/5"
            style={{ height: 44, border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={() => { setShowResultPopup(false); setSelectedResult(null); }}
          >
            Cancelar
          </Button>
          {selectedResult && (
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              style={{ height: 44 }}
              onClick={handlePopupConfirm}
            >
              Confirmar e Próximo →
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="relative overflow-hidden" style={{ background: "#0A0F1E" }}>
      {/* ═══ ARENA OVERLAYS ═══ */}
      {showFlash && <div className="round-flash" />}
      {showRound && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-[59] pointer-events-none">
          <div className="round-number">ROUND {sessionLeadsServed + 1}</div>
          <div className="round-sub">{lead?.empreendimento || "Arena"}</div>
        </div>
      )}
      {arenaConfetti.length > 0 && arenaConfetti.map((emoji, i) => (
        <span
          key={`confetti-${i}`}
          className="arena-confetti"
          style={{
            left: `${5 + Math.random() * 90}%`,
            animationDuration: `${1.5 + Math.random() * 1.5}s`,
            animationDelay: `${Math.random() * 0.3}s`,
          }}
        >
          {emoji}
        </span>
      ))}

      <PendingAttemptsBar />

      {/* Milestone */}
      <AnimatePresence>
        {showMilestone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="text-center p-3 rounded-2xl border-2"
            style={{ background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.3)" }}
          >
            <p className="text-lg font-bold text-white">{showMilestone}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subheader — clean */}
      <div className="flex items-center justify-between px-1 py-1" style={{ fontSize: "13px" }}>
        <span className="text-neutral-500">
          Lead <strong className="text-white">#{sessionLeadsServed + 1}</strong> · ROUND {sessionLeadsServed + 1} · {lead.empreendimento}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-emerald-400/70">🔒 Reservado</span>
          <span className="text-[10px] text-neutral-600 flex items-center gap-1"><Clock className="h-3 w-3" />{formatSessionTime(sessionSeconds)}</span>
          {streak >= 2 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#FCA5A5" }}>
              🔥 {streak}x
            </span>
          )}
          {/* Skip button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-neutral-500 hover:text-white hover:bg-white/5 text-[11px]"
            disabled={callActive}
            onClick={async () => {
              if (lead && user) {
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
          >
            <SkipForward className="h-3 w-3" /> Pular
          </Button>
          {/* Finalizar — opens result popup */}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-red-400 hover:bg-red-500/10 text-[11px]"
            onClick={handleOpenResultPopup}
            disabled={finalizando || progress.tentativas === 0}
          >
            <LogOut className="h-3 w-3" /> Finalizar
          </Button>
        </div>
      </div>

      {/* Arena timer — prominent */}
      {callActive && (
        <div className="flex items-center justify-center py-1">
          <div className={`arena-timer ${timerColorClass}`}>
            {formatTimer(callTimer)}
          </div>
        </div>
      )}

      {/* ═══ MOBILE: Tabs ═══ */}
      {isMobile ? (
        <div className="space-y-2">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "#161B22" }}>
            {([
              { key: "lead" as const, label: "Lead", emoji: "👤" },
              { key: "script" as const, label: "Script", emoji: "📋" },
              { key: "whatsapp" as const, label: "Resultado", emoji: "📊" },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setMobileTab(tab.key)}
                className="flex-1 py-2 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: mobileTab === tab.key ? "rgba(59,130,246,0.2)" : "transparent",
                  color: mobileTab === tab.key ? "#93C5FD" : "#6B7280",
                  border: mobileTab === tab.key ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                }}
              >
                {tab.emoji} {tab.label}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={mobileTab}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              {mobileTab === "lead" && LeadColumn}
              {mobileTab === "script" && ToolsColumn}
              {mobileTab === "whatsapp" && ToolsColumn}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        /* ═══ DESKTOP: 2-column layout (55|45) — viewport height ═══ */
        <div
          className={`grid grid-cols-[55fr_45fr] gap-4 ${arenaShake ? "arena-shake" : ""}`}
          style={{ height: "calc(100vh - 200px)", overflow: "hidden" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={lead.id + "-lead"}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              className="overflow-y-auto h-full"
              style={{ scrollbarWidth: "thin" }}
            >
              {LeadColumn}
            </motion.div>
          </AnimatePresence>
          <div className="h-full" style={{ scrollbarWidth: "thin" }}>
            {ToolsColumn}
          </div>
        </div>
      )}

      {/* Result Popup */}
      {ResultPopup}

      {/* Attempt Modal (for Aproveitado / Agendar Visita details) */}
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
          onClose={() => { setShowCoachingModal(false); onBack(); }}
          metrics={sessionMetricsSnapshot}
          onViewLeadsQuentes={() => { setShowCoachingModal(false); onBack(); }}
        />
      )}

      {lead && (
        <CentralComunicacao
          open={comunicacaoOpen}
          onOpenChange={setComunicacaoOpen}
          leadId={lead.id}
          leadNome={lead.nome}
          leadEmpreendimento={lead.empreendimento}
        />
      )}
    </div>
  );
}
