import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import ConversationList, { type ConversationItem, type FollowUpLead, type NewLead } from "@/components/whatsapp/ConversationList";
import ConversationThread from "@/components/whatsapp/ConversationThread";
import LeadPanel from "@/components/whatsapp/LeadPanel";
import CorretorSelector, { type CorretorInfo } from "@/components/whatsapp/CorretorSelector";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import { usePipeline } from "@/hooks/usePipeline";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXCLUDED_STAGES = [
  "2fcba9be-1188-4a54-9452-394beefdc330",
  "a8a1a867-5b0c-414e-9532-8873c4ca5a0f",
  "1dd66c25-3848-4053-9f66-82e902989b4d",
  "2d7739eb-1787-4ad6-887a-7a4a32dcfc05",
];

const SEM_CONTATO_STAGE = "2fcba9be-1188-4a54-9452-394beefdc330";

// --- Notification sound ---
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 520;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {}
}

function updateUnreadStorage(count: number) {
  localStorage.setItem("whatsapp_unread", String(count));
  window.dispatchEvent(new StorageEvent("storage", { key: "whatsapp_unread", newValue: String(count) }));
}

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
  corretor_id?: string | null;
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
  const { profileId } = useAuthUser();
  const { isGestor, isAdmin } = useUserRole();
  const navigate = useNavigate();
  const pipeline = usePipeline();
  const [modalLeadId, setModalLeadId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [followUpLeads, setFollowUpLeads] = useState<FollowUpLead[]>([]);
  const [newLeads, setNewLeads] = useState<NewLead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(searchParams.get("lead"));
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  // Team management state
  const [corretores, setCorretores] = useState<CorretorInfo[]>([]);
  const [selectedCorretorId, setSelectedCorretorId] = useState<string | null>(null);
  const isTeamView = isGestor || isAdmin;

  // Compute read-only: viewing another corretor's conversation
  const isReadOnly = isTeamView && selectedCorretorId !== null && selectedCorretorId !== profileId;

  // Build corretor map for "Todos" view
  const corretorMap = isTeamView && selectedCorretorId === null
    ? new Map(corretores.map(c => [c.id, c.nome]))
    : undefined;

  // Get selected corretor name for banner
  const selectedCorretorNome = selectedCorretorId
    ? corretores.find(c => c.id === selectedCorretorId)?.nome || ""
    : "";

  // Ref to access selectedLeadId inside realtime callback without stale closure
  const selectedLeadIdRef = useRef(selectedLeadId);
  selectedLeadIdRef.current = selectedLeadId;

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Load team corretores for gestor/admin
  useEffect(() => {
    if (!user?.id || !isTeamView) return;

    const loadCorretores = async () => {
      if (isAdmin) {
        // Admin: all active team members
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("status", "ativo");
        
        if (!members || members.length === 0) { setCorretores([]); return; }
        
        const userIds = members.map(m => m.user_id).filter(Boolean) as string[];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id, nome")
          .in("user_id", userIds)
          .order("nome");
        
        setCorretores((profiles || []).map(p => ({
          id: p.id,
          nome: p.nome || "Sem nome",
          userId: p.user_id || "",
        })));
      } else {
        // Gestor: only their team
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("gerente_id", user.id)
          .eq("status", "ativo");
        
        if (!members || members.length === 0) { setCorretores([]); return; }
        
        const userIds = members.map(m => m.user_id).filter(Boolean) as string[];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id, nome")
          .in("user_id", userIds)
          .order("nome");
        
        setCorretores((profiles || []).map(p => ({
          id: p.id,
          nome: p.nome || "Sem nome",
          userId: p.user_id || "",
        })));
      }
    };

    loadCorretores();
  }, [user?.id, isTeamView, isAdmin]);

  // Determine which profile IDs to query for conversations
  const getTargetProfileIds = useCallback((): string[] | null => {
    if (!isTeamView) {
      // Corretor: own profile only
      return profileId ? [profileId] : null;
    }
    if (selectedCorretorId) {
      // Specific corretor selected
      return [selectedCorretorId];
    }
    // "Todos" — all team corretores + own
    const ids = corretores.map(c => c.id);
    if (profileId && !ids.includes(profileId)) ids.push(profileId);
    return ids.length > 0 ? ids : null;
  }, [isTeamView, profileId, selectedCorretorId, corretores]);

  // Load conversations list + SLA + unread
  const loadConversations = useCallback(async () => {
    const targetIds = getTargetProfileIds();
    if (!targetIds) return;

    let query = supabase
      .from("whatsapp_mensagens")
      .select("lead_id, body, direction, timestamp, corretor_id")
      .order("timestamp", { ascending: false })
      .limit(1000);

    if (targetIds.length === 1) {
      query = query.eq("corretor_id", targetIds[0]);
    } else {
      query = query.in("corretor_id", targetIds);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      setConversations([]);
      setLoadingConvs(false);
      updateUnreadStorage(0);
      return;
    }

    const map = new Map<string, { msgs: typeof data; lastTs: string; corretorId: string | null }>();
    for (const m of data) {
      if (!m.lead_id) continue;
      const existing = map.get(m.lead_id);
      if (!existing) {
        map.set(m.lead_id, { msgs: [m], lastTs: m.timestamp, corretorId: (m as any).corretor_id || null });
      } else {
        existing.msgs.push(m);
      }
    }

    const leadIds = Array.from(map.keys());
    const { data: leads } = await supabase
      .from("pipeline_leads")
      .select("id, nome, empreendimento")
      .in("id", leadIds);

    const typedLeads = (leads || []) as { id: string; nome: string; empreendimento: string | null }[];
    const leadMap = new Map(typedLeads.map(l => [l.id, l]));

    const items: ConversationItem[] = [];
    let unreadTotal = 0;

    for (const [leadId, info] of map.entries()) {
      const lead = leadMap.get(leadId);
      const lastMsg = info.msgs[0];

      let lastReceivedTs: string | null = null;
      const sorted = [...info.msgs];
      if (sorted[0]?.direction === "received") {
        lastReceivedTs = sorted[0].timestamp;
        unreadTotal++;
      }

      items.push({
        leadId,
        leadName: lead?.nome || "Lead desconhecido",
        empreendimento: lead?.empreendimento || null,
        lastMessage: lastMsg.body || "",
        lastTimestamp: lastMsg.timestamp,
        totalMessages: info.msgs.length,
        unreadCount: lastReceivedTs ? 1 : 0,
        lastReceivedTs,
        corretorId: info.corretorId || undefined,
      });
    }

    items.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
    setConversations(items);
    setLoadingConvs(false);
    updateUnreadStorage(unreadTotal);
  }, [getTargetProfileIds]);

  // Load follow-up and new leads (only for own profile, not in team read-only)
  const loadSuggestions = useCallback(async () => {
    if (!user?.id || !profileId || isReadOnly) {
      setFollowUpLeads([]);
      setNewLeads([]);
      return;
    }

    const { data: msgLeads } = await supabase
      .from("whatsapp_mensagens")
      .select("lead_id")
      .eq("corretor_id", profileId)
      .not("lead_id", "is", null);

    const leadsWithMessages = new Set((msgLeads || []).map(m => m.lead_id).filter(Boolean));

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: followUp } = await supabase
      .from("pipeline_leads")
      .select("id, nome, empreendimento, stage_id, updated_at")
      .eq("corretor_id", user.id)
      .not("stage_id", "in", `(${EXCLUDED_STAGES.join(",")})`)
      .lt("updated_at", threeDaysAgo.toISOString())
      .order("updated_at", { ascending: true })
      .limit(20);

    const filteredFollowUp = ((followUp || []) as any[])
      .filter(l => !leadsWithMessages.has(l.id))
      .slice(0, 10)
      .map(l => ({
        id: l.id,
        nome: l.nome,
        empreendimento: l.empreendimento,
        stageName: null as string | null,
        updatedAt: l.updated_at,
      }));

    setFollowUpLeads(filteredFollowUp);

    const { data: newL } = await supabase
      .from("pipeline_leads")
      .select("id, nome, empreendimento, created_at")
      .eq("corretor_id", user.id)
      .eq("stage_id", SEM_CONTATO_STAGE)
      .order("created_at", { ascending: false })
      .limit(15);

    const filteredNew = ((newL || []) as any[])
      .filter(l => !leadsWithMessages.has(l.id))
      .slice(0, 5)
      .map(l => ({
        id: l.id,
        nome: l.nome,
        empreendimento: l.empreendimento,
        createdAt: l.created_at,
      }));

    setNewLeads(filteredNew);
  }, [user?.id, profileId, isReadOnly]);

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
        .select("id, nome, telefone, empreendimento, stage_id, segmento_id, lead_score, valor_estimado, bairro_regiao, corretor_id")
        .eq("id", leadId)
        .maybeSingle(),
    ]);

    setMessages((msgRes.data as Message[]) || []);
    setLeadInfo(leadRes.data as LeadInfo | null);
  }, []);

  useEffect(() => {
    loadConversations();
    loadSuggestions();
  }, [loadConversations, loadSuggestions]);

  useEffect(() => {
    if (selectedLeadId) {
      loadThread(selectedLeadId);
      setMobileView("thread");

      // Mark as read: zero the unreadCount for this lead
      setConversations(prev => {
        const updated = prev.map(c =>
          c.leadId === selectedLeadId && c.unreadCount > 0
            ? { ...c, unreadCount: 0 }
            : c
        );
        const newTotal = updated.filter(c => c.unreadCount > 0).length;
        updateUnreadStorage(newTotal);
        return updated;
      });
    }
  }, [selectedLeadId, loadThread]);

  // Reload conversations when selectedCorretorId changes
  useEffect(() => {
    setLoadingConvs(true);
    setSelectedLeadId(null);
    setLeadInfo(null);
    setMessages([]);
    loadConversations();
    loadSuggestions();
  }, [selectedCorretorId]);

  // Realtime with notifications
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-inbox-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_mensagens" },
        async (payload) => {
          const newMsg = payload.new as any;

          // Add to current thread if viewing this lead
          if (newMsg.lead_id === selectedLeadIdRef.current) {
            setMessages(prev => [...prev, {
              id: newMsg.id,
              body: newMsg.body,
              direction: newMsg.direction,
              timestamp: newMsg.timestamp,
              media_url: newMsg.media_url,
            }]);
          }

          // Notification + sound for received messages from other leads
          if (newMsg.direction === "received" && newMsg.lead_id !== selectedLeadIdRef.current) {
            let leadName = "Novo lead";
            const existing = conversationsRef.current.find(c => c.leadId === newMsg.lead_id);
            if (existing) {
              leadName = existing.leadName;
            } else {
              const { data } = await supabase
                .from("pipeline_leads")
                .select("nome")
                .eq("id", newMsg.lead_id)
                .maybeSingle();
              if (data) leadName = data.nome;
            }

            if ("Notification" in window && Notification.permission === "granted") {
              const preview = (newMsg.body || "Nova mensagem").slice(0, 60);
              const notif = new Notification(leadName, {
                body: preview,
                icon: "/favicon.ico",
              });
              notif.onclick = () => {
                window.focus();
                setSelectedLeadId(newMsg.lead_id);
                notif.close();
              };
            }

            playNotificationSound();
          }

          loadConversations();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadConversations]);

  const handleSelect = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {isMobile && mobileView === "thread" && (
        <div className="p-2 border-b border-border bg-card md:hidden">
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setMobileView("list")}>
            <ArrowLeft size={14} /> Voltar
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className={`flex flex-col ${isMobile ? (mobileView === "list" ? "flex" : "hidden") : "flex"}`}>
          {/* Team corretor selector */}
          {isTeamView && corretores.length > 0 && (
            <div className="w-[290px]">
              <CorretorSelector
                corretores={corretores}
                selectedCorretorId={selectedCorretorId}
                onSelect={setSelectedCorretorId}
              />
            </div>
          )}
          <ConversationList
            conversations={conversations}
            followUpLeads={isReadOnly ? [] : followUpLeads}
            newLeads={isReadOnly ? [] : newLeads}
            selectedLeadId={selectedLeadId}
            onSelect={handleSelect}
            loading={loadingConvs}
            userId={user?.id || null}
            corretorMap={corretorMap}
            corretorIds={getTargetProfileIds() || []}
          />
        </div>

        <div className={`flex-1 flex ${isMobile ? (mobileView === "thread" ? "flex" : "hidden") : "flex"}`}>
          <ConversationThread
            leadId={selectedLeadId}
            leadInfo={leadInfo ? { id: leadInfo.id, nome: leadInfo.nome, empreendimento: leadInfo.empreendimento, stage_id: leadInfo.stage_id, telefone: leadInfo.telefone } : null}
            messages={messages}
            onMessageSent={() => {
              if (selectedLeadId) loadThread(selectedLeadId);
              loadConversations();
            }}
            isReadOnly={isReadOnly}
            readOnlyCorretorNome={selectedCorretorNome}
          />
        </div>

        {!isMobile && (
          <LeadPanel
            lead={leadInfo}
            leadId={selectedLeadId}
            profileId={profileId}
            messages={messages}
            onOpenFullModal={(id) => setModalLeadId(id)}
            isReadOnly={isReadOnly}
          />
        )}
      </div>

      {/* Lead detail modal overlay */}
      {modalLeadId && (() => {
        const modalLead = pipeline.leads.find(l => l.id === modalLeadId);
        if (!modalLead) return null;
        return (
          <PipelineLeadDetail
            lead={modalLead}
            stages={pipeline.stages}
            segmentos={pipeline.segmentos}
            corretorNomes={pipeline.corretorNomes}
            open={true}
            onOpenChange={(open) => { if (!open) setModalLeadId(null); }}
            onUpdate={pipeline.updateLead}
            onMove={pipeline.moveLead}
            onDelete={pipeline.deleteLead}
          />
        );
      })()}
    </div>
  );
}
