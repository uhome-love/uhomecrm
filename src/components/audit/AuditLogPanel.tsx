import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/customClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { FileDown, History, Search, CalendarIcon, ChevronDown, ChevronRight, X } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import type { Json } from "@/integrations/supabase/types";
import { formatBRT } from "@/lib/brtTime";

interface LogEntry {
  id: string;
  created_at: string;
  modulo: string;
  acao: string;
  chave_unica: string | null;
  descricao: string | null;
  origem: string | null;
  request_id: string | null;
  user_id: string;
  antes: Json | null;
  depois: Json | null;
}

const MODULES = [
  "all", "pipeline", "roleta", "checkpoint", "funil", "leads",
  "relatórios", "integracao", "automacao", "sequencia", "pdn",
] as const;

const ACTIONS = [
  "all", "create", "update", "delete", "merge", "import",
  "dispatch_fila_ceo", "bulk_move", "bulk_redistribute", "bulk_delete",
] as const;

const DATE_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "Últimas 24h", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
] as const;

export function AuditLogPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterMod, setFilterMod] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [traceSearch, setTraceSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activePreset, setActivePreset] = useState<number | null>(7);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("audit_log")
      .select("id, created_at, modulo, acao, chave_unica, descricao, origem, request_id, user_id, antes, depois")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterMod !== "all") query = query.eq("modulo", filterMod);
    if (filterAction !== "all") query = query.eq("acao", filterAction);

    if (traceSearch.trim()) {
      query = query.eq("request_id", traceSearch.trim());
    }

    // Date range
    if (dateRange?.from) {
      query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      if (dateRange.to) {
        query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
      }
    } else if (activePreset !== null) {
      const preset = DATE_PRESETS.find((p) => p.days === activePreset);
      if (preset) {
        query = query.gte("created_at", startOfDay(subDays(new Date(), preset.days)).toISOString());
      }
    }

    const { data } = await query;
    setLogs((data as LogEntry[]) || []);
    setLoading(false);
  }, [filterMod, filterAction, traceSearch, dateRange, activePreset]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const clearFilters = () => {
    setFilterMod("all");
    setFilterAction("all");
    setTraceSearch("");
    setDateRange(undefined);
    setActivePreset(7);
  };

  const hasActiveFilters = filterMod !== "all" || filterAction !== "all" || traceSearch || dateRange?.from || activePreset !== 7;

  const exportCsv = () => {
    const header = "Data,Módulo,Ação,Chave,Descrição,Origem,TraceID\n";
    const rows = logs.map((l) =>
      `"${l.created_at}","${l.modulo}","${l.acao}","${l.chave_unica || ""}","${(l.descricao || "").replace(/"/g, '""')}","${l.origem || ""}","${l.request_id || ""}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const actionColors: Record<string, string> = {
    create: "bg-green-500/10 text-green-700 dark:text-green-400",
    update: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    delete: "bg-red-500/10 text-red-700 dark:text-red-400",
    merge: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    import: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    dispatch_fila_ceo: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    bulk_move: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    bulk_redistribute: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
    bulk_delete: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Log de Auditoria
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={exportCsv}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Select value={filterMod} onValueChange={setFilterMod}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent>
              {MODULES.map((m) => (
                <SelectItem key={m} value={m}>{m === "all" ? "Todos módulos" : m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a === "all" ? "Todas ações" : a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Trace ID"
              value={traceSearch}
              onChange={(e) => setTraceSearch(e.target.value)}
              className="pl-7 h-8 w-40 text-xs"
            />
          </div>

          {/* Date presets */}
          <div className="flex gap-1">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.days}
                size="sm"
                variant={activePreset === p.days && !dateRange?.from ? "default" : "outline"}
                className="text-[10px] h-7 px-2"
                onClick={() => { setActivePreset(p.days); setDateRange(undefined); }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Custom date range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={dateRange?.from ? "default" : "outline"}
                className="text-[10px] h-7 px-2"
              >
                <CalendarIcon className="h-3 w-3 mr-1" />
                {dateRange?.from
                  ? `${format(dateRange.from, "dd/MM")}${dateRange.to ? ` – ${format(dateRange.to, "dd/MM")}` : ""}`
                  : "Período"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => { setDateRange(range); setActivePreset(null); }}
                numberOfMonths={1}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Badge variant="secondary" className="text-[10px] h-6">
            {loading ? "..." : `${logs.length} registros`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {loading ? "Carregando..." : "Nenhum registro encontrado para os filtros selecionados."}
          </p>
        ) : (
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-6"></TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Módulo</TableHead>
                  <TableHead className="text-xs">Ação</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Trace</TableHead>
                  <TableHead className="text-xs">Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <>
                    <TableRow
                      key={l.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                    >
                      <TableCell className="p-1">
                        {expandedId === l.id
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatBRT(l.created_at, "dd/MM HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{l.modulo}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${actionColors[l.acao] || "bg-muted text-muted-foreground"}`}>
                          {l.acao}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[250px] truncate">{l.descricao || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {l.request_id ? (
                          <button
                            className="font-mono text-[10px] text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTraceSearch(l.request_id!);
                            }}
                          >
                            {l.request_id.slice(0, 12)}…
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{l.origem || "—"}</TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {expandedId === l.id && (
                      <TableRow key={`${l.id}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Detalhes</p>
                              <dl className="space-y-1">
                                <div className="flex gap-2">
                                  <dt className="text-muted-foreground">ID:</dt>
                                  <dd className="font-mono text-[10px]">{l.id}</dd>
                                </div>
                                <div className="flex gap-2">
                                  <dt className="text-muted-foreground">User ID:</dt>
                                  <dd className="font-mono text-[10px]">{l.user_id}</dd>
                                </div>
                                <div className="flex gap-2">
                                  <dt className="text-muted-foreground">Chave:</dt>
                                  <dd className="font-mono text-[10px]">{l.chave_unica || "—"}</dd>
                                </div>
                                {l.request_id && (
                                  <div className="flex gap-2">
                                    <dt className="text-muted-foreground">Trace ID:</dt>
                                    <dd className="font-mono text-[10px]">{l.request_id}</dd>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <dt className="text-muted-foreground">Timestamp:</dt>
                                  <dd>{formatBRT(l.created_at, "dd/MM/yyyy HH:mm:ss.SSS")}</dd>
                                </div>
                              </dl>
                            </div>
                            <div className="space-y-2">
                              {l.antes && (
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">Antes</p>
                                  <pre className="bg-background rounded p-2 text-[10px] max-h-32 overflow-auto font-mono">
                                    {JSON.stringify(l.antes, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {l.depois && (
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">Depois</p>
                                  <pre className="bg-background rounded p-2 text-[10px] max-h-32 overflow-auto font-mono">
                                    {JSON.stringify(l.depois, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {!l.antes && !l.depois && (
                                <p className="text-muted-foreground italic">Sem dados de diff disponíveis.</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
