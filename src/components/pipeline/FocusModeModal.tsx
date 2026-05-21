import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Zap, X, ChevronLeft,
  Loader2, AlertTriangle, Clock,
  Sparkles, ChevronRight,
  Filter, ListChecks,
  ArrowRightCircle, Trash2, Ban
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFocusLeads, type FocusLead, type FocusFilters, type FocusCriteria } from "@/hooks/useFocusLeads";
import StaleDataBadge from "@/components/pipeline/StaleDataBadge";
import { format, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TaskCompletionDialog from "./TaskCompletionDialog";
import { logFocus, newFocusSessionId } from "@/lib/focusTelemetry";
import FocusConfigScreen from "./focus/FocusConfigScreen";
import LeadFocusScreen from "./focus/LeadFocusScreen";

interface FocusModeModalProps {
  open: boolean;
  onClose: () => void;
  pipelineTipo?: "leads" | "negocios";
}

const TASK_TYPES = [
  { value: "ligar", label: "📞 Ligação" },
  { value: "whatsapp", label: "💬 WhatsApp" },
  { value: "marcar_visita", label: "🏠 Visita" },
  { value: "enviar_material", label: "📧 Enviar material" },
  { value: "follow_up", label: "📋 Follow-up" },
  { value: "outro", label: "📌 Outro" },
];

const QUICK_MESSAGES = [
  { label: "Primeiro contato", text: (name: string, interest: string) => `Olá ${name}! Tudo bem? Aqui é da Uhome Imóveis. Vi que você se interessou pelo ${interest || "nosso empreendimento"}. Posso te ajudar com mais informações?` },
  { label: "Retomar contato", text: (name: string, interest: string) => `Oi ${name}! Faz um tempinho que conversamos sobre o ${interest || "imóvel"}. Surgiu alguma novidade? Estou à disposição para te ajudar!` },
  { label: "Agendar visita", text: (name: string, interest: string) => `${name}, que tal conhecer pessoalmente o ${interest || "empreendimento"}? Posso agendar uma visita no melhor horário pra você. Qual dia seria bom?` },
  { label: "Condições especiais", text: (name: string, interest: string) => `Oi ${name}! Temos condições especiais para o ${interest || "empreendimento"} essa semana. Quer que eu te mande os detalhes? 😊` },
];

type CriteriaType = FocusCriteria;
// CRITERIA_OPTIONS movido para FocusConfigScreen (Sprint 1 R1).

export default function FocusModeModal({ open, onClose, pipelineTipo = "leads" }: FocusModeModalProps) {
  const { user } = useAuth();
  const corretorId = user?.id ?? null;
  const { leads, loading, reload, staleSince } = useFocusLeads(corretorId, pipelineTipo);
  // Silent counts: separa instância para alimentar contadores da tela de config
  // sem interferir na fila ativa nem disparar telemetria.
  const { leads: countsLeads, loading: countsLoading, reload: reloadCounts } = useFocusLeads(corretorId, pipelineTipo);

  // Config screen state
  const [configPhase, setConfigPhase] = useState(true);
  const [selectedCriteria, setSelectedCriteria] = useState<CriteriaType[]>(["all"]);
  const [includeUpcoming, setIncludeUpcoming] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>("all");
  const [stages, setStages] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);

  // Stage advance / discard state
  const [showAdvanceStage, setShowAdvanceStage] = useState(false);
  const [advanceStageId, setAdvanceStageId] = useState("");
  const [showDiscard, setShowDiscard] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [discardObs, setDiscardObs] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [homiInsight, setHomiInsight] = useState("");
  const [followUpText, setFollowUpText] = useState("");
  const [homiLoading, setHomiLoading] = useState(false);

  // Cache de HOMI Insight por sessão: leadId → { insight, mensagem, at }
  // Evita re-chamar Gemini quando o corretor volta ao mesmo lead (botão "anterior").
  const insightCacheRef = useRef<Map<string, { insight: string; mensagem: string; at: number }>>(new Map());
  const INSIGHT_TTL_MS = 4 * 60 * 60 * 1000; // 4h
  // Telemetria: session_id correlaciona opened → advance(s) → closed da mesma jornada.
  const focusSessionIdRef = useRef<string | null>(null);
  const advanceCountRef = useRef<number>(0);
  // Pending ctx do opened — emitido via useEffect quando reload terminar e leads.length refletir a fila real.
  const pendingOpenedCtxRef = useRef<Record<string, unknown> | null>(null);
  // Rastreia transição loading true→false para garantir que o evento `opened` só é emitido
  // após o reload realmente rodar (não no frame imediato em que configPhase muda).
  const reloadInFlightRef = useRef<boolean>(false);
  const [activityNote, setActivityNote] = useState("");
  const [tab, setTab] = useState("followup");
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);
  const [activityRegistered, setActivityRegistered] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);

  // Task creation state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState("ligar");
  const [taskDueDate, setTaskDueDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [taskCreated, setTaskCreated] = useState(false);

  // Overdue task completion dialog
  const [completingOverdue, setCompletingOverdue] = useState<{ id: string; titulo: string } | null>(null);

  // All pending tasks for current lead (overdue + future)
  const [pendingTasks, setPendingTasks] = useState<Array<{ id: string; titulo: string; tipo: string | null; vence_em: string | null; hora_vencimento: string | null }>>([]);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  // Sprint 1 R2: contador de leads/tarefas trabalhados nesta sessão (visível no topo do LeadFocusScreen).
  const [workedCount, setWorkedCount] = useState(0);
  // Bump após qualquer ação registrada para refrescar TimelineSection sem refetch global.
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const currentLead = leads[currentIndex] ?? null;

  // Load stages for the config screen
  useEffect(() => {
    if (!open) return;
    setConfigPhase(true);
    setSelectedCriteria(["all"]);
    setSelectedStageId("all");
    setCurrentIndex(0);
    // Limpa cache de insight quando o modal abre (sessão nova).
    insightCacheRef.current.clear();

    const loadStages = async () => {
      setStagesLoading(true);
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, nome, tipo")
        .eq("pipeline_tipo", pipelineTipo)
        .order("ordem", { ascending: true });
      setStages(data || []);
      setStagesLoading(false);
    };
    loadStages();
    // Silent counts: carrega tudo (incluindo upcoming 2d) para alimentar os badges/contadores
    // da tela de configuração. Não passa criteria (default = "all"), não emite telemetria.
    reloadCounts({ includeUpcoming2d: true });
  }, [open, pipelineTipo]);

  const handleToggleCriteria = (value: CriteriaType) => {
    if (value === "all") {
      setSelectedCriteria(["all"] as CriteriaType[]);
      return;
    }
    let next: CriteriaType[] = selectedCriteria.filter(c => c !== "all");
    if (next.includes(value)) {
      next = next.filter(c => c !== value);
    } else {
      next.push(value);
    }
    if (next.length === 0) next = ["all"] as CriteriaType[];
    setSelectedCriteria(next);
  };

  const handleStartFocus = async () => {
    setConfigPhase(false);
    setCurrentIndex(0);
    setWorkedCount(0);
    resetActionState();

    const filters: FocusFilters = {};
    if (selectedStageId !== "all") {
      filters.stageIds = [selectedStageId];
    }
    if (!selectedCriteria.includes("all")) {
      filters.criteria = selectedCriteria;
    }
    filters.includeUpcoming2d = includeUpcoming;

    // Telemetria: gera session_id ANTES do reload para preservar correlação;
    // o evento `opened` é emitido pelo useEffect abaixo quando a fila estiver hidratada.
    focusSessionIdRef.current = newFocusSessionId();
    advanceCountRef.current = 0;
    pendingOpenedCtxRef.current = {
      session_id: focusSessionIdRef.current,
      pipeline_tipo: pipelineTipo,
      criteria: selectedCriteria,
      stage_id: selectedStageId,
      include_upcoming_2d: includeUpcoming,
    };

    await reload(filters);
  };

  // Emite focus_mode_opened apenas após transição loading: true → false
  // (garante que reload realmente rodou e leads.length reflete a fila real).
  useEffect(() => {
    if (loading) {
      reloadInFlightRef.current = true;
      return;
    }
    if (!reloadInFlightRef.current) return;
    reloadInFlightRef.current = false;
    const pending = pendingOpenedCtxRef.current;
    if (!pending) return;
    logFocus("focus_mode_opened", { ...pending, queue_size: leads.length });
    pendingOpenedCtxRef.current = null;
  }, [loading, leads.length]);

  useEffect(() => {
    if (!currentLead || !open || configPhase) return;

    // Cache hit: hidrata insight sem chamar Gemini novamente.
    const cached = insightCacheRef.current.get(currentLead.id);
    if (cached && Date.now() - cached.at < INSIGHT_TTL_MS) {
      setHomiInsight(cached.insight);
      setFollowUpText(cached.mensagem);
      setHomiLoading(false);
      return;
    }
    fetchHomiSuggestion(currentLead);
  }, [currentIndex, leads.length, open, configPhase]);

  // Fetch pending tasks for current lead
  useEffect(() => {
    if (!currentLead?.id || !open || configPhase) {
      setPendingTasks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pipeline_tarefas")
        .select("id, titulo, tipo, vence_em, hora_vencimento")
        .eq("pipeline_lead_id", currentLead.id)
        .eq("status", "pendente")
        .order("vence_em", { ascending: true })
        .limit(20);
      if (!cancelled) setPendingTasks((data || []) as any);
    })();
    return () => { cancelled = true; };
  }, [currentLead?.id, open, configPhase, tasksRefreshKey]);

  const fetchHomiSuggestion = useCallback(async (lead: FocusLead) => {
    setHomiLoading(true);
    setHomiInsight("");
    setFollowUpText("");

    try {
      const [{ data: atividades }, { data: tarefas }] = await Promise.all([
        supabase
          .from("pipeline_atividades")
          .select("tipo, titulo, descricao, created_at, status")
          .eq("pipeline_lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("pipeline_tarefas")
          .select("titulo, tipo, vence_em, status, created_at")
          .eq("pipeline_lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const historico = (atividades || []).map(a =>
        `[${new Date(a.created_at).toLocaleDateString("pt-BR")}] ${a.tipo}: ${a.titulo}${a.descricao ? ` - ${a.descricao.substring(0, 120)}` : ""}`
      );

      const tarefasResumo = (tarefas || []).map(t =>
        `[${t.status}] ${t.titulo} (${t.tipo || "geral"}) - vence: ${t.vence_em || "sem data"}`
      );

      const { data, error } = await supabase.functions.invoke("homi-focus-suggestion", {
        body: {
          lead: {
            name: lead.name,
            stage: lead.stage,
            origin: lead.origin,
            interest: lead.interest,
            days_without_contact: lead.days_without_contact,
            days_in_stage: lead.days_in_stage,
            alert_reasons: lead.alert_reasons,
            tags: lead.tags,
            historico_atividades: historico,
            tarefas: tarefasResumo,
          },
        },
      });

      if (error) throw error;
      const insight = data?.insight || "";
      const mensagem = data?.mensagem || "";
      setHomiInsight(insight);
      setFollowUpText(mensagem);
      // Memoriza para evitar nova chamada ao voltar/avançar para o mesmo lead na sessão.
      insightCacheRef.current.set(lead.id, { insight, mensagem, at: Date.now() });
    } catch (err) {
      console.error("[FocusMode] HOMI error:", err);
      setFollowUpText("");
      setHomiInsight("Não foi possível gerar sugestão agora.");
    } finally {
      setHomiLoading(false);
    }
  }, []);

  const resetActionState = useCallback(() => {
    setTab("followup");
    setActivityNote("");
    setTaskTitle("");
    setTaskType("ligar");
    setTaskDueDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
    setActivityRegistered(false);
    setTaskCreated(false);
    setPhoneCopied(false);
    setShowAdvanceStage(false);
    setAdvanceStageId("");
    setShowDiscard(false);
    setDiscardReason("");
    setDiscardObs("");
  }, []);

  const handleClose = useCallback(() => {
    // Telemetria: log closed só se houve uma sessão ativa (ignora abre/fecha sem startar).
    if (focusSessionIdRef.current) {
      logFocus("focus_mode_closed", {
        session_id: focusSessionIdRef.current,
        pipeline_tipo: pipelineTipo,
        queue_size: leads.length,
        advance_count: advanceCountRef.current,
        last_index: currentIndex,
        completed: currentIndex >= Math.max(0, leads.length - 1),
      });
      focusSessionIdRef.current = null;
      advanceCountRef.current = 0;
    }
    onClose();
  }, [onClose, pipelineTipo, leads.length, currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < leads.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
      resetActionState();
      advanceCountRef.current += 1;
      if (focusSessionIdRef.current) {
        logFocus("focus_mode_advance", {
          session_id: focusSessionIdRef.current,
          pipeline_tipo: pipelineTipo,
          from_index: currentIndex,
          to_index: currentIndex + 1,
          lead_id: leads[currentIndex]?.id ?? null,
          next_lead_id: leads[currentIndex + 1]?.id ?? null,
        });
      }
    } else {
      handleClose();
      toast.success("Modo Foco concluído! 🎯 Todos os leads foram revisados.");
    }
  }, [currentIndex, leads, pipelineTipo, handleClose, resetActionState]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
      resetActionState();
    }
  }, [currentIndex, resetActionState]);

  const handleRegisterActivity = useCallback(async (type: "ligacao" | "mensagem" | "nota") => {
    if (!currentLead || !corretorId) return;
    const note = type === "mensagem" ? followUpText : activityNote;
    if (!note.trim()) {
      toast.error("Preencha a anotação antes de registrar.");
      return;
    }

    setSaving(true);
    try {
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: currentLead.id,
        created_by: corretorId,
        tipo: type,
        titulo: type === "ligacao" ? "Ligação registrada" : type === "mensagem" ? "Follow-up enviado" : "Anotação",
        descricao: note,
        status: "concluida",
        prioridade: "normal",
      });

      await supabase
        .from("pipeline_leads")
        .update({ ultima_acao_at: new Date().toISOString() })
        .eq("id", currentLead.id);

      toast.success("Atividade registrada! ✅");
      setActivityRegistered(true);
      setWorkedCount((c) => c + 1);
      setTimelineRefreshKey((k) => k + 1);
      // Invalida cache do insight: nova atividade muda o contexto que Gemini analisa.
      insightCacheRef.current.delete(currentLead.id);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar atividade.");
    } finally {
      setSaving(false);
    }
  }, [currentLead, corretorId, followUpText, activityNote]);

  const handleCreateTask = useCallback(async () => {
    if (!currentLead || !corretorId) return;
    if (!taskTitle.trim()) {
      toast.error("Preencha o título da tarefa.");
      return;
    }

    setSaving(true);
    try {
      await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: currentLead.id,
        created_by: corretorId,
        titulo: taskTitle,
        tipo: taskType,
        vence_em: taskDueDate,
        status: "pendente",
        prioridade: "normal",
      });

      toast.success("Tarefa criada! ✅");
      setTaskCreated(true);
      setTaskTitle("");
      setTasksRefreshKey(k => k + 1);
      setTimelineRefreshKey(k => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar tarefa.");
    } finally {
      setSaving(false);
    }
  }, [currentLead, corretorId, taskTitle, taskType, taskDueDate]);

  const handleCompleteOverdueTask = useCallback(async (
    payload: import("./task-completion/types").CompletionPayload
  ) => {
    if (!completingOverdue || !currentLead || !corretorId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { tipo_contato, resultado, descricao, nova_tarefa, novo_stage_id } = payload;

      // 1) Mark overdue task as concluida
      await supabase.from("pipeline_tarefas").update({
        status: "concluida",
        concluida_em: now,
        updated_at: now,
      } as never).eq("id", completingOverdue.id);

      // 2) Touch lead
      await supabase.from("pipeline_leads").update({
        ultima_acao_at: now,
        updated_at: now,
      } as never).eq("id", currentLead.id);

      // 3) Activity capture (estruturada) — sempre registra, mesmo sem descricao.
      //    Ajuste 1: tipo = tipo_contato (NUNCA o resultado), limpa poluição naturalmente.
      const tituloAtividade = `${completingOverdue.titulo} — ${resultado}`;
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: currentLead.id,
        created_by: corretorId,
        tipo: tipo_contato,
        tipo_contato,
        resultado,
        titulo: tituloAtividade,
        descricao: descricao ?? null,
        status: "concluida",
        prioridade: "media",
      } as never);

      // 4) Create next task (sempre — fluxo V2 obrigatório)
      const TIPO_LABELS_MAP: Record<string, string> = {
        ligacao: "Ligar", whatsapp: "WhatsApp", follow_up: "Follow-up",
        visita: "Visita", proposta: "Proposta", email: "E-mail",
      };
      const novoTituloTarefa = `${TIPO_LABELS_MAP[nova_tarefa.tipo] || nova_tarefa.tipo}: ${currentLead.name}`;
      await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: currentLead.id,
        created_by: corretorId,
        responsavel_id: corretorId,
        titulo: novoTituloTarefa,
        tipo: nova_tarefa.tipo,
        descricao: nova_tarefa.obs || null,
        vence_em: nova_tarefa.vence_em,
        hora_vencimento: nova_tarefa.hora_vencimento || null,
        status: "pendente",
        prioridade: "media",
      } as never);

      // 5) Optional stage change (Ajuste 2: telemetria de falha, sem rollback)
      let stageChanged = false;
      if (novo_stage_id && novo_stage_id !== currentLead.stage_id) {
        const { error: stageErr } = await supabase.from("pipeline_leads").update({
          stage_id: novo_stage_id,
          stage_changed_at: now,
          updated_at: now,
        } as never).eq("id", currentLead.id);

        if (stageErr) {
          logFocus("stage_change_failed", {
            session_id: focusSessionIdRef.current,
            lead_id: currentLead.id,
            attempted_stage_id: novo_stage_id,
            current_stage_id: currentLead.stage_id,
            error_message: stageErr.message,
          }, "warn");
          toast.warning("Tarefa concluída, mas etapa não foi alterada.");
        } else {
          stageChanged = true;
          await supabase.from("pipeline_historico").insert({
            pipeline_lead_id: currentLead.id,
            stage_novo_id: novo_stage_id,
            movido_por: corretorId,
            observacao: "Movido via Modo Foco (conclusão de tarefa)",
          });
        }
      }

      // 6) Telemetria estruturada
      logFocus("task_completion", {
        session_id: focusSessionIdRef.current,
        lead_id: currentLead.id,
        tarefa_id: completingOverdue.id,
        tipo_contato,
        resultado,
        has_next_task: true,
        next_tipo: nova_tarefa.tipo,
        stage_changed: stageChanged,
        descricao_len: (descricao ?? "").length,
      });

      toast.success("Tarefa concluída e próxima agendada ✅");
      setCompletingOverdue(null);
      setTasksRefreshKey(k => k + 1);
      setTimelineRefreshKey(k => k + 1);
      setWorkedCount(c => c + 1);
      // Invalida cache HOMI do lead para refletir nova atividade
      queryClient.invalidateQueries({ queryKey: ["homi-insight", currentLead.id] });
      setTimeout(() => goToNext(), 800);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao concluir tarefa.");
    } finally {
      setSaving(false);
    }
  }, [completingOverdue, currentLead, corretorId, goToNext, queryClient]);

  const handleOpenWhatsApp = useCallback(() => {
    if (!currentLead?.phone) return;
    const phone = currentLead.phone.replace(/\D/g, "");
    const fullPhone = phone.length <= 11 ? `55${phone}` : phone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(followUpText)}`;
    window.open(url, "_blank");
  }, [currentLead, followUpText]);

  const handleCopyPhone = useCallback(async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setPhoneCopied(true);
      toast.success("Telefone copiado!");
      setTimeout(() => setPhoneCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar.");
    }
  }, []);

  const DISCARD_REASONS = [
    "Sem interesse", "Não atende / não responde", "Comprou com concorrente",
    "Sem condição financeira", "Perfil incompatível", "Lead duplicado", "Número inválido", "Outro",
  ];

  const handleAdvanceStage = useCallback(async () => {
    if (!currentLead || !corretorId || !advanceStageId) return;
    setSaving(true);
    try {
      await supabase.from("pipeline_leads").update({
        stage_id: advanceStageId,
        stage_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq("id", currentLead.id);
      await supabase.from("pipeline_historico").insert({
        pipeline_lead_id: currentLead.id,
        stage_novo_id: advanceStageId,
        movido_por: corretorId,
        observacao: "Avançado via Modo Foco",
      });
      toast.success("Etapa avançada ✅");
      goToNext();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao avançar etapa.");
    } finally {
      setSaving(false);
    }
  }, [currentLead, corretorId, advanceStageId, goToNext]);

  const handleDiscardLead = useCallback(async () => {
    if (!currentLead || !corretorId || !discardReason) return;
    const descarteStage = stages.find(s => s.tipo === "descarte");
    if (!descarteStage) { toast.error("Estágio de descarte não encontrado."); return; }
    const motivoTexto = discardReason === "Outro"
      ? `Descarte: ${discardObs.trim() || "Outro motivo"}`
      : `Descarte: ${discardReason}`;
    setSaving(true);
    try {
      await supabase.from("pipeline_leads").update({
        stage_id: descarteStage.id,
        stage_changed_at: new Date().toISOString(),
        motivo_descarte: motivoTexto,
        updated_at: new Date().toISOString(),
      } as any).eq("id", currentLead.id);
      await supabase.from("pipeline_historico").insert({
        pipeline_lead_id: currentLead.id,
        stage_novo_id: descarteStage.id,
        movido_por: corretorId,
        observacao: motivoTexto,
      });
      toast.success("Lead descartado");
      goToNext();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao descartar lead.");
    } finally {
      setSaving(false);
    }
  }, [currentLead, corretorId, discardReason, discardObs, stages, goToNext]);

  const progressPercent = leads.length > 0 ? ((currentIndex + 1) / leads.length) * 100 : 0;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-full w-full h-full m-0 rounded-none p-0 border-0 gap-0"
        style={{
          background: "linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4969FF, #7C3AED)" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm sm:text-base">Modo Foco</span>
            {!configPhase && leads.length > 0 && (
              <span className="text-gray-400 text-xs sm:text-sm font-medium">
                {currentIndex + 1} / {leads.length}
              </span>
            )}
          </div>

          {!configPhase && (
            <div className="flex-1 mx-4 sm:mx-8 max-w-md">
              <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg, #4969FF, #7C3AED)" }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {!configPhase && currentIndex > 0 && (
              <Button variant="ghost" size="icon" onClick={goToPrev} className="text-gray-400 hover:text-white hover:bg-white/5 h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            {!configPhase && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfigPhase(true)}
                className="text-gray-400 hover:text-white hover:bg-white/5 h-8 px-2 text-xs gap-1"
              >
                <Filter className="w-3.5 h-3.5" /> Filtros
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleClose} className="text-gray-400 hover:text-white hover:bg-white/5 h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <StaleDataBadge staleSince={staleSince} onRetry={() => reload()} />

        {/* BODY */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {configPhase ? (
            <FocusConfigScreen
              allLeads={countsLeads}
              countsLoading={countsLoading}
              stages={stages}
              stagesLoading={stagesLoading}
              selectedCriteria={selectedCriteria}
              includeUpcoming={includeUpcoming}
              selectedStageId={selectedStageId}
              pipelineTipo={pipelineTipo}
              onToggleCriteria={handleToggleCriteria}
              onToggleIncludeUpcoming={() => setIncludeUpcoming((v) => !v)}
              onSelectStage={setSelectedStageId}
              onStart={handleStartFocus}
            />
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <span className="text-gray-400 text-sm">Buscando leads que precisam de atenção...</span>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                <Zap className="w-8 h-8 text-green-400" />
              </div>
              <span className="text-white font-semibold text-lg">Tudo em dia! 🎉</span>
              <span className="text-gray-400 text-sm text-center max-w-xs">
                Nenhum lead encontrado com esses filtros. Tente outros critérios ou continue com o bom trabalho!
              </span>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => setConfigPhase(true)} variant="outline" className="text-gray-300 border-gray-600 hover:bg-white/5">
                  <Filter className="w-4 h-4 mr-1" /> Mudar filtros
                </Button>
                <Button onClick={handleClose} style={{ background: "#4969FF" }}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : currentLead ? (
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentLead.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 40 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0"
              >
                <LeadFocusScreen
                  lead={currentLead}
                  workedCount={workedCount}
                  homiLoading={homiLoading}
                  homiInsight={homiInsight}
                  pendingTasks={pendingTasks}
                  timelineRefreshKey={timelineRefreshKey}
                  onCompleteTask={(id, titulo) => setCompletingOverdue({ id, titulo })}
                  onCompleteNextTask={() => {
                    const t = currentLead.next_pending_task;
                    if (t) {
                      setCompletingOverdue({ id: t.id, titulo: t.titulo });
                    } else {
                      setTab("task");
                      setTaskTitle(`Follow-up: ${currentLead.name}`);
                    }
                  }}
                  onCreateNewTask={() => {
                    setTab("task");
                    setTaskTitle(`Follow-up: ${currentLead.name}`);
                  }}
                  panelChildren={
                    <div className="space-y-3">


                  {/* Stage advance inline */}
                  {showAdvanceStage && (
                    <div className="mt-3 rounded-xl p-3 space-y-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <p className="text-xs font-semibold text-emerald-400">Avançar para qual etapa?</p>
                      <Select value={advanceStageId} onValueChange={setAdvanceStageId}>
                        <SelectTrigger className="h-8 text-xs border-0" style={{ background: "rgba(255,255,255,0.06)", color: "#e2e8f0" }}>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.filter(s => s.id !== currentLead?.stage_id && s.tipo !== "descarte").map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-8 text-xs gap-1" style={{ background: "#10b981" }} disabled={!advanceStageId || saving} onClick={handleAdvanceStage}>
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightCircle className="w-3 h-3" />} Confirmar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400 hover:text-white hover:bg-white/5" onClick={() => setShowAdvanceStage(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Discard inline */}
                  {showDiscard && (
                    <div className="mt-3 rounded-xl p-3 space-y-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <p className="text-xs font-semibold text-red-400">Motivo do descarte</p>
                      <Select value={discardReason} onValueChange={setDiscardReason}>
                        <SelectTrigger className="h-8 text-xs border-0" style={{ background: "rgba(255,255,255,0.06)", color: "#e2e8f0" }}>
                          <SelectValue placeholder="Selecione o motivo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {DISCARD_REASONS.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {discardReason === "Outro" && (
                        <Input
                          value={discardObs}
                          onChange={(e) => setDiscardObs(e.target.value)}
                          placeholder="Descreva..."
                          className="h-8 text-xs border-0"
                          style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0" }}
                        />
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-8 text-xs gap-1 bg-destructive hover:bg-destructive/90" disabled={!discardReason || saving} onClick={handleDiscardLead}>
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />} Descartar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400 hover:text-white hover:bg-white/5" onClick={() => setShowDiscard(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons row */}
                  {!showAdvanceStage && !showDiscard && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { setShowAdvanceStage(true); setShowDiscard(false); }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded-lg transition-colors"
                        style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}
                      >
                        <ArrowRightCircle className="w-3.5 h-3.5" /> Avançar Etapa
                      </button>
                      <button
                        onClick={() => { setShowDiscard(true); setShowAdvanceStage(false); }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded-lg transition-colors"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Descartar Lead
                      </button>
                    </div>
                  )}

                  {/* Advance to next lead button */}
                  <button
                    onClick={goToNext}
                    className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-lg transition-colors"
                    style={{
                      background: (activityRegistered || taskCreated) ? "linear-gradient(135deg, #4969FF, #7C3AED)" : "transparent",
                      color: (activityRegistered || taskCreated) ? "#fff" : "#6b7280",
                      fontWeight: (activityRegistered || taskCreated) ? 600 : 400,
                    }}
                  >
                    {(activityRegistered || taskCreated) ? (
                      <>Avançar para próximo lead <ChevronRight className="w-3.5 h-3.5" /></>
                    ) : (
                      "Pular sem ação →"
                    )}
                  </button>
                    </div>
                  }
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </DialogContent>

      {completingOverdue && (
        <TaskCompletionDialog
          open={!!completingOverdue}
          onOpenChange={(v) => { if (!v) setCompletingOverdue(null); }}
          tarefaTitulo={completingOverdue.titulo}
          leadNome={currentLead?.name}
          leadId={currentLead?.id}
          currentStageId={currentLead?.stage_id ?? undefined}
          onConfirm={handleCompleteOverdueTask}
        />
      )}
    </Dialog>
  );
}
