import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Zap, X, ChevronLeft,
  Loader2,
  Filter,
  Trash2, Ban
} from "lucide-react";


import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFocusLeads, type FocusLead, type FocusFilters, type FocusCriteria } from "@/hooks/useFocusLeads";
import StaleDataBadge from "@/components/pipeline/StaleDataBadge";
// date-fns removido — format/addDays não são mais usados após Mudança 4.
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TaskCompletionDialog from "./TaskCompletionDialog";
import { logFocus, newFocusSessionId } from "@/lib/focusTelemetry";
import FocusConfigScreen from "./focus/FocusConfigScreen";
import LeadFocusScreen from "./focus/LeadFocusScreen";
import FocusLoadingSkeleton from "./focus/FocusLoadingSkeleton";
import FocusEmptyState from "./focus/FocusEmptyState";
import FocusFooter from "./focus/FocusFooter";
import FocusFirstTimeTip from "./focus/FocusFirstTimeTip";
import { useFocusKeyboardShortcuts } from "@/hooks/useFocusKeyboardShortcuts";


interface FocusModeModalProps {
  open: boolean;
  onClose: () => void;
  pipelineTipo?: "leads" | "negocios";
  /**
   * Pré-seleciona critérios e pula direto para a fila (sem tela de config).
   * Usado quando um card externo abre FocusMode com filtro específico
   * (ex.: "Leads Sem Tarefa" → ["no_next_step"]).
   */
  initialCriteria?: FocusCriteria[];
}

// TASK_TYPES e QUICK_MESSAGES removidos (Sprint 1 Mudança 4) — fluxo de criação
// de tarefa migrou para TaskCompletionDialog (R3-V2) e scripts agora vivem
// em ScriptsCard (focus/scriptsByStage.ts).


type CriteriaType = FocusCriteria;
// CRITERIA_OPTIONS movido para FocusConfigScreen (Sprint 1 R1).

