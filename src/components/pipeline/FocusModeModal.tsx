import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Zap, X, Phone, MessageCircle, Plus, ChevronLeft,
  Loader2, AlertTriangle, Clock, Send,
  ExternalLink, Sparkles, Copy, Check, ChevronRight,
  Filter, ListChecks, CalendarClock, Inbox, Target,
  ArrowRightCircle, Trash2, Ban
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFocusLeads, type FocusLead, type FocusFilters, type FocusCriteria } from "@/hooks/useFocusLeads";
import { format, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const CRITERIA_OPTIONS: { value: CriteriaType; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  { value: "all", label: "Todos", description: "Todos os leads que precisam de atenção", icon: <Target className="w-5 h-5" />, color: "#4F46E5" },
  { value: "overdue_tasks", label: "Tarefas atrasadas", description: "Leads com tarefas vencidas", icon: <CalendarClock className="w-5 h-5" />, color: "#EF4444" },
  { value: "no_tasks", label: "Sem tarefas", description: "Leads sem nenhuma tarefa agendada", icon: <Inbox className="w-5 h-5" />, color: "#F59E0B" },
  { value: "stagnant", label: "Desatualizados", description: "Leads parados na mesma etapa há 5+ dias", icon: <Clock className="w-5 h-5" />, color: "#F97316" },
];

export default function FocusModeModal({ open, onClose, pipelineTipo = "leads" }: FocusModeModalProps) {
  const { user } = useAuth();
  const corretorId = user?.id ?? null;
  const { leads, loading, reload } = useFocusLeads(corretorId, pipelineTipo);

  // Config screen state
  const [configPhase, setConfigPhase] = useState(true);
  const [selectedCriteria, setSelectedCriteria] = useState<CriteriaType[]>(["all"]);
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
  const [activityNote, setActivityNote] = useState("");
  const [tab, setTab] = useState("followup");
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);
  const [activityRegistered, setActivityRegistered] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);

  // Task creation state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState("ligar");
  const [taskDueDate, setTaskDueDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [taskCreated, setTaskCreated] = useState(false);

  const currentLead = leads[currentIndex] ?? null;

  // Load stages for the config screen
  useEffect(() => {
    if (!open) return;
    setConfigPhase(true);
    setSelectedCriteria(["all"]);
    setSelectedStageId("all");
    setCurrentIndex(0);

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
    resetActionState();

    const filters: FocusFilters = {};
    if (selectedStageId !== "all") {
      filters.stageIds = [selectedStageId];
    }
    if (!selectedCriteria.includes("all")) {
      filters.criteria = selectedCriteria;
    }
    await reload(filters);
  };

  useEffect(() => {
    if (!currentLead || !open || configPhase) return;
    fetchHomiSuggestion(currentLead);
  }, [currentIndex, leads.length, open, configPhase]);

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
      setHomiInsight(data?.insight || "");
      setFollowUpText(data?.mensagem || "");
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

  const goToNext = useCallback(() => {
    if (currentIndex < leads.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
      resetActionState();
    } else {
      onClose();
      toast.success("Modo Foco concluído! 🎯 Todos os leads foram revisados.");
    }
  }, [currentIndex, leads.length, onClose, resetActionState]);

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
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar tarefa.");
    } finally {
      setSaving(false);
    }
  }, [currentLead, corretorId, taskTitle, taskType, taskDueDate]);

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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
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
                  style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg, #4F46E5, #7C3AED)" }}
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
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-white/5 h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {configPhase ? (
            /* ═══ CONFIG SCREEN ═══ */
            <div className="flex flex-col items-center justify-start pt-8 sm:pt-12 min-h-full px-4 py-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-lg space-y-6"
              >
                {/* Title */}
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-white font-bold text-xl">Configurar Modo Foco</h2>
                  <p className="text-gray-400 text-sm">Personalize o que você quer trabalhar agora</p>
                </div>

                {/* Criteria selection */}
                <div className="space-y-2">
                  <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5" /> O que quer focar?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CRITERIA_OPTIONS.map((opt) => {
                      const isSelected = selectedCriteria.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleToggleCriteria(opt.value)}
                          className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                          style={{
                            background: isSelected ? `${opt.color}15` : "rgba(255,255,255,0.03)",
                            border: `1.5px solid ${isSelected ? `${opt.color}50` : "rgba(255,255,255,0.06)"}`,
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: isSelected ? `${opt.color}20` : "rgba(255,255,255,0.05)", color: isSelected ? opt.color : "#6b7280" }}
                          >
                            {opt.icon}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold block" style={{ color: isSelected ? "#fff" : "#9ca3af" }}>
                              {opt.label}
                            </span>
                            <span className="text-[10px] leading-tight block mt-0.5" style={{ color: isSelected ? "#94a3b8" : "#6b7280" }}>
                              {opt.description}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="ml-auto shrink-0">
                              <Check className="w-4 h-4" style={{ color: opt.color }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stage filter */}
                <div className="space-y-2">
                  <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" /> Filtrar por etapa
                  </label>
                  <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                    <SelectTrigger
                      className="h-10 text-sm border-0 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#e2e8f0", borderColor: "rgba(255,255,255,0.1)" }}
                    >
                      <SelectValue placeholder="Todas as etapas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as etapas</SelectItem>
                      {stages.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start button */}
                <Button
                  onClick={handleStartFocus}
                  disabled={stagesLoading}
                  className="w-full h-12 text-sm font-bold gap-2 rounded-xl"
                  style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff" }}
                >
                  {stagesLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-4 h-4" /> Iniciar Modo Foco
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
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
                <Button onClick={onClose} style={{ background: "#4F46E5" }}>
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
                className="flex flex-col lg:flex-row items-start justify-center gap-4 sm:gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full"
              >
                {/* LEFT: Lead Info */}
                <div className="w-full lg:w-1/2 rounded-2xl p-5 sm:p-6 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                      style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
                    >
                      {currentLead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-bold text-base sm:text-lg truncate">{currentLead.name}</h3>
                      <span className="text-gray-400 text-xs">{currentLead.stage}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {currentLead.alert_reasons.map((reason, i) => (
                      <Badge
                        key={i}
                        className="text-[10px] font-semibold border-0"
                        style={{
                          background: reason.includes("vencida") ? "rgba(239,68,68,0.15)" : reason.includes("parada") ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.1)",
                          color: reason.includes("vencida") ? "#f87171" : reason.includes("parada") ? "#fbbf24" : "#fb923c",
                        }}
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {reason}
                      </Badge>
                    ))}
                  </div>

                  {currentLead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentLead.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]" style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{currentLead.days_without_contact < 999 ? `${currentLead.days_without_contact}d sem contato` : "Sem contato"}</span>
                    </div>
                    {currentLead.origin && (
                      <div className="text-gray-400 truncate">📍 {currentLead.origin}</div>
                    )}
                    {currentLead.interest && (
                      <div className="text-gray-400 truncate">🏠 {currentLead.interest}</div>
                    )}
                    {currentLead.phone && (
                      <div className="text-gray-400 truncate">📱 {currentLead.phone}</div>
                    )}
                  </div>

                  {/* HOMI Insight */}
                  <div className="rounded-xl p-3.5" style={{ background: "linear-gradient(135deg, rgba(79,70,229,0.1), rgba(124,58,237,0.08))", border: "1px solid rgba(79,70,229,0.2)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-indigo-300 text-xs font-semibold">HOMI Insight</span>
                    </div>
                    {homiLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span className="text-gray-400 text-xs">Analisando histórico do lead...</span>
                      </div>
                    ) : (
                      <p className="text-gray-300 text-xs leading-relaxed">{homiInsight || "Sem insight disponível."}</p>
                    )}
                  </div>
                </div>

                {/* RIGHT: Action Panel */}
                <div className="w-full lg:w-1/2 rounded-2xl p-5 sm:p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                    <TabsList className="w-full bg-transparent border rounded-lg p-1" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                      <TabsTrigger value="followup" className="flex-1 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 rounded-md">
                        💬 Follow Up
                      </TabsTrigger>
                      <TabsTrigger value="call" className="flex-1 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 rounded-md">
                        📞 Ligar
                      </TabsTrigger>
                      <TabsTrigger value="task" className="flex-1 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-400 rounded-md">
                        + Tarefa
                      </TabsTrigger>
                    </TabsList>

                    {/* TAB: Follow Up */}
                    <TabsContent value="followup" className="space-y-3 mt-0">
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_MESSAGES.map((msg, i) => (
                          <button
                            key={i}
                            onClick={() => setFollowUpText(msg.text(currentLead.name.split(" ")[0], currentLead.interest || ""))}
                            className="text-[10px] px-2.5 py-1 rounded-full transition-colors"
                            style={{
                              background: "rgba(79,70,229,0.15)",
                              color: "#a5b4fc",
                              border: "1px solid rgba(79,70,229,0.25)",
                            }}
                          >
                            {msg.label}
                          </button>
                        ))}
                      </div>

                      <Textarea
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                        placeholder={homiLoading ? "Gerando sugestão..." : "Mensagem de follow-up..."}
                        className="min-h-[100px] text-sm border-0 resize-none"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0" }}
                        disabled={homiLoading}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleOpenWhatsApp}
                          disabled={!followUpText.trim() || !currentLead.phone}
                          className="flex-1 gap-2 text-xs h-9"
                          style={{ background: "#25D366", color: "#fff" }}
                        >
                          <Send className="w-3.5 h-3.5" /> WhatsApp
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </Button>
                        <Button
                          onClick={() => handleRegisterActivity("mensagem")}
                          disabled={saving || !followUpText.trim() || activityRegistered}
                          className="flex-1 gap-2 text-xs h-9"
                          style={{ background: activityRegistered ? "#22c55e" : "#4F46E5" }}
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : activityRegistered ? <Check className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                          {activityRegistered ? "Registrado ✓" : "Registrar"}
                        </Button>
                      </div>
                    </TabsContent>

                    {/* TAB: Ligar */}
                    <TabsContent value="call" className="space-y-3 mt-0">
                      {currentLead.phone ? (
                        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <div className="text-center space-y-1">
                            <Phone className="w-6 h-6 mx-auto text-indigo-400" />
                            <p className="text-gray-400 text-[10px]">Ligue do seu celular</p>
                          </div>
                          <button
                            onClick={() => handleCopyPhone(currentLead.phone!)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-colors"
                            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                          >
                            <span className="text-white font-bold text-lg tracking-wider">{currentLead.phone}</span>
                            {phoneCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                          </button>
                          {currentLead.phone2 && (
                            <button
                              onClick={() => handleCopyPhone(currentLead.phone2!)}
                              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              <span className="text-gray-400">{currentLead.phone2}</span>
                              <Copy className="w-3 h-3 text-gray-500" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm text-center py-4">Telefone não cadastrado</p>
                      )}

                      <Textarea
                        value={activityNote}
                        onChange={(e) => setActivityNote(e.target.value)}
                        placeholder="Anotação da ligação..."
                        className="min-h-[70px] text-sm border-0 resize-none"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0" }}
                      />
                      <Button
                        onClick={() => handleRegisterActivity("ligacao")}
                        disabled={saving || !activityNote.trim() || activityRegistered}
                        className="w-full gap-2 text-xs h-9"
                        style={{ background: activityRegistered ? "#22c55e" : "#4F46E5" }}
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : activityRegistered ? <Check className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                        {activityRegistered ? "Ligação registrada ✓" : "Registrar ligação"}
                      </Button>
                    </TabsContent>

                    {/* TAB: Criar Tarefa */}
                    <TabsContent value="task" className="space-y-3 mt-0">
                      {taskCreated && (
                        <div className="flex items-center gap-2 text-xs rounded-lg py-2 px-3" style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>
                          <Check className="w-3.5 h-3.5" /> Tarefa criada com sucesso! Pode criar outra ou avançar.
                        </div>
                      )}
                      <Input
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="Título da tarefa..."
                        className="text-sm border-0 h-9"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0" }}
                      />
                      <Select value={taskType} onValueChange={setTaskType}>
                        <SelectTrigger className="text-sm border-0 h-9" style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0" }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        className="text-sm border-0 h-9"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0" }}
                      />
                      <Button
                        onClick={handleCreateTask}
                        disabled={saving || !taskTitle.trim()}
                        className="w-full gap-2 text-xs h-9"
                        style={{ background: "#4F46E5" }}
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Criar tarefa
                      </Button>
                    </TabsContent>
                  </Tabs>

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
                      background: (activityRegistered || taskCreated) ? "linear-gradient(135deg, #4F46E5, #7C3AED)" : "transparent",
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
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
