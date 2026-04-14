import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ConversationList, { type ConversationItem } from "@/components/whatsapp/ConversationList";
import ConversationThread from "@/components/whatsapp/ConversationThread";
import LeadPanel from "@/components/whatsapp/LeadPanel";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeadInfo {
  id: string;
  nome: string;
  telefone: string;
  empreendimento: string | null;
  stage_id: string | null;
  segmento_id: string | null;
  lead_score: number | null;
  valor_estimado: number | null;
  bairro_regiao: string | null;
}

interface Message {
  id: string;
  body: string | null;
  direction: string;
  timestamp: string;
  media_url?: string | null;
}

export default function WhatsAppInbox() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(searchParams.get("lead"));
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  // Load conversations list
  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("whatsapp_mensagens")
      .select("lead_id, body, direction, timestamp")
      .order("timestamp", { ascending: false })
      .limit(1000);

    if (!data || data.length === 0) {
      setConversations([]);
      setLoadingConvs(false);
      return;
    }

    // Group by lead_id
    const map = new Map<string, { msgs: typeof data; lastTs: string }>();
    for (const m of data) {
      if (!m.lead_id) continue;
      const existing = map.get(m.lead_id);
      if (!existing) {
        map.set(m.lead_id, { msgs: [m], lastTs: m.timestamp });
      } else {
        existing.msgs.push(m);
      }
    }

    // Fetch lead names
    const leadIds = Array.from(map.keys());
    const { data: leads } = await supabase
      .from("pipeline_leads")
      .select("id, nome, empreendimento")
      .in("id", leadIds);

    const typedLeads = (leads || []) as { id: string; nome: string; empreendimento: string | null }[];
    const leadMap = new Map(typedLeads.map(l => [l.id, l]));

    const items: ConversationItem[] = [];
    for (const [leadId, info] of map.entries()) {
      const lead = leadMap.get(leadId);
      const lastMsg = info.msgs[0];
      items.push({
        leadId,
        leadName: lead?.nome || "Lead desconhecido",
        empreendimento: lead?.empreendimento || null,
        lastMessage: lastMsg.body || "",
        lastTimestamp: lastMsg.timestamp,
        totalMessages: info.msgs.length,
        unreadCount: 0, // placeholder
      });
    }

    items.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
    setConversations(items);
    setLoadingConvs(false);
  }, []);

  // Load thread for selected lead
  const loadThread = useCallback(async (leadId: string) => {
    const [msgRes, leadRes] = await Promise.all([
      supabase
        .from("whatsapp_mensagens")
        .select("id, body, direction, timestamp, media_url")
        .eq("lead_id", leadId)
        .order("timestamp", { ascending: true })
        .limit(200),
      supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento, stage_id, segmento_id, lead_score, valor_estimado, bairro_regiao")
        .eq("id", leadId)
        .maybeSingle(),
    ]);

    setMessages((msgRes.data as Message[]) || []);
    setLeadInfo(leadRes.data as LeadInfo | null);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedLeadId) {
      loadThread(selectedLeadId);
      setMobileView("thread");
    }
  }, [selectedLeadId, loadThread]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-inbox-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_mensagens" },
        (payload) => {
          const newMsg = payload.new as any;
          // Update thread if viewing this lead
          if (newMsg.lead_id === selectedLeadId) {
            setMessages(prev => [...prev, {
              id: newMsg.id,
              body: newMsg.body,
              direction: newMsg.direction,
              timestamp: newMsg.timestamp,
              media_url: newMsg.media_url,
            }]);
          }
          // Refresh conversation list
          loadConversations();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedLeadId, loadConversations]);

  const handleSelect = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  // Mobile: show list or thread
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Mobile back button */}
      {isMobile && mobileView === "thread" && (
        <div className="p-2 border-b border-border bg-card md:hidden">
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setMobileView("list")}>
            <ArrowLeft size={14} /> Voltar
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Column 1 — List */}
        <div className={`${isMobile ? (mobileView === "list" ? "flex" : "hidden") : "flex"}`}>
          <ConversationList
            conversations={conversations}
            selectedLeadId={selectedLeadId}
            onSelect={handleSelect}
            loading={loadingConvs}
          />
        </div>

        {/* Column 2 — Thread */}
        <div className={`flex-1 flex ${isMobile ? (mobileView === "thread" ? "flex" : "hidden") : "flex"}`}>
          <ConversationThread
            leadId={selectedLeadId}
            leadInfo={leadInfo ? { id: leadInfo.id, nome: leadInfo.nome, empreendimento: leadInfo.empreendimento, stage_id: leadInfo.stage_id, telefone: leadInfo.telefone } : null}
            messages={messages}
            onMessageSent={() => {
              if (selectedLeadId) loadThread(selectedLeadId);
              loadConversations();
            }}
          />
        </div>

        {/* Column 3 — Lead Panel (hidden on mobile) */}
        {!isMobile && (
          <LeadPanel lead={leadInfo} />
        )}
      </div>
    </div>
  );
}