export default function FocusModeModal({ open, onClose, pipelineTipo = "leads", initialCriteria }: FocusModeModalProps) {
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

  // Discard inline state (Avançar Etapa removido em R3.7 — fluxo agora pelo TaskCompletionDialog Tela 2)
  const [showDiscard, setShowDiscard] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [discardObs, setDiscardObs] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [homiInsight, setHomiInsight] = useState<string | null>(null);
  const [homiLoading, setHomiLoading] = useState(false);

  // Cache de HOMI Insight por sessão: leadId → { insight, mensagem, at }
  // (mensagem fica no cache para futura reutilização, mas não é mais renderizada
  // — bloco Tabs/Follow Up removido em Sprint 1 Mudança 4.)
  const insightCacheRef = useRef<Map<string, { insight: string; mensagem: string; at: number }>>(new Map());
  const INSIGHT_TTL_MS = 4 * 60 * 60 * 1000; // 4h
  // Telemetria: session_id correlaciona opened → advance(s) → closed da mesma jornada.
  const focusSessionIdRef = useRef<string | null>(null);
  const advanceCountRef = useRef<number>(0);
  const pendingOpenedCtxRef = useRef<Record<string, unknown> | null>(null);
  const reloadInFlightRef = useRef<boolean>(false);
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);


  // Overdue task completion dialog
  const [completingOverdue, setCompletingOverdue] = useState<{ id: string; titulo: string } | null>(null);

  // All pending tasks for current lead (overdue + future)
  const [pendingTasks, setPendingTasks] = useState<Array<{ id: string; titulo: string; tipo: string | null; vence_em: string | null; hora_vencimento: string | null }>>([]);
  const [pendingTasksLoading, setPendingTasksLoading] = useState(false);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  // R5 Item 3 — bump quando seta de teclado é usada, para o tooltip dismissar com reason='shortcut_used'.
  const [arrowUsedSignal, setArrowUsedSignal] = useState(0);
  // Sprint 1 R2: contador de leads/tarefas trabalhados nesta sessão (visível no topo do LeadFocusScreen).
  const [workedCount, setWorkedCount] = useState(0);
  // R4 — força exibir FocusEmptyState (após concluir último lead da sessão).
  const [showEmpty, setShowEmpty] = useState(false);
  // Bump após qualquer ação registrada para refrescar TimelineSection sem refetch global.
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);


  const currentLead = leads[currentIndex] ?? null;

  // Load stages for the config screen
  useEffect(() => {
    if (!open) return;
    const hasInitial = !!initialCriteria && initialCriteria.length > 0;
    setConfigPhase(!hasInitial);
    setSelectedCriteria(hasInitial ? initialCriteria! : ["all"]);
    setSelectedStageId("all");
    setCurrentIndex(0);
    setShowEmpty(false);

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
    // Silent counts: carrega TODOS os leads (criteria=["every"]) para alimentar
    // os 4 contadores + badge do critério "Todos". Buckets continuam corretos
    // porque cada lead vem com `state` calculado. Não emite telemetria.
    reloadCounts({ criteria: ["every"], includeUpcoming2d: true });

    // Quando recebido initialCriteria, abrir direto na fila com aquele filtro
    // (replicando a lógica de handleStartFocus sem tela de config).
    if (hasInitial) {
      setWorkedCount(0);
      focusSessionIdRef.current = newFocusSessionId();
      advanceCountRef.current = 0;
      pendingOpenedCtxRef.current = {
        session_id: focusSessionIdRef.current,
        pipeline_tipo: pipelineTipo,
        criteria: initialCriteria,
        stage_id: "all",
        include_upcoming_2d: false,
        source: "external_card",
      };
      reload({ criteria: initialCriteria!, includeUpcoming2d: false });
    }
  }, [open, pipelineTipo]);

  const handleToggleCriteria = (value: CriteriaType) => {
    // "every" e "all" são exclusivos entre si e em relação aos buckets individuais.
    if (value === "every") {
      setSelectedCriteria(["every"] as CriteriaType[]);
      return;
    }
    if (value === "all") {
      setSelectedCriteria(["all"] as CriteriaType[]);
      return;
    }
    let next: CriteriaType[] = selectedCriteria.filter(c => c !== "all" && c !== "every");
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
    setShowEmpty(false);
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

  /** R4 — Reabre Modo Foco filtrado pelos leadIds da categoria clicada no empty state. */
  const handleOpenSuggestion = async (
    category: "visita_sem_followup" | "vence_2d" | "sem_tarefa",
    leadIds: string[]
  ) => {
    setShowEmpty(false);
    setCurrentIndex(0);
    setWorkedCount(0);
    resetActionState();

    focusSessionIdRef.current = newFocusSessionId();
    advanceCountRef.current = 0;
    pendingOpenedCtxRef.current = {
      session_id: focusSessionIdRef.current,
      pipeline_tipo: pipelineTipo,
      criteria: ["every"],
      stage_id: "all",
      include_upcoming_2d: false,
      source: "suggestion_card",
      suggestion_category: category,
      lead_count: leadIds.length,
    };

    await reload({ criteria: ["every"], leadIds });
  };

  const handleBackToConfig = () => {
    setShowEmpty(false);
    setConfigPhase(true);
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

    // Cache hit (TTL 4h) → hidrata insight direto, sem chamar Gemini.
    const cached = insightCacheRef.current.get(currentLead.id);
    if (cached && Date.now() - cached.at < INSIGHT_TTL_MS) {
      setHomiInsight(cached.insight);
      setHomiLoading(false);
      return;
    }

    // Cache miss → estado vazio. Geração agora é on-demand (botão no card).
    setHomiInsight(null);
    setHomiLoading(false);
  }, [currentIndex, leads.length, open, configPhase]);

  // Fetch pending tasks for current lead
  useEffect(() => {
    if (!currentLead?.id || !open || configPhase) {
      setPendingTasks([]);
      setPendingTasksLoading(false);
      return;
    }
    let cancelled = false;
    setPendingTasksLoading(true);
    (async () => {
      const { data } = await supabase
        .from("pipeline_tarefas")
        .select("id, titulo, tipo, vence_em, hora_vencimento")
        .eq("pipeline_lead_id", currentLead.id)
        .eq("status", "pendente")
        .order("vence_em", { ascending: true })
        .limit(20);
      if (!cancelled) {
        setPendingTasks((data || []) as any);
        setPendingTasksLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentLead?.id, open, configPhase, tasksRefreshKey]);

  const fetchHomiSuggestion = useCallback(async (lead: FocusLead) => {
    setHomiLoading(true);
    setHomiInsight(null);


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
      // Memoriza para evitar nova chamada ao voltar/avançar para o mesmo lead na sessão.
      insightCacheRef.current.set(lead.id, { insight, mensagem, at: Date.now() });
    } catch (err) {
      console.error("[FocusMode] HOMI error:", err);
      setHomiInsight("Não foi possível gerar sugestão agora.");

    } finally {
      setHomiLoading(false);
    }
  }, []);

  const handleGenerateInsight = useCallback(() => {
    if (currentLead) fetchHomiSuggestion(currentLead);
  }, [currentLead, fetchHomiSuggestion]);

  const handleRegenerateInsight = useCallback(() => {
    if (!currentLead) return;
    insightCacheRef.current.delete(currentLead.id);
    fetchHomiSuggestion(currentLead);
  }, [currentLead, fetchHomiSuggestion]);

  const resetActionState = useCallback(() => {
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
      // R4 — em vez de fechar, exibe FocusEmptyState rico.
      setShowEmpty(true);
      resetActionState();
    }
  }, [currentIndex, leads, pipelineTipo, resetActionState]);


  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
      resetActionState();
    }
  }, [currentIndex, resetActionState]);

  // handleRegisterActivity / handleCreateTask / handleOpenWhatsApp / handleCopyPhone
  // removidos em Sprint 1 Mudança 4 — fluxo migrou para top strip + TaskCompletionDialog + ScriptsCard.


  const handleCompleteOverdueTask = useCallback(async (
    payload: import("./task-completion/types").CompletionPayload
  ) => {
    if (!completingOverdue || !currentLead || !corretorId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const {
        tipo_contato, resultado, descricao,
        outcome, nova_tarefa, novo_stage_id,
        reason_label, reason_code,
      } = payload;

      // 1) Mark overdue task as concluida — pula quando id sintético
      if (completingOverdue.id !== "no-task") {
        await supabase.from("pipeline_tarefas").update({
          status: "concluida",
          concluida_em: now,
          updated_at: now,
        } as never).eq("id", completingOverdue.id);
      }

      // 2) Touch lead
      await supabase.from("pipeline_leads").update({
        ultima_acao_at: now,
        updated_at: now,
      } as never).eq("id", currentLead.id);

      // 3) Activity capture (sempre)
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

      let toastMsg = "Tarefa concluída ✅";
      let stageChanged = false;

      // 4) outcome=agendar → cria próxima
      if (outcome === "agendar" && nova_tarefa) {
        const TIPO_LABELS_MAP: Record<string, string> = {
          ligacao: "Ligar", whatsapp: "WhatsApp", follow_up: "Follow-up",
          visita: "Visita", proposta: "Proposta", email: "E-mail",
        };
        const [yPt, mPt, dPt] = (nova_tarefa.vence_em || "").split("-");
        const dateSuffix = yPt && mPt && dPt ? ` · ${dPt}/${mPt}` : "";
        const novoTituloTarefa = `${TIPO_LABELS_MAP[nova_tarefa.tipo] || nova_tarefa.tipo}: ${currentLead.name}${dateSuffix}`;
        await supabase.from("pipeline_tarefas").insert({
          pipeline_lead_id: currentLead.id,
          created_by: corretorId,
          responsavel_id: corretorId,
          titulo: novoTituloTarefa,
          tipo: nova_tarefa.tipo,
          descricao: nova_tarefa.obs?.trim() || descricao?.trim() || null,
          vence_em: nova_tarefa.vence_em,
          hora_vencimento: nova_tarefa.hora_vencimento || null,
          status: "pendente",
          prioridade: "media",
        } as never);
        toastMsg = "Tarefa concluída e próxima agendada ✅";
      }

      // 5) outcome=agendar|concluir + stage opcional
      if ((outcome === "agendar" || outcome === "concluir") && novo_stage_id && novo_stage_id !== currentLead.stage_id) {
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

      // 6) outcome=descartar → move pra Descarte
      if (outcome === "descartar") {
        const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
        const motivo = buildMotivoDescarte("reengajavel", reason_label || "Sem motivo informado");
        const descarteStage = stages.find(s => s.tipo === "descarte");
        if (!descarteStage) {
          toast.error("Etapa de Descarte não encontrada.");
        } else {
          const { error } = await supabase.from("pipeline_leads").update({
            stage_id: descarteStage.id,
            stage_changed_at: now,
            updated_at: now,
            motivo_descarte: motivo,
            tipo_descarte: "reengajavel",
            arquivado: false,
          } as never).eq("id", currentLead.id);
          if (!error) {
            await supabase.from("pipeline_historico").insert({
              pipeline_lead_id: currentLead.id,
              stage_anterior_id: currentLead.stage_id,
              stage_novo_id: descarteStage.id,
              movido_por: corretorId,
              observacao: motivo,
            } as never);
            stageChanged = true;
            toastMsg = "Lead descartado ✅";
          } else {
            toast.error("Não foi possível descartar: " + error.message);
          }
        }
      }

      // 7) outcome=inativar → arquiva
      if (outcome === "inativar") {
        const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
        const motivo = buildMotivoDescarte("definitivo", reason_label || "Sem motivo informado");
        const { error } = await supabase.from("pipeline_leads").update({
          motivo_descarte: motivo,
          tipo_descarte: "definitivo",
          arquivado: true,
          ultima_acao_at: now,
          updated_at: now,
        } as never).eq("id", currentLead.id);
        if (!error) {
          toastMsg = "Lead inativado ✅";
        } else {
          toast.error("Não foi possível inativar: " + error.message);
        }
      }

      // 8) Telemetria
      logFocus("task_completion", {
        session_id: focusSessionIdRef.current,
        lead_id: currentLead.id,
        tarefa_id: completingOverdue.id,
        tipo_contato,
        resultado,
        outcome,
        reason_code,
        has_next_task: outcome === "agendar",
        next_tipo: nova_tarefa?.tipo,
        stage_changed: stageChanged,
        descricao_len: (descricao ?? "").length,
      });

      toast.success(toastMsg);
      setCompletingOverdue(null);
      setTasksRefreshKey(k => k + 1);
      setTimelineRefreshKey(k => k + 1);
      setWorkedCount(c => c + 1);
      invalidateTaskQueries(queryClient, currentLead.id);
      setTimeout(() => goToNext(), 800);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao concluir tarefa.");
    } finally {
      setSaving(false);
    }
  }, [completingOverdue, currentLead, corretorId, goToNext, queryClient, stages]);

  // handleOpenWhatsApp e handleCopyPhone removidos — top strip do LeadFocusScreen
  // já tem implementações inline (window.open wa.me + Popover copia telefone).


  const DISCARD_REASONS = [
    "Sem interesse", "Não atende / não responde", "Comprou com concorrente",
    "Sem condição financeira", "Perfil incompatível", "Lead duplicado", "Número inválido", "Outro",
  ];

  // handleAdvanceStage removido em R3.7 — fluxo de mudança de etapa migrou
  // 100% para TaskCompletionDialog (Tela 2 oferece seletor de stage no fluxo de conclusão).

  const handleDiscardLead = useCallback(async () => {
    if (!currentLead || !corretorId || !discardReason) return;
    const descarteStage = stages.find(s => s.tipo === "descarte");
    if (!descarteStage) { toast.error("Estágio de descarte não encontrado."); return; }
    const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
    const labelRaw = discardReason === "Outro"
      ? (discardObs.trim() || "Outro motivo")
      : discardReason;
    const motivoTexto = buildMotivoDescarte("reengajavel", labelRaw);
    setSaving(true);
    try {
      await supabase.from("pipeline_leads").update({
        stage_id: descarteStage.id,
        stage_changed_at: new Date().toISOString(),
        motivo_descarte: motivoTexto,
        tipo_descarte: "reengajavel",
        arquivado: false,
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
        className="dark max-w-full w-full h-full m-0 rounded-none p-0 border-0 gap-0"
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
            <FocusLoadingSkeleton />
          ) : showEmpty || leads.length === 0 ? (
            <FocusEmptyState
              corretorAuthId={corretorId}
              sessionId={focusSessionIdRef.current}
              workedCount={workedCount}
              onOpenSuggestion={handleOpenSuggestion}
              onBackToConfig={handleBackToConfig}
              onClose={handleClose}
            />

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
                  onGenerateInsight={handleGenerateInsight}
                  onRegenerateInsight={handleRegenerateInsight}
                  pendingTasks={pendingTasks}
                  timelineRefreshKey={timelineRefreshKey}
                  onCompleteTask={(id, titulo) => setCompletingOverdue({ id, titulo })}
                  onCompleteNextTask={() => {
                    const t = currentLead.next_pending_task;
                    if (t) {
                      setCompletingOverdue({ id: t.id, titulo: t.titulo });
                    } else {
                      // Sem tarefa pendente — abre TaskCompletionDialog com ID sintético.
                      // handleCompleteOverdueTask trata 'no-task' pulando o UPDATE de pipeline_tarefas.
                      setCompletingOverdue({ id: "no-task", titulo: "Registrar contato e agendar próximo passo" });
                    }
                  }}
                  onCreateNewTask={() => {
                    setCompletingOverdue({ id: "no-task", titulo: "Registrar contato e agendar próximo passo" });
                  }}
                  onAdvanceNextLead={goToNext}

                  panelChildren={
                    <div className="space-y-3">
                  {/* Discard inline (Avançar Etapa removido em R3.7 — fluxo migrou para TaskCompletionDialog Tela 2) */}
                  {showDiscard ? (
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
                  ) : (
                    <button
                      onClick={() => setShowDiscard(true)}
                      className="w-full mt-3 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded-lg transition-colors"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Descartar Lead
                    </button>
                  )}
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
