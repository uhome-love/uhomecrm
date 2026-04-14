import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send, Eye, CalendarPlus, MessageSquare,
  FileText, Calendar, CheckSquare, ArrowRight, StickyNote, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isYesterday, addDays, addHours, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import HomiCopilotCard from "./HomiCopilotCard";

interface Message {
  id: string;
  body: string | null;
  direction: string;
  timestamp: string;
  media_url?: string | null;
}

interface LeadInfo {
  id: string;
  nome: string;
  empreendimento: string | null;
  stage_id: string | null;
  telefone: string;
}

interface ConversationThreadProps {
  leadId: string | null;
  leadInfo: LeadInfo | null;
  messages: Message[];
  onMessageSent: () => void;
}

interface StageInfo {
  id: string;
  nome: string;
}

// --- Helpers ---

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatDateDivider(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

function groupByDate(messages: Message[]) {
  const groups: { date: string; msgs: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const d = new Date(msg.timestamp).toDateString();
    if (d !== currentDate) {
      currentDate = d;
      groups.push({ date: msg.timestamp, msgs: [msg] });
    } else {
      groups[groups.length - 1].msgs.push(msg);
    }
  }
  return groups;
}

// --- Templates ---

const STAGE_TEMPLATES: Record<string, { label: string; templates: string[] }> = {
  "2fcba9be-1188-4a54-9452-394beefdc330": {
    label: "Sem Contato",
    templates: [
      "Olá {nome}! Vi que você demonstrou interesse no {empreendimento}. Posso te ajudar com mais informações? 😊",
      "Boa tarde {nome}! Sou corretor da Uhome Negócios Imobiliários. Gostaria de apresentar o {empreendimento}, que combina muito com o que você busca!",
    ],
  },
  "8e2a3285-70f9-438d-be2d-13b0bf4610c4": {
    label: "Qualificação",
    templates: [
      "Olá {nome}! Tudo bem? Gostaria de entender melhor o que você busca para encontrar a melhor opção para você.",
      "{nome}, tenho algumas informações importantes sobre o {empreendimento}. Posso te enviar agora?",
    ],
  },
  "a857139f-c419-4e37-ae17-5f5e70b21172": {
    label: "Visita Agendada",
    templates: [
      "Olá {nome}! Confirmando nossa visita para {data}. Qualquer dúvida estou à disposição! 😊",
      "{nome}, lembrete da nossa visita amanhã! Estamos te esperando no estande. Confirma presença? 🏠",
    ],
  },
  "a8a1a867-5b0c-414e-9532-8873c4ca5a0f": {
    label: "Proposta",
    templates: [
      "Olá {nome}! Preparei uma proposta especial para você. Posso enviar os detalhes agora?",
      "{nome}, como ficou sua análise da proposta? Posso tirar alguma dúvida para facilitar sua decisão?",
    ],
  },
};

function replaceVars(tpl: string, nome: string, empreendimento: string | null) {
  return tpl
    .replace(/\{nome\}/g, nome)
    .replace(/\{empreendimento\}/g, empreendimento || "nosso empreendimento")
    .replace(/\{data\}/g, format(new Date(), "dd/MM/yyyy", { locale: ptBR }));
}

// --- Time slots ---

function generateTimeSlots() {
  const slots: string[] = [];
  for (let h = 8; h <= 18; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 18) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

// --- Deadline helpers ---

function getDeadline(key: string) {
  const now = new Date();
  switch (key) {
    case "hoje": return setMinutes(setHours(now, 18), 0);
    case "amanha": return setMinutes(setHours(addDays(now, 1), 10), 0);
    case "3dias": return addDays(now, 3);
    case "1semana": return addDays(now, 7);
    default: return addDays(now, 1);
  }
}

// --- Component ---

export default function ConversationThread({ leadId, leadInfo, messages, onMessageSent }: ConversationThreadProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [stages, setStages] = useState<StageInfo[]>([]);

  // Dialog/popover states
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("10:00");
  const [visitLocal, setVisitLocal] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("amanha");

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  // Fetch profiles.id + stages once on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      if (data) setProfileId(data.id);
    })();
    (async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, nome")
        .eq("pipeline_tipo", "leads")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (data) setStages(data);
    })();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset visit form when dialog opens
  useEffect(() => {
    if (visitOpen && leadInfo) {
      setVisitDate(format(new Date(), "yyyy-MM-dd"));
      setVisitTime("10:00");
      setVisitLocal(leadInfo.empreendimento || "");
    }
  }, [visitOpen, leadInfo]);

  const handleSend = async () => {
    if (!text.trim() || !leadInfo || !profileId) return;
    setSending(true);
    try {
      if (isNoteMode) {
        // Internal note — do NOT call whatsapp-send
        await supabase.from("whatsapp_mensagens").insert({
          lead_id: leadId,
          corretor_id: profileId,
          direction: "note",
          body: text.trim(),
          timestamp: new Date().toISOString(),
        });
      } else {
        const { error } = await supabase.functions.invoke("whatsapp-send", {
          body: { telefone: leadInfo.telefone, mensagem: text.trim() },
        });
        if (error) throw error;
        await supabase.from("whatsapp_mensagens").insert({
          lead_id: leadId,
          corretor_id: profileId,
          direction: "sent",
          body: text.trim(),
          timestamp: new Date().toISOString(),
        });
      }
      setText("");
      if (isNoteMode) setIsNoteMode(false);
      onMessageSent();
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Tente novamente"));
    } finally {
      setSending(false);
    }
  };

  const handleUseTemplate = (tpl: string) => {
    if (!leadInfo) return;
    setText(replaceVars(tpl, leadInfo.nome, leadInfo.empreendimento));
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleScheduleVisit = async () => {
    if (!leadInfo || !profileId || !visitDate || !visitTime) return;
    const [h, m] = visitTime.split(":").map(Number);
    const dt = setMinutes(setHours(new Date(visitDate + "T00:00:00"), h), m);

    try {
      await supabase.from("visitas").insert({
        lead_id: leadId,
        corretor_id: profileId,
        data_visita: dt.toISOString(),
        empreendimento: visitLocal || leadInfo.empreendimento,
        status: "agendada",
      });
      // Move to Visita stage
      const visitaStage = stages.find(s => s.nome.toLowerCase().includes("visita"));
      if (visitaStage) {
        await supabase.from("pipeline_leads").update({ stage_id: visitaStage.id }).eq("id", leadInfo.id);
      }
      setText(replaceVars(
        "Olá {nome}! Confirmando nossa visita para {data}. Qualquer dúvida estou à disposição! 😊",
        leadInfo.nome,
        leadInfo.empreendimento,
      ).replace("{data}", format(dt, "dd/MM 'às' HH:mm", { locale: ptBR })));
      toast.success("✅ Visita agendada!");
      setVisitOpen(false);
    } catch (err: any) {
      toast.error("Erro ao agendar: " + (err.message || ""));
    }
  };

  const handleCreateTask = async () => {
    if (!leadInfo || !profileId || !taskTitle.trim()) return;
    try {
      await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: leadId,
        titulo: taskTitle.trim(),
        tipo: "follow_up",
        status: "pendente",
        vence_em: getDeadline(taskDeadline).toISOString(),
        created_by: profileId,
      });
      toast.success("✅ Tarefa criada!");
      setTaskTitle("");
      setTaskDeadline("amanha");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    }
  };

  const handleMoveStage = async (stage: StageInfo) => {
    if (!leadInfo) return;
    try {
      await supabase.from("pipeline_leads").update({ stage_id: stage.id }).eq("id", leadInfo.id);
      toast.success(`✅ Lead movido para ${stage.nome}`);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    }
  };

  // Empty state
  if (!leadId || !leadInfo) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center space-y-2">
          <MessageSquare size={40} className="mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
        </div>
      </div>
    );
  }

  const sorted = [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const groups = groupByDate(sorted);
  const lastMsg = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const lastReceived = [...sorted].reverse().find(m => m.direction === "received");
  const showCopilot = lastMsg?.direction === "received" || (sorted.length > 0 && sorted.slice(-5).some(m => m.direction === "received"));

  // Templates for current stage
  const currentStageTemplates = leadInfo.stage_id && STAGE_TEMPLATES[leadInfo.stage_id]
    ? STAGE_TEMPLATES[leadInfo.stage_id]
    : null;
  // Also show "Sem Contato" as fallback
  const fallbackTemplates = STAGE_TEMPLATES["2fcba9be-1188-4a54-9452-394beefdc330"];

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden min-h-0">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(leadInfo.nome)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-semibold">{leadInfo.nome}</h3>
            <div className="flex items-center gap-1.5">
              {leadInfo.empreendimento && (
                <Badge variant="secondary" className="text-[10px] h-4">{leadInfo.empreendimento}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(`/pipeline?lead=${leadInfo.id}`)}>
            <Eye size={12} /> Pipeline
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
        {groups.map((group, gi) => (
          <div key={gi}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                {formatDateDivider(group.date)}
              </span>
            </div>
            {group.msgs.map(msg => {
              if (msg.direction === "note") {
                return (
                  <div key={msg.id} className="flex mb-1.5 justify-end">
                    <div className="max-w-[75%] rounded-lg px-3 py-1.5 text-xs bg-amber-100 border border-amber-300 text-amber-900 rounded-br-sm">
                      <span className="block text-[9px] font-medium text-amber-700 mb-0.5">Nota interna 🔒</span>
                      {msg.body}
                      <span className="block text-[9px] mt-0.5 text-amber-600">
                        {format(new Date(msg.timestamp), "HH:mm")}
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id} className={`flex mb-1.5 ${msg.direction === "sent" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-1.5 text-xs ${
                      msg.direction === "sent"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.body || (msg.media_url ? "📎 Mídia" : "...")}
                    <span className={`block text-[9px] mt-0.5 ${
                      msg.direction === "sent" ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}>
                      {format(new Date(msg.timestamp), "HH:mm")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        )}
      </div>

      {/* Copilot */}
      {showCopilot && lastReceived && (
        <div className="flex-shrink-0 max-h-[180px] overflow-y-auto">
          <HomiCopilotCard
            leadId={leadInfo.id}
            leadName={leadInfo.nome}
            lastMessage={lastReceived.body || ""}
            onUseSuggestion={(s) => setText(s)}
          />
        </div>
      )}

      {/* Quick Action Bar */}
      <TooltipProvider delayDuration={300}>
        <div className="px-3 py-1.5 border-t border-border bg-muted/30 flex items-center gap-1 flex-shrink-0">
          {/* Templates */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <FileText size={14} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Templates</p></TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80 max-h-64 overflow-y-auto p-2" align="start">
              <p className="text-xs font-semibold mb-2 text-muted-foreground">Templates rápidos</p>
              {currentStageTemplates && (
                <div className="mb-2">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">{currentStageTemplates.label}</p>
                  {currentStageTemplates.templates.map((tpl, i) => (
                    <button
                      key={i}
                      className="w-full text-left text-xs p-2 rounded hover:bg-muted transition-colors mb-1"
                      onClick={() => handleUseTemplate(tpl)}
                    >
                      {replaceVars(tpl, leadInfo.nome, leadInfo.empreendimento).slice(0, 80)}...
                    </button>
                  ))}
                </div>
              )}
              {(!currentStageTemplates || currentStageTemplates.label !== fallbackTemplates.label) && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">{fallbackTemplates.label}</p>
                  {fallbackTemplates.templates.map((tpl, i) => (
                    <button
                      key={`fb-${i}`}
                      className="w-full text-left text-xs p-2 rounded hover:bg-muted transition-colors mb-1"
                      onClick={() => handleUseTemplate(tpl)}
                    >
                      {replaceVars(tpl, leadInfo.nome, leadInfo.empreendimento).slice(0, 80)}...
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Visita */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVisitOpen(true)}>
                <Calendar size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-xs">Agendar Visita</p></TooltipContent>
          </Tooltip>

          {/* Tarefa */}
          <Popover onOpenChange={(open) => {
            if (open && leadInfo) setTaskTitle(`Follow-up com ${leadInfo.nome}`);
          }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <CheckSquare size={14} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Criar Tarefa</p></TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64 p-3" align="start">
              <p className="text-xs font-semibold mb-2">Nova tarefa</p>
              <Input
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder={`Follow-up com ${leadInfo.nome}`}
                className="text-xs h-8 mb-2"
              />
              <Select value={taskDeadline} onValueChange={setTaskDeadline}>
                <SelectTrigger className="h-8 text-xs mb-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje (18h)</SelectItem>
                  <SelectItem value="amanha">Amanhã (10h)</SelectItem>
                  <SelectItem value="3dias">Em 3 dias</SelectItem>
                  <SelectItem value="1semana">Em 1 semana</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreateTask} disabled={!taskTitle.trim()}>
                Criar
              </Button>
            </PopoverContent>
          </Popover>

          {/* Etapa */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <ArrowRight size={14} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Mover Etapa</p></TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48 p-2" align="start">
              <p className="text-xs font-semibold mb-2">Mover para</p>
              <div className="space-y-0.5">
                {stages.map(s => (
                  <button
                    key={s.id}
                    className={`w-full text-left text-xs p-1.5 rounded transition-colors ${
                      s.id === leadInfo.stage_id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => handleMoveStage(s)}
                  >
                    {s.id === leadInfo.stage_id ? `● ${s.nome}` : s.nome}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Nota */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isNoteMode ? "default" : "ghost"}
                className={`h-7 w-7 ${isNoteMode ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                onClick={() => setIsNoteMode(!isNoteMode)}
              >
                <StickyNote size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-xs">{isNoteMode ? "Desativar nota" : "Nota Interna"}</p></TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card flex gap-2 flex-shrink-0">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={isNoteMode ? "Nota interna (não enviada ao lead)..." : "Digite sua mensagem..."}
          className={`min-h-[40px] max-h-[100px] resize-none text-xs flex-1 ${
            isNoteMode ? "bg-amber-50 border-amber-300 focus-visible:ring-amber-400" : ""
          }`}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          size="icon"
          className={`h-10 w-10 shrink-0 ${isNoteMode ? "bg-amber-500 hover:bg-amber-600" : ""}`}
          disabled={!text.trim() || sending}
          onClick={handleSend}
        >
          {isNoteMode ? <Lock size={16} /> : <Send size={16} />}
        </Button>
      </div>

      {/* Visit Dialog */}
      <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Agendar Visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Data</label>
              <Input
                type="date"
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Hora</label>
              <Select value={visitTime} onValueChange={setVisitTime}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Local</label>
              <Input
                value={visitLocal}
                onChange={e => setVisitLocal(e.target.value)}
                placeholder="Empreendimento / estande"
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setVisitOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleScheduleVisit} disabled={!visitDate}>Confirmar Visita</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
