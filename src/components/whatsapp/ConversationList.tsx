import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MessageSquare, Loader2, Clock, UserPlus, RefreshCw, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDebounce } from "@/hooks/useDebounce";

export interface ConversationItem {
  leadId: string;
  leadName: string;
  empreendimento: string | null;
  lastMessage: string;
  lastTimestamp: string;
  totalMessages: number;
  unreadCount: number;
  lastReceivedTs: string | null;
}

export interface FollowUpLead {
  id: string;
  nome: string;
  empreendimento: string | null;
  stageName: string | null;
  updatedAt: string;
}

export interface NewLead {
  id: string;
  nome: string;
  empreendimento: string | null;
  createdAt: string;
}

interface ConversationListProps {
  conversations: ConversationItem[];
  followUpLeads: FollowUpLead[];
  newLeads: NewLead[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  loading: boolean;
  userId?: string | null;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-teal-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function SLABadge({ lastReceivedTs }: { lastReceivedTs: string | null }) {
  if (!lastReceivedTs) return null;
  const hours = differenceInHours(new Date(), new Date(lastReceivedTs));
  if (hours < 2) return null;
  const isRed = hours >= 24;
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${isRed ? "bg-destructive" : "bg-yellow-500"}`}
      title={`Sem resposta há ${hours}h`}
    />
  );
}

type Tab = "all" | "active" | "followup" | "new";

interface DialogLead {
  id: string;
  nome: string;
  empreendimento: string | null;
  updated_at: string;
  stage_id: string | null;
  pipeline_stages: { nome: string } | null;
}

export default function ConversationList({
  conversations,
  followUpLeads,
  newLeads,
  selectedLeadId,
  onSelect,
  loading,
  userId,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvSearch, setNewConvSearch] = useState("");

  // Dialog state
  const [stages, setStages] = useState<{ id: string; nome: string }[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [dialogLeads, setDialogLeads] = useState<DialogLead[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);

  const debouncedDialogSearch = useDebounce(newConvSearch, 300);

  // Load stages when dialog opens
  useEffect(() => {
    if (!newConvOpen) return;
    supabase
      .from("pipeline_stages")
      .select("id, nome")
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        if (data) setStages(data as { id: string; nome: string }[]);
      });
  }, [newConvOpen]);

  // Load leads when dialog opens or filters change
  useEffect(() => {
    if (!newConvOpen || !userId) return;
    setDialogLoading(true);

    let query = supabase
      .from("pipeline_leads")
      .select("id, nome, empreendimento, updated_at, stage_id, pipeline_stages(nome)")
      .eq("corretor_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (debouncedDialogSearch.trim()) {
      query = query.ilike("nome", `%${debouncedDialogSearch.trim()}%`);
    }
    if (selectedStageId) {
      query = query.eq("stage_id", selectedStageId);
    }

    query.then(({ data }) => {
      setDialogLeads((data as DialogLead[]) || []);
      setDialogLoading(false);
    });
  }, [newConvOpen, userId, debouncedDialogSearch, selectedStageId]);

  // Cleanup on close
  useEffect(() => {
    if (!newConvOpen) {
      setNewConvSearch("");
      setSelectedStageId(null);
      setDialogLeads([]);
    }
  }, [newConvOpen]);

  const q = search.toLowerCase();

  const filteredConversations = useMemo(() => {
    if (!search) return conversations;
    return conversations.filter(c => c.leadName.toLowerCase().includes(q));
  }, [conversations, q, search]);

  const filteredFollowUp = useMemo(() => {
    if (!search) return followUpLeads;
    return followUpLeads.filter(l => l.nome.toLowerCase().includes(q));
  }, [followUpLeads, q, search]);

  const filteredNew = useMemo(() => {
    if (!search) return newLeads;
    return newLeads.filter(l => l.nome.toLowerCase().includes(q));
  }, [newLeads, q, search]);

  const handleSelectNewConv = (leadId: string) => {
    setNewConvOpen(false);
    onSelect(leadId);
  };

  const showActive = tab === "all" || tab === "active";
  const showFollowUp = tab === "all" || tab === "followup";
  const showNew = tab === "all" || tab === "new";

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "active", label: "Ativas" },
    { key: "followup", label: "Follow-up" },
    { key: "new", label: "Novos" },
  ];

  return (
    <div className="w-[290px] border-r border-border flex flex-col bg-card h-full">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <MessageSquare size={14} /> Conversas
          </h2>
          <span className="text-[10px] text-muted-foreground">
            {conversations.length} ativas · {followUpLeads.length} follow-up · {newLeads.length} novos
          </span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Buscar lead..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Group 1: Active Conversations */}
            {showActive && filteredConversations.length > 0 && (
              <>
                {tab === "all" && (
                  <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
                    <MessageSquare size={12} className="text-primary" />
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Conversas ativas</span>
                  </div>
                )}
                {filteredConversations.map(conv => (
                  <button
                    key={conv.leadId}
                    onClick={() => onSelect(conv.leadId)}
                    className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors hover:bg-muted/50 ${
                      selectedLeadId === conv.leadId
                        ? "border-l-primary bg-muted/60"
                        : "border-l-transparent"
                    }`}
                  >
                    <div className="flex gap-2.5">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className={`${getAvatarColor(conv.leadName)} text-white text-xs`}>
                          {getInitials(conv.leadName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium truncate block">{conv.leadName}</span>
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            <SLABadge lastReceivedTs={conv.lastReceivedTs} />
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(conv.lastTimestamp), { locale: ptBR, addSuffix: false })}
                            </span>
                          </div>
                        </div>
                        {conv.empreendimento && (
                          <span className="text-[10px] text-muted-foreground block truncate">{conv.empreendimento}</span>
                        )}
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{conv.lastMessage || "Mídia"}</p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center shrink-0 mt-0.5">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Group 2: Follow-up sugerido */}
            {showFollowUp && filteredFollowUp.length > 0 && (
              <>
                <div className="px-3 pt-3 pb-1 flex items-center gap-1.5">
                  <RefreshCw size={12} className="text-yellow-500" />
                  <span className="text-[10px] font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Follow-up sugerido</span>
                </div>
                {filteredFollowUp.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => onSelect(lead.id)}
                    className={`w-full text-left px-3 py-2 border-l-2 transition-colors hover:bg-muted/50 ${
                      selectedLeadId === lead.id ? "border-l-yellow-500 bg-muted/60" : "border-l-transparent"
                    }`}
                  >
                    <div className="flex gap-2.5 items-center">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={`${getAvatarColor(lead.nome)} text-white text-[10px]`}>
                          {getInitials(lead.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate block">{lead.nome}</span>
                        {lead.empreendimento && (
                          <span className="text-[10px] text-muted-foreground block truncate">{lead.empreendimento}</span>
                        )}
                        <span className="text-[10px] text-yellow-600 dark:text-yellow-400">
                          <Clock size={10} className="inline mr-0.5" />
                          há {formatDistanceToNow(new Date(lead.updatedAt), { locale: ptBR, addSuffix: false })} sem contato
                        </span>
                      </div>
                      <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Group 3: Novos leads */}
            {showNew && filteredNew.length > 0 && (
              <>
                <div className="px-3 pt-3 pb-1 flex items-center gap-1.5">
                  <UserPlus size={12} className="text-green-500" />
                  <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Novos leads</span>
                </div>
                {filteredNew.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => onSelect(lead.id)}
                    className={`w-full text-left px-3 py-2 border-l-2 transition-colors hover:bg-muted/50 ${
                      selectedLeadId === lead.id ? "border-l-green-500 bg-muted/60" : "border-l-transparent"
                    }`}
                  >
                    <div className="flex gap-2.5 items-center">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={`${getAvatarColor(lead.nome)} text-white text-[10px]`}>
                          {getInitials(lead.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate block">{lead.nome}</span>
                        {lead.empreendimento && (
                          <span className="text-[10px] text-muted-foreground block truncate">{lead.empreendimento}</span>
                        )}
                        <span className="text-[10px] text-green-600 dark:text-green-400">
                          chegou há {formatDistanceToNow(new Date(lead.createdAt), { locale: ptBR, addSuffix: false })}
                        </span>
                      </div>
                      <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Empty state */}
            {filteredConversations.length === 0 && filteredFollowUp.length === 0 && filteredNew.length === 0 && (
              <div className="text-center py-12 px-4">
                <MessageSquare size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum resultado encontrado</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer — Nova Conversa */}
      <div className="p-2 border-t border-border flex-shrink-0">
        <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => setNewConvOpen(true)}>
          <Plus size={12} /> Nova conversa
        </Button>

        <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
          <DialogContent className="max-w-md p-0 gap-0">
            <DialogHeader className="p-4 pb-3 border-b border-border">
              <DialogTitle className="text-sm">Iniciar conversa</DialogTitle>
            </DialogHeader>

            {/* Search */}
            <div className="px-4 pt-3">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar lead por nome..."
                  value={newConvSearch}
                  onChange={e => setNewConvSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                  autoFocus
                />
              </div>
            </div>

            {/* Stage chips */}
            <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedStageId(null)}
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                  selectedStageId === null
                    ? "bg-[#4F46E5] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Todas
              </button>
              {stages.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStageId(stage.id === selectedStageId ? null : stage.id)}
                  className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                    selectedStageId === stage.id
                      ? "bg-[#4F46E5] text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {stage.nome}
                </button>
              ))}
            </div>

            {/* Lead list */}
            <div className="max-h-[50vh] overflow-y-auto px-2 pb-2">
              {dialogLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : dialogLeads.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">
                    {debouncedDialogSearch.trim() || selectedStageId
                      ? "Nenhum lead encontrado"
                      : "Nenhum lead disponível"}
                  </p>
                </div>
              ) : (
                dialogLeads.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => handleSelectNewConv(lead.id)}
                    className="w-full text-left px-2 py-2.5 rounded-md hover:bg-muted/60 transition-colors flex items-center gap-2.5"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={`${getAvatarColor(lead.nome)} text-white text-[10px]`}>
                        {getInitials(lead.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{lead.nome}</span>
                        {lead.pipeline_stages?.nome && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                            {lead.pipeline_stages.nome}
                          </Badge>
                        )}
                      </div>
                      {lead.empreendimento && (
                        <span className="text-[10px] text-muted-foreground block truncate">{lead.empreendimento}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      há {formatDistanceToNow(new Date(lead.updated_at), { locale: ptBR, addSuffix: false })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
