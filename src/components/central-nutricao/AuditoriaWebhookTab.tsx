import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, CheckCircle2, XCircle, MessageSquare, ExternalLink } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";

interface Row {
  id: string;
  lead_id: string | null;
  phone: string | null;
  status: string | null;
  button_response: string | null;
  response_text: string | null;
  sent_at: string | null;
  responded_at: string | null;
  template_name: string | null;
  lead?: { nome: string | null; reativado_por_nutricao: boolean | null; origem: string | null; corretor_id: string | null } | null;
}

const STATUS_BADGE: Record<string, string> = {
  sent: "bg-neutral-100 text-neutral-600",
  delivered: "bg-blue-50 text-blue-700",
  read: "bg-indigo-50 text-indigo-700",
  responded: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

function parseResponse(raw: string | null): { text: string; type: string | null } {
  if (!raw) return { text: "—", type: null };
  try {
    const j = JSON.parse(raw);
    const text = j?.button?.text || j?.button?.payload || j?.text?.body || j?.body || raw;
    return { text: String(text).slice(0, 200), type: j?.type || null };
  } catch {
    return { text: raw.slice(0, 200), type: null };
  }
}

export default function AuditoriaWebhookTab() {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["auditoria-meta-webhook"],
    queryFn: async () => {
      const { data: disparos, error } = await supabase
        .from("reengajamento_meta_disparos")
        .select("id, lead_id, phone, status, button_response, response_text, sent_at, responded_at, template_name")
        .order("sent_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const leadIds = Array.from(new Set((disparos ?? []).map((d: any) => d.lead_id).filter(Boolean)));
      let leadsMap: Record<string, any> = {};
      if (leadIds.length) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, nome, reativado_por_nutricao, origem, corretor_id")
          .in("id", leadIds);
        leadsMap = Object.fromEntries((leads ?? []).map((l: any) => [l.id, l]));
      }
      return (disparos ?? []).map((d: any) => ({ ...d, lead: leadsMap[d.lead_id] || null })) as Row[];
    },
    refetchInterval: 5000,
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (filter === "sim") rows = rows.filter(r => r.button_response === "sim");
    else if (filter === "nao") rows = rows.filter(r => r.button_response === "nao");
    else if (filter === "responded") rows = rows.filter(r => r.status === "responded");
    else if (filter === "no_response") rows = rows.filter(r => !r.button_response && r.status !== "failed");
    else if (filter === "failed") rows = rows.filter(r => r.status === "failed");
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(r =>
        r.phone?.toLowerCase().includes(s) ||
        r.lead?.nome?.toLowerCase().includes(s)
      );
    }
    return rows;
  }, [data, filter, search]);

  const stats = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      sim: rows.filter(r => r.button_response === "sim").length,
      nao: rows.filter(r => r.button_response === "nao").length,
      reativados: rows.filter(r => r.lead?.reativado_por_nutricao).length,
      responded: rows.filter(r => r.status === "responded").length,
      failed: rows.filter(r => r.status === "failed").length,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Responderam</div><div className="text-xl font-bold text-emerald-600">{stats.responded}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">✅ Sim</div><div className="text-xl font-bold text-emerald-700">{stats.sim}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">❌ Não</div><div className="text-xl font-bold text-red-700">{stats.nao}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">🔄 Reativados</div><div className="text-xl font-bold text-purple-700">{stats.reativados}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Falhas</div><div className="text-xl font-bold text-red-600">{stats.failed}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="responded">Responderam</SelectItem>
            <SelectItem value="sim">Classificado SIM</SelectItem>
            <SelectItem value="nao">Classificado NÃO</SelectItem>
            <SelectItem value="no_response">Sem resposta</SelectItem>
            <SelectItem value="failed">Falhas</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Buscar por telefone ou nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-[280px]" />
      </div>

      {filtered.length === 0 ? (
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
                  <TableHead>Enviado</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensagem recebida</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Reativado?</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const parsed = parseResponse(r.response_text);
                  const cls = r.button_response;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">{r.sent_at ? formatBRT(r.sent_at, "dd/MM HH:mm") : "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{r.lead?.nome || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[r.status || ""] || "bg-neutral-100"}`}>
                          {r.status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {parsed.type ? (
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">{parsed.type}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm cursor-default">{parsed.text.length > 50 ? parsed.text.slice(0, 50) + "…" : parsed.text}</span>
                          </TooltipTrigger>
                          {parsed.text.length > 50 && <TooltipContent className="max-w-md"><p className="text-xs">{parsed.text}</p></TooltipContent>}
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {cls === "sim" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />SIM</Badge>
                        ) : cls === "nao" ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />NÃO</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.lead?.reativado_por_nutricao ? (
                          <Badge variant="purple" className="text-[10px]">🔄 Reativado</Badge>
                        ) : cls === "sim" ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">Pendente</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.lead_id && (
                          <Link to={`/pipeline?lead=${r.lead_id}`} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                            <ExternalLink className="h-3 w-3" /> Ver
                          </Link>
                        )}
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
