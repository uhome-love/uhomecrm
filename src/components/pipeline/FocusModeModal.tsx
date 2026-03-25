import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Zap, X, Phone, MessageCircle, Plus, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle, Clock, Send, SkipForward, CalendarIcon,
  ExternalLink, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFocusLeads, type FocusLead } from "@/hooks/useFocusLeads";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
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

export default function FocusModeModal({ open, onClose, pipelineTipo = "leads" }: FocusModeModalProps) {
  const { user } = useAuth();
  const corretorId = user?.id ?? null;
  const { leads, loading, reload } = useFocusLeads(corretorId, pipelineTipo);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [homiInsight, setHomiInsight] = useState("");
  const [followUpText, setFollowUpText] = useState("");
  const [homiLoading, setHomiLoading] = useState(false);
  const [activityNote, setActivityNote] = useState("");
  const [tab, setTab] = useState("followup");
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);

  // Task creation state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState("ligar");
  const [taskDueDate, setTaskDueDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));

  const currentLead = leads[currentIndex] ?? null;

  // Load focus leads when modal opens
  useEffect(() => {
    if (open && corretorId) {
      setCurrentIndex(0);
      reload();
    }
  }, [open, corretorId]);

  // Fetch HOMI suggestion when lead changes
  useEffect(() => {
    if (!currentLead || !open) return;
    fetchHomiSuggestion(currentLead);
  }, [currentIndex, leads.length, open]);

  const fetchHomiSuggestion = useCallback(async (lead: FocusLead) => {
    setHomiLoading(true);
    setHomiInsight("");
    setFollowUpText("");

    try {
      // Fetch real history: last 10 activities + last 5 tasks
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

  // ── Actions ──

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

      // Update ultima_acao_at
      await supabase
        .from("pipeline_leads")
        .update({ ultima_acao_at: new Date().toISOString() })
        .eq("id", currentLead.id);

      toast.success("Atividade registrada!");
      goToNext();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar atividade.");
    } finally {
      setSaving(false);
    }
  }, [currentLead, corretorId, followUpText, activityNote, goToNext]);

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

      toast.success("Tarefa criada!");
      goToNext();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar tarefa.");
    } finally {
      setSaving(false);
    }
  }, [currentLead, corretorId, taskTitle, taskType, taskDueDate, goToNext]);

  const handleOpenWhatsApp = useCallback(() => {
    if (!currentLead?.phone) return;
    const phone = currentLead.phone.replace(/\D/g, "");
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(followUpText)}`;
    window.open(url, "_blank");
  }, [currentLead, followUpText]);

  const handleCall = useCallback(() => {
    if (!currentLead?.phone) return;
    window.open(`tel:${currentLead.phone}`, "_self");
  }, [currentLead]);

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
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm sm:text-base">Modo Foco</span>
            {leads.length > 0 && (
              <span className="text-gray-400 text-xs sm:text-sm font-medium">
                {currentIndex + 1} / {leads.length}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex-1 mx-4 sm:mx-8 max-w-md">
            <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <Button variant="ghost" size="icon" onClick={goToPrev} className="text-gray-400 hover:text-white hover:bg-white/5 h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-white/5 h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ═══ BODY ═══ */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
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
                Nenhum lead precisa de atenção agora. Continue com o bom trabalho!
              </span>
              <Button onClick={onClose} className="mt-4" style={{ background: "#4F46E5" }}>
                Fechar
              </Button>
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
                {/* ── LEFT: Lead Info Card ── */}
                <div className="w-full lg:w-1/2 rounded-2xl p-5 sm:p-6 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {/* Avatar + Name */}
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

                  {/* Alert badges */}
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

                  {/* Tags */}
                  {currentLead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentLead.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]" style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Lead info lines */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{currentLead.days_without_contact < 999 ? `${currentLead.days_without_contact}d sem contato` : "Sem contato"}</span>
                    </div>
                    {currentLead.origin && (
                      <div className="text-gray-400 truncate">
                        📍 {currentLead.origin}
                      </div>
                    )}
                    {currentLead.interest && (
                      <div className="text-gray-400 truncate">
                        🏠 {currentLead.interest}
                      </div>
                    )}
                    {currentLead.phone && (
                      <div className="text-gray-400 truncate">
                        📱 {currentLead.phone}
                      </div>
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
                        <span className="text-gray-400 text-xs">Analisando lead...</span>
                      </div>
                    ) : (
                      <p className="text-gray-300 text-xs leading-relaxed">{homiInsight || "Sem insight disponível."}</p>
                    )}
                  </div>
                </div>

                {/* ── RIGHT: Action Panel ── */}
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
                      <Textarea
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                        placeholder={homiLoading ? "Gerando sugestão..." : "Mensagem de follow-up..."}
                        className="min-h-[120px] text-sm border-0 resize-none"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "#e2e8f0",
                        }}
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
                          disabled={saving || !followUpText.trim()}
                          className="flex-1 gap-2 text-xs h-9"
                          style={{ background: "#4F46E5" }}
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                          Registrar e avançar
                        </Button>
                      </div>
                    </TabsContent>

                    {/* TAB: Ligar */}
                    <TabsContent value="call" className="space-y-3 mt-0">
                      {currentLead.phone ? (
                        <div className="rounded-xl p-4 text-center space-y-2" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <Phone className="w-8 h-8 mx-auto text-indigo-400" />
                          <p className="text-white font-bold text-lg tracking-wide">{currentLead.phone}</p>
                          {currentLead.phone2 && (
                            <p className="text-gray-400 text-xs">{currentLead.phone2}</p>
                          )}
                          <Button
                            onClick={handleCall}
                            className="gap-2 text-xs"
                            style={{ background: "#4F46E5" }}
                          >
                            <Phone className="w-3.5 h-3.5" /> Iniciar ligação
                          </Button>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm text-center py-4">Telefone não cadastrado</p>
                      )}

                      <Textarea
                        value={activityNote}
                        onChange={(e) => setActivityNote(e.target.value)}
                        placeholder="Anotação da ligação..."
                        className="min-h-[80px] text-sm border-0 resize-none"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#e2e8f0" }}
                      />
                      <Button
                        onClick={() => handleRegisterActivity("ligacao")}
                        disabled={saving || !activityNote.trim()}
                        className="w-full gap-2 text-xs h-9"
                        style={{ background: "#4F46E5" }}
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                        Registrar ligação e avançar
                      </Button>
                    </TabsContent>

                    {/* TAB: Criar Tarefa */}
                    <TabsContent value="task" className="space-y-3 mt-0">
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
                        Criar tarefa e avançar
                      </Button>
                    </TabsContent>
                  </Tabs>

                  {/* Skip button */}
                  <button
                    onClick={goToNext}
                    className="w-full mt-4 text-center text-xs text-gray-500 hover:text-gray-300 transition-colors py-2"
                  >
                    Pular sem ação →
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
