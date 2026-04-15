import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send, Eye, CalendarPlus, MessageSquare,
  FileText, Calendar, CheckSquare, ArrowRight, StickyNote, Lock, Paperclip, Loader2, Smile,
  Mic, Square, Search, X, Reply, ChevronDown, Check, CheckCheck,
} from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isYesterday, addDays, addHours, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import HomiCopilotCard from "./HomiCopilotCard";
import MediaRenderer from "./MediaRenderer";

interface Message {
  id: string;
  body: string | null;
  direction: string;
  timestamp: string;
  media_url?: string | null;
  delivery_status?: string | null;
  whatsapp_message_id?: string | null;
  quoted_message_id?: string | null;
  media_type?: string | null;
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
  isReadOnly?: boolean;
  readOnlyCorretorNome?: string;
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

// URL regex for clickable links
const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

// Format WhatsApp-style text: *bold*, _italic_, ~strikethrough~, and clickable links
function formatWhatsAppText(text: string): React.ReactNode {
  // First split by URLs
  const urlParts = text.split(URL_REGEX);
  
  return urlParts.map((segment, si) => {
    // If this segment matches a URL, render as link
    if (URL_REGEX.test(segment)) {
      URL_REGEX.lastIndex = 0; // Reset regex state
      return (
        <a
          key={`url-${si}`}
          href={segment}
          target="_blank"
          rel="noopener noreferrer"
          className="underline break-all hover:opacity-80"
        >
          {segment.length > 60 ? segment.slice(0, 57) + "..." : segment}
        </a>
      );
    }
    
    // Apply WhatsApp formatting to non-URL segments
    const parts = segment.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g);
    return parts.map((part, i) => {
      if (part.startsWith("*") && part.endsWith("*")) {
        return <strong key={`${si}-${i}`}>{part.slice(1, -1)}</strong>;
      }
      if (part.startsWith("_") && part.endsWith("_")) {
        return <em key={`${si}-${i}`}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("~") && part.endsWith("~")) {
        return <del key={`${si}-${i}`}>{part.slice(1, -1)}</del>;
      }
      return part;
    });
  });
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

function getDeadline(key: string, customDate?: string) {
  const now = new Date();
  switch (key) {
    case "hoje": return setMinutes(setHours(now, 18), 0);
    case "amanha": return setMinutes(setHours(addDays(now, 1), 10), 0);
    case "2dias": return setMinutes(setHours(addDays(now, 2), 10), 0);
    case "3dias": return addDays(now, 3);
    case "1semana": return addDays(now, 7);
    case "custom": return customDate ? new Date(customDate + "T10:00:00") : addDays(now, 1);
    default: return addDays(now, 1);
  }
}

// --- Delivery ticks component ---
function DeliveryTicks({ status }: { status?: string | null }) {
  if (!status || status === "sent") {
    return <Check size={12} className="inline-block ml-1 text-primary-foreground/50" />;
  }
  if (status === "delivered") {
    return <CheckCheck size={12} className="inline-block ml-1 text-primary-foreground/50" />;
  }
  if (status === "read") {
    return <CheckCheck size={12} className="inline-block ml-1 text-blue-400" />;
  }
  return null;
}

// --- Component ---

export default function ConversationThread({ leadId, leadInfo, messages, onMessageSent, isReadOnly = false, readOnlyCorretorNome }: ConversationThreadProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const sendingRef = useRef(false);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Search in conversation
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Reply/Quote
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Drag & Drop
  const [isDragging, setIsDragging] = useState(false);

  // Scroll to bottom button
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Profile picture
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

  useEffect(() => {
    setIsNoteMode(false);
    setReplyingTo(null);
    setSearchOpen(false);
    setSearchQuery("");
    setProfilePicUrl(null);

    // Fetch WhatsApp profile picture
    if (leadInfo?.telefone) {
      supabase.functions.invoke("whatsapp-profile-picture", {
        body: { telefone: leadInfo.telefone },
      }).then(({ data }) => {
        if (data?.picture_url) setProfilePicUrl(data.picture_url);
      }).catch(() => {});
    }
  }, [leadId, leadInfo?.telefone]);

  const [stages, setStages] = useState<StageInfo[]>([]);

  // Dialog/popover states
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("10:00");
  const [visitLocal, setVisitLocal] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("amanha");
  const [taskType, setTaskType] = useState("follow_up");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("media");
  const [taskCustomDate, setTaskCustomDate] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const navigate = useNavigate();

  // Fetch profiles.id with retry + stages once on mount
  useEffect(() => {
    const loadProfile = async (retries = 3) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { console.warn("loadProfile: no auth user"); return; }
      const { data, error } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      if (data) {
        setProfileId(data.id);
      } else if (retries > 0) {
        setTimeout(() => loadProfile(retries - 1), 1000);
      }
    };
    loadProfile();
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

  // Scroll detection for "jump to bottom" button
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 150);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Reset visit form when dialog opens
  useEffect(() => {
    if (visitOpen && leadInfo) {
      setVisitDate(format(new Date(), "yyyy-MM-dd"));
      setVisitTime("10:00");
      setVisitLocal(leadInfo.empreendimento || "");
    }
  }, [visitOpen, leadInfo]);

  // --- Audio recording ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")
          ? "audio/ogg; codecs=opus"
          : "audio/webm; codecs=opus",
      });

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size > 0) {
          await sendAudioBlob(blob, mediaRecorder.mimeType);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
      toast.error("Permissão de microfone negada");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const sendAudioBlob = async (blob: Blob, mimeType: string) => {
    if (!leadInfo || !profileId) return;
    setSendingMedia(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const ext = mimeType.includes("ogg") ? "ogg" : "webm";

      const { error, data: sendResult } = await supabase.functions.invoke("whatsapp-send-media", {
        body: {
          telefone: leadInfo.telefone,
          media_base64: base64,
          media_type: mimeType.includes("ogg") ? "audio/ogg" : "audio/webm",
          filename: `audio.${ext}`,
        },
      });

      if (error) throw error;
      if (sendResult?.error) throw new Error(sendResult.error);

      const mediaUrlToStore = sendResult?.media_url || `data:${mimeType};base64,${base64}`;

      await supabase.from("whatsapp_mensagens").insert({
        lead_id: leadId,
        corretor_id: profileId,
        direction: "sent",
        body: "🎤 Áudio",
        media_url: mediaUrlToStore,
        media_type: "audio",
        timestamp: new Date().toISOString(),
        instance_name: sendResult?.instance_name || "evolution",
        whatsapp_message_id: sendResult?.message_id || crypto.randomUUID(),
        delivery_status: "sent",
      });

      onMessageSent();
      toast.success("Áudio enviado!");
    } catch (err: any) {
      console.error("Audio send error:", err);
      toast.error("Erro ao enviar áudio: " + (err.message || ""));
    } finally {
      setSendingMedia(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    if (!profileId) {
      toast.error("Perfil não carregado. Recarregue a página.");
      return;
    }
    if (!leadInfo) {
      toast.error("Dados do lead não disponíveis.");
      return;
    }
    if (sendingRef.current && sending) return;
    sendingRef.current = true;
    setSending(true);

    const msgBody = text.trim();
    const wasNoteMode = isNoteMode;
    const quotedMsg = replyingTo;

    setText("");
    if (wasNoteMode) setIsNoteMode(false);
    setReplyingTo(null);

    try {
      if (wasNoteMode) {
        const { error: noteErr } = await supabase.from("whatsapp_mensagens").insert({
          lead_id: leadId,
          corretor_id: profileId,
          direction: "note",
          body: msgBody,
          timestamp: new Date().toISOString(),
          instance_name: "internal",
          whatsapp_message_id: crypto.randomUUID(),
        });
        if (noteErr) throw new Error(noteErr.message || "Erro ao salvar nota");
        onMessageSent();
      } else {
        const optimisticId = crypto.randomUUID();
        const now = new Date().toISOString();

        const insertPayload: Record<string, unknown> = {
          lead_id: leadId,
          corretor_id: profileId,
          direction: "sent",
          body: msgBody,
          timestamp: now,
          instance_name: "evolution",
          whatsapp_message_id: optimisticId,
          delivery_status: "sent",
        };

        if (quotedMsg?.whatsapp_message_id) {
          insertPayload.quoted_message_id = quotedMsg.whatsapp_message_id;
        }

        await supabase.from("whatsapp_mensagens").insert(insertPayload);
        onMessageSent();

        // Build Evolution send body with optional quote
        const sendBody: Record<string, unknown> = {
          telefone: leadInfo.telefone,
          mensagem: msgBody,
        };
        if (quotedMsg?.whatsapp_message_id) {
          sendBody.quoted_message_id = quotedMsg.whatsapp_message_id;
        }

        supabase.functions.invoke("whatsapp-send", {
          body: sendBody,
        }).then(({ error, data: sendResult }) => {
          if (error || sendResult?.error) {
            console.error("whatsapp-send background error:", error || sendResult?.error);
            toast.error("Mensagem não entregue ao WhatsApp. Tente novamente.");
            return;
          }
          if (sendResult?.message_id && sendResult.message_id !== optimisticId) {
            supabase.from("whatsapp_mensagens")
              .update({
                whatsapp_message_id: sendResult.message_id,
                instance_name: sendResult?.instance_name || "evolution",
              })
              .eq("whatsapp_message_id", optimisticId)
              .then(({ error: upErr }) => {
                if (upErr) console.error("Message ID update error:", upErr);
              });
          }
        });

        supabase.auth.getUser().then(({ data: { user: authUser } }) => {
          if (authUser) {
            supabase.from("pipeline_atividades").insert({
              pipeline_lead_id: leadId,
              tipo: "mensagem",
              titulo: `Mensagem WhatsApp enviada`,
              data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
              prioridade: "media",
              status: "concluida",
              created_by: authUser.id,
            });
          }
        });
      }
    } catch (err: any) {
      console.error("handleSend error:", err);
      toast.error("Erro ao enviar: " + (err.message || "Tente novamente"));
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  // --- Media send handler ---
  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !leadInfo || !profileId) return;
    e.target.value = "";

    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 16MB)");
      return;
    }

    setSendingMedia(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { error, data: sendResult } = await supabase.functions.invoke("whatsapp-send-media", {
        body: {
          telefone: leadInfo.telefone,
          media_base64: base64,
          media_type: file.type,
          filename: file.name,
          caption: text.trim() || undefined,
        },
      });

      if (error) throw error;
      if (sendResult?.error) throw new Error(sendResult.error);

      const mediaUrlToStore = sendResult?.media_url || `data:${file.type};base64,${base64}`;
      const mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document";

      const { error: msgErr } = await supabase.from("whatsapp_mensagens").insert({
        lead_id: leadId,
        corretor_id: profileId,
        direction: "sent",
        body: text.trim() || null,
        media_url: mediaUrlToStore,
        media_type: mediaType,
        timestamp: new Date().toISOString(),
        instance_name: sendResult?.instance_name || "evolution",
        whatsapp_message_id: sendResult?.message_id || crypto.randomUUID(),
        delivery_status: "sent",
      });

      if (msgErr) {
        console.error("Media message insert error:", msgErr);
      }

      setText("");
      toast.success("Mídia enviada!");
      onMessageSent();
    } catch (err: any) {
      console.error("handleMediaSelect error:", err);
      toast.error("Erro ao enviar mídia: " + (err.message || "Tente novamente"));
    } finally {
      setSendingMedia(false);
    }
  };

  // --- Drag & Drop ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(files[0]);
      fileInputRef.current.files = dt.files;
      fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
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
      const { data: { user: authVisitUser } } = await supabase.auth.getUser();
      const { error: visitErr } = await supabase.from("visitas").insert({
        pipeline_lead_id: leadId,
        nome_cliente: leadInfo.nome,
        corretor_id: profileId,
        gerente_id: authVisitUser?.id || profileId,
        created_by: authVisitUser?.id || profileId,
        data_visita: format(dt, "yyyy-MM-dd"),
        hora_visita: visitTime,
        empreendimento: visitLocal || leadInfo.empreendimento || "",
        tipo: "lead",
        status: "marcada",
        origem: "pipeline",
      });
      if (visitErr) throw new Error(visitErr.message || "Erro ao agendar visita");
      if (authVisitUser) {
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: leadId,
          tipo: "visita",
          titulo: `Visita agendada para ${format(dt, "dd/MM 'às' HH:mm", { locale: ptBR })}`,
          data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
          prioridade: "media",
          status: "concluida",
          created_by: authVisitUser.id,
        });
      }
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
      const { data: { user: authTaskUser } } = await supabase.auth.getUser();
      const taskUserId = authTaskUser?.id || profileId;
      const deadlineDate = getDeadline(taskDeadline, taskCustomDate);
      const { error: taskErr } = await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: leadId,
        titulo: taskTitle.trim(),
        tipo: taskType,
        descricao: taskDescription.trim() || null,
        prioridade: taskPriority,
        status: "pendente",
        vence_em: format(deadlineDate, "yyyy-MM-dd"),
        created_by: taskUserId,
        responsavel_id: taskUserId,
      });
      if (taskErr) throw new Error(taskErr.message || "Erro ao criar tarefa");
      toast.success("✅ Tarefa criada!");
      setTaskTitle("");
      setTaskDeadline("amanha");
      setTaskType("follow_up");
      setTaskDescription("");
      setTaskPriority("media");
      setTaskCustomDate("");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    }
  };

  const handleMoveStage = async (stage: StageInfo) => {
    if (!leadInfo) return;
    try {
      await supabase.from("pipeline_leads").update({ stage_id: stage.id }).eq("id", leadInfo.id);
      const { data: { user: stageUser } } = await supabase.auth.getUser();
      if (stageUser) {
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: leadInfo.id,
          tipo: "etapa",
          titulo: `Etapa alterada para ${stage.nome}`,
          data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
          prioridade: "media",
          status: "concluida",
          created_by: stageUser.id,
        });
      }
      toast.success(`✅ Lead movido para ${stage.nome}`);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    }
  };

  // Find quoted message content by whatsapp_message_id
  const getQuotedMessage = (quotedId: string | null | undefined): Message | undefined => {
    if (!quotedId) return undefined;
    return messages.find(m => m.whatsapp_message_id === quotedId);
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

  // Search filter
  const filteredSorted = searchQuery.trim()
    ? sorted.filter(m => m.body?.toLowerCase().includes(searchQuery.toLowerCase()))
    : sorted;

  const groups = groupByDate(filteredSorted);
  const lastReceivedOrSent = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const lastReceived = [...sorted].reverse().find(m => m.direction === "received");
  const showCopilot = sorted.length > 0 && sorted.slice(-8).some(m => m.direction === "received");

  const currentStageTemplates = leadInfo.stage_id && STAGE_TEMPLATES[leadInfo.stage_id]
    ? STAGE_TEMPLATES[leadInfo.stage_id]
    : null;
  const fallbackTemplates = STAGE_TEMPLATES["2fcba9be-1188-4a54-9452-394beefdc330"];

  return (
    <div
      className="flex-1 flex flex-col h-full min-w-0 overflow-hidden min-h-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Read-only banner */}
      {isReadOnly && readOnlyCorretorNome && (
        <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 flex items-center gap-1.5 flex-shrink-0">
          <Eye size={12} className="text-blue-600 dark:text-blue-400" />
          <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
            Modo leitura — conversa de {readOnlyCorretorNome}
          </span>
        </div>
      )}

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
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSearchOpen(!searchOpen)}>
            <Search size={12} />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(`/pipeline?lead=${leadInfo.id}`)}>
            <Eye size={12} /> Pipeline
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-shrink-0">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar na conversa..."
            className="h-7 text-xs flex-1"
            autoFocus
          />
          {searchQuery && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {filteredSorted.length} resultado{filteredSorted.length !== 1 ? "s" : ""}
            </span>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
            <X size={12} />
          </Button>
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Paperclip size={32} className="mx-auto text-primary mb-2" />
            <p className="text-sm font-medium text-primary">Solte o arquivo para enviar</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0 relative" onScroll={handleScroll}>
        {groups.map((group, gi) => (
          <div key={gi}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                {formatDateDivider(group.date)}
              </span>
            </div>
            {group.msgs.map(msg => {
              const quotedMsg = getQuotedMessage(msg.quoted_message_id);

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
                <div
                  key={msg.id}
                  className={`flex mb-1.5 group ${msg.direction === "sent" ? "justify-end" : "justify-start"}`}
                >
                  <div className="flex items-start gap-1 max-w-[75%]">
                    {/* Reply button (appears on hover) */}
                    {msg.direction === "received" && !isReadOnly && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-0.5 rounded hover:bg-muted"
                        onClick={() => { setReplyingTo(msg); textareaRef.current?.focus(); }}
                        title="Responder"
                      >
                        <Reply size={12} className="text-muted-foreground" />
                      </button>
                    )}

                    <div
                      className={`rounded-lg px-3 py-1.5 text-xs ${
                        msg.direction === "sent"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border text-foreground rounded-bl-sm"
                      }`}
                    >
                      {/* Quoted message block */}
                      {quotedMsg && (
                        <div className={`mb-1 px-2 py-1 rounded border-l-2 ${
                          msg.direction === "sent"
                            ? "bg-primary-foreground/10 border-primary-foreground/40"
                            : "bg-muted border-muted-foreground/40"
                        }`}>
                          <p className="text-[9px] truncate opacity-80">
                            {quotedMsg.body?.slice(0, 60) || "📎 Mídia"}
                          </p>
                        </div>
                      )}

                      {msg.media_url ? (
                        <MediaRenderer mediaUrl={msg.media_url} body={msg.body} direction={msg.direction} mediaType={msg.media_type} />
                      ) : (
                        <span>{msg.body ? formatWhatsAppText(msg.body) : "..."}</span>
                      )}
                      <span className={`block text-[9px] mt-0.5 ${
                        msg.direction === "sent" ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}>
                        {format(new Date(msg.timestamp), "HH:mm")}
                        {msg.direction === "sent" && <DeliveryTicks status={msg.delivery_status} />}
                      </span>
                    </div>

                    {/* Reply button for sent messages */}
                    {msg.direction === "sent" && !isReadOnly && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-0.5 rounded hover:bg-muted"
                        onClick={() => { setReplyingTo(msg); textareaRef.current?.focus(); }}
                        title="Responder"
                      >
                        <Reply size={12} className="text-muted-foreground" />
                      </button>
                    )}
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

        {/* Scroll to bottom button */}
        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10 bg-card border border-border shadow-md rounded-full p-2 hover:bg-muted transition-colors"
          >
            <ChevronDown size={16} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Copilot */}
      {showCopilot && (lastReceived || lastReceivedOrSent) && (
        <div className="flex-shrink-0 max-h-[180px] overflow-y-auto">
          <HomiCopilotCard
            leadId={leadInfo.id}
            leadName={leadInfo.nome}
            lastMessage={(lastReceivedOrSent?.body) || ""}
            onUseSuggestion={(s) => setText(s)}
            isReadOnly={isReadOnly}
          />
        </div>
      )}

      {/* Quick Action Bar — hidden in read-only */}
      {!isReadOnly && (
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
            if (open && leadInfo) {
              setTaskTitle(`Follow-up com ${leadInfo.nome}`);
              setTaskType("follow_up");
              setTaskDescription("");
              setTaskPriority("media");
              setTaskDeadline("amanha");
              setTaskCustomDate("");
            }
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
            <PopoverContent className="w-72 p-3" align="start">
              <p className="text-xs font-semibold mb-2">Nova tarefa</p>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger className="h-8 text-xs mb-2">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">📞 Follow-up</SelectItem>
                  <SelectItem value="ligacao">📱 Ligação</SelectItem>
                  <SelectItem value="enviar_material">📄 Enviar material</SelectItem>
                  <SelectItem value="reuniao">🤝 Reunião</SelectItem>
                  <SelectItem value="visita">🏠 Visita</SelectItem>
                  <SelectItem value="outro">📌 Outro</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder={`Follow-up com ${leadInfo.nome}`}
                className="text-xs h-8 mb-2"
              />
              <Textarea
                value={taskDescription}
                onChange={e => setTaskDescription(e.target.value)}
                placeholder="Descrição (opcional)"
                className="text-xs min-h-[40px] max-h-[60px] resize-none mb-2"
              />
              <div className="flex gap-2 mb-2">
                <Select value={taskDeadline} onValueChange={setTaskDeadline}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoje">Hoje (18h)</SelectItem>
                    <SelectItem value="amanha">Amanhã (10h)</SelectItem>
                    <SelectItem value="2dias">Em 2 dias</SelectItem>
                    <SelectItem value="3dias">Em 3 dias</SelectItem>
                    <SelectItem value="1semana">Em 1 semana</SelectItem>
                    <SelectItem value="custom">📅 Data específica</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">🟢 Normal</SelectItem>
                    <SelectItem value="media">🟡 Média</SelectItem>
                    <SelectItem value="alta">🟠 Alta</SelectItem>
                    <SelectItem value="urgente">🔴 Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {taskDeadline === "custom" && (
                <Input
                  type="date"
                  value={taskCustomDate}
                  onChange={e => setTaskCustomDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="h-8 text-xs mb-2"
                />
              )}
              <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreateTask} disabled={!taskTitle.trim() || (taskDeadline === "custom" && !taskCustomDate)}>
                Criar tarefa
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
                className={`h-7 ${isNoteMode ? "bg-amber-500 hover:bg-amber-600 text-white px-2 gap-1" : "w-7"}`}
                onClick={() => setIsNoteMode(!isNoteMode)}
              >
                <StickyNote size={14} />
                {isNoteMode && <span className="text-[10px] font-medium">Nota ON</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-xs">{isNoteMode ? "Desativar nota" : "Nota Interna"}</p></TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
      )}

      {/* Reply preview bar */}
      {replyingTo && (
        <div className="px-3 py-1.5 border-t border-border bg-muted/50 flex items-center gap-2 flex-shrink-0">
          <Reply size={12} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-primary">
              {replyingTo.direction === "sent" ? "Você" : leadInfo.nome}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {replyingTo.body?.slice(0, 60) || "📎 Mídia"}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => setReplyingTo(null)}>
            <X size={10} />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-card flex gap-2 items-end flex-shrink-0">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleMediaSelect}
        />

        {isRecording ? (
          /* Recording UI */
          <div className="flex-1 flex items-center gap-3">
            <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-destructive" onClick={cancelRecording}>
              <X size={16} />
            </Button>
            <div className="flex-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-destructive">{formatRecordingTime(recordingTime)}</span>
              <span className="text-[10px] text-muted-foreground">Gravando...</span>
            </div>
            <Button size="icon" className="h-10 w-10 shrink-0 bg-primary" onClick={stopRecording}>
              <Send size={16} />
            </Button>
          </div>
        ) : (
          /* Normal input */
          <>
            {/* Paperclip button */}
            {!isReadOnly && !isNoteMode && (
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 shrink-0"
                disabled={sendingMedia}
                onClick={() => fileInputRef.current?.click()}
              >
                {sendingMedia ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
              </Button>
            )}
            {/* Emoji picker */}
            {!isReadOnly && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0">
                    <Smile size={16} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto p-0 border-none shadow-xl">
                  <Picker
                    data={data}
                    onEmojiSelect={(emoji: any) => {
                      setText(prev => prev + emoji.native);
                      textareaRef.current?.focus();
                    }}
                    theme="light"
                    locale="pt"
                    previewPosition="none"
                    skinTonePosition="none"
                    maxFrequentRows={2}
                  />
                </PopoverContent>
              </Popover>
            )}
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={isReadOnly ? "Modo leitura — você não pode enviar mensagens" : (isNoteMode ? "Nota interna (não enviada ao lead)..." : "Digite sua mensagem...")}
              className={`min-h-[40px] max-h-[100px] resize-none text-xs flex-1 ${
                isNoteMode ? "bg-amber-50 border-amber-300 focus-visible:ring-amber-400" : ""
              }`}
              disabled={isReadOnly}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {/* Mic button when text is empty, Send button when has text */}
            {!isReadOnly && !text.trim() && !isNoteMode ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 shrink-0"
                disabled={sendingMedia}
                onClick={startRecording}
              >
                <Mic size={16} />
              </Button>
            ) : (
              <Button
                size="icon"
                className={`h-10 w-10 shrink-0 ${isNoteMode ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                disabled={isReadOnly || !text.trim() || sending}
                onClick={handleSend}
              >
                {isNoteMode ? <Lock size={16} /> : <Send size={16} />}
              </Button>
            )}
          </>
        )}
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
