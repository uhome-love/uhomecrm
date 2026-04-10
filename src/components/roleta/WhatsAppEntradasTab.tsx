import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, MessageSquare } from "lucide-react";

interface WhatsAppLogEntry {
  id: string;
  created_at: string;
  telefone: string | null;
  nome_contato: string | null;
  mensagem_recebida: string | null;
  tipo_mensagem: string | null;
  filtro_resultado: string | null;
  filtro_motivo: string | null;
  resposta_ia: string | null;
  corretor_nome: string | null;
  status: string | null;
  erro_detalhe: string | null;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  resposta_enviada: { label: "Resposta enviada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  resposta_gerada: { label: "Aguardando envio", className: "bg-amber-100 text-amber-700 border-amber-200" },
  erro_envio: { label: "Erro envio", className: "bg-red-100 text-red-700 border-red-200" },
  erro: { label: "Erro", className: "bg-red-100 text-red-700 border-red-200" },
  descartado: { label: "Descartado", className: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  lead_criado: { label: "Lead criado", className: "bg-blue-100 text-blue-700 border-blue-200" },
};

const FILTRO_BADGES: Record<string, { label: string; className: string }> = {
  aprovado: { label: "Aprovado", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  spam: { label: "Spam", className: "bg-red-100 text-red-700 border-red-200" },
  vago: { label: "Vago", className: "bg-amber-100 text-amber-700 border-amber-200" },
  aguardando: { label: "Aguardando", className: "bg-blue-100 text-blue-700 border-blue-200" },
};

function truncate(text: string | null, max: number): string {
  if (!text) return "—";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatBrt(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function WhatsAppEntradasTab() {
  const [entries, setEntries] = useState<WhatsAppLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchEntries = async () => {
    let query = supabase
      .from("whatsapp_ai_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (search.trim()) {
      query = query.or(`telefone.ilike.%${search}%,nome_contato.ilike.%${search}%`);
    }

    const { data } = await query;
    setEntries((data as WhatsAppLogEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, [statusFilter, search]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-ai-log-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_ai_log" },
        (payload) => {
          const newEntry = payload.new as WhatsAppLogEntry;
          setEntries((prev) => {
            // Check filters
            if (statusFilter !== "all" && newEntry.status !== statusFilter) return prev;
            if (search.trim()) {
              const s = search.toLowerCase();
              if (
                !(newEntry.telefone?.toLowerCase().includes(s) ||
                  newEntry.nome_contato?.toLowerCase().includes(s))
              ) return prev;
            }
            return [newEntry, ...prev].slice(0, 100);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="resposta_enviada">Resposta enviada</SelectItem>
            <SelectItem value="lead_criado">Lead criado</SelectItem>
            <SelectItem value="erro_envio">Erro envio</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="descartado">Descartado</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Buscar por telefone ou nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-[280px]"
        />
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">Nenhuma entrada encontrada</p>
        </div>
      ) : (
        <TooltipProvider>
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Filtro</TableHead>
                  <TableHead>Resposta IA</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const statusBadge = STATUS_BADGES[entry.status || ""] || {
                    label: entry.status || "—",
                    className: "bg-neutral-100 text-neutral-500",
                  };
                  const filtroBadge = FILTRO_BADGES[entry.filtro_resultado || ""] || {
                    label: entry.filtro_resultado || "—",
                    className: "bg-neutral-100 text-neutral-500",
                  };

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {entry.created_at ? formatBrt(entry.created_at) : "—"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{entry.nome_contato || "Desconhecido"}</p>
                          <p className="text-xs text-muted-foreground">{entry.telefone || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm cursor-default">
                              {truncate(entry.mensagem_recebida, 60)}
                            </span>
                          </TooltipTrigger>
                          {entry.mensagem_recebida && entry.mensagem_recebida.length > 60 && (
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm">{entry.mensagem_recebida}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${filtroBadge.className}`}>
                          {filtroBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`text-sm cursor-default ${!entry.resposta_ia ? "text-muted-foreground" : ""}`}>
                              {truncate(entry.resposta_ia, 60)}
                            </span>
                          </TooltipTrigger>
                          {entry.resposta_ia && entry.resposta_ia.length > 60 && (
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm">{entry.resposta_ia}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.corretor_nome || "—"}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className={`text-[10px] ${statusBadge.className}`}>
                              {statusBadge.label}
                            </Badge>
                          </TooltipTrigger>
                          {entry.erro_detalhe && (
                            <TooltipContent className="max-w-sm">
                              <p className="text-xs text-red-600">{entry.erro_detalhe}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
