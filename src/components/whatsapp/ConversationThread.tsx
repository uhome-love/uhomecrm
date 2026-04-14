import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Eye, CalendarPlus, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
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

export default function ConversationThread({ leadId, leadInfo, messages, onMessageSent }: ConversationThreadProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch profiles.id once on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      if (data) setProfileId(data.id);
    })();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !leadInfo || !profileId) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-send", {
        body: { telefone: leadInfo.telefone, mensagem: text.trim() },
      });
      if (error) throw error;

      // Insert local record using profiles.id as corretor_id
      await supabase.from("whatsapp_mensagens").insert({
        lead_id: leadId,
        corretor_id: profileId,
        direction: "sent",
        body: text.trim(),
        timestamp: new Date().toISOString(),
      });

      setText("");
      onMessageSent();
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Tente novamente"));
    } finally {
      setSending(false);
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

  // Show copilot if last message is received OR if any of the last 5 messages is received
  const lastReceived = [...sorted].reverse().find(m => m.direction === "received");
  const showCopilot = lastMsg?.direction === "received" || (sorted.length > 0 && sorted.slice(-5).some(m => m.direction === "received"));

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card">
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
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
            navigate(`/pipeline?lead=${leadInfo.id}`);
            toast.info("Abra o lead no pipeline para agendar visita");
          }}>
            <CalendarPlus size={12} /> Visita
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {groups.map((group, gi) => (
          <div key={gi}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                {formatDateDivider(group.date)}
              </span>
            </div>
            {group.msgs.map(msg => (
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
            ))}
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
        <HomiCopilotCard
          leadId={leadInfo.id}
          leadName={leadInfo.nome}
          lastMessage={lastReceived.body || ""}
          onUseSuggestion={(s) => setText(s)}
        />
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-card flex gap-2">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="min-h-[40px] max-h-[100px] resize-none text-xs flex-1"
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button size="icon" className="h-10 w-10 shrink-0" disabled={!text.trim() || sending} onClick={handleSend}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
