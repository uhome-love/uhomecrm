import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, MessageSquare, X, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ConversationItem {
  leadId: string;
  leadName: string;
  empreendimento: string | null;
  lastMessage: string;
  lastTimestamp: string;
  totalMessages: number;
  unreadCount: number;
}

interface ConversationListProps {
  conversations: ConversationItem[];
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

type Filter = "all" | "unread" | "today";

export default function ConversationList({ conversations, selectedLeadId, onSelect, loading, userId }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvSearch, setNewConvSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; nome: string; empreendimento: string | null }[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced search for new conversation
  useEffect(() => {
    if (!newConvSearch.trim() || !userId) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("pipeline_leads")
        .select("id, nome, empreendimento")
        .eq("corretor_id", userId)
        .ilike("nome", `%${newConvSearch.trim()}%`)
        .limit(10);
      setSearchResults((data as any[]) || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [newConvSearch, userId]);

  const filtered = useMemo(() => {
    let list = conversations;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.leadName.toLowerCase().includes(q));
    }
    if (filter === "unread") list = list.filter(c => c.unreadCount > 0);
    if (filter === "today") {
      const today = new Date().toDateString();
      list = list.filter(c => new Date(c.lastTimestamp).toDateString() === today);
    }
    return list;
  }, [conversations, search, filter]);

  const handleSelectNewConv = (leadId: string) => {
    setNewConvOpen(false);
    setNewConvSearch("");
    setSearchResults([]);
    onSelect(leadId);
  };

  return (
    <div className="w-[290px] border-r border-border flex flex-col bg-card h-full">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <MessageSquare size={14} /> Conversas
          </h2>
          <span className="text-xs text-muted-foreground">{conversations.length}</span>
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
          {(["all", "unread", "today"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f === "all" ? "Todas" : f === "unread" ? "Não lidas" : "Hoje"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filtered.map(conv => (
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
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium truncate block">{conv.leadName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                      {formatDistanceToNow(new Date(conv.lastTimestamp), { locale: ptBR, addSuffix: false })}
                    </span>
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
          ))
        )}
      </div>

      {/* Footer — Nova Conversa */}
      <div className="p-2 border-t border-border">
        <Popover open={newConvOpen} onOpenChange={setNewConvOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="w-full text-xs h-8">
              <Plus size={12} /> Nova conversa
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-[270px] p-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Buscar lead</span>
                <button onClick={() => setNewConvOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Digite o nome do lead..."
                  value={newConvSearch}
                  onChange={e => setNewConvSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                  autoFocus
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {searching ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-3">
                    {newConvSearch.trim() ? "Nenhum lead encontrado" : "Digite para buscar"}
                  </p>
                ) : (
                  searchResults.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => handleSelectNewConv(lead.id)}
                      className="w-full text-left px-2 py-2 rounded hover:bg-muted/60 transition-colors flex items-center gap-2"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className={`${getAvatarColor(lead.nome)} text-white text-[10px]`}>
                          {getInitials(lead.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="text-xs font-medium block truncate">{lead.nome}</span>
                        {lead.empreendimento && (
                          <span className="text-[10px] text-muted-foreground block truncate">{lead.empreendimento}</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
