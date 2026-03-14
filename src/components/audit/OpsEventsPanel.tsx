import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Radio, Search, CalendarIcon, ChevronDown, ChevronRight, X, RefreshCw } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface OpsEvent {
  id: string;
  created_at: string;
  fn: string;
  level: string;
  category: string | null;
  message: string;
  trace_id: string | null;
  ctx: Record<string, unknown> | null;
  error_detail: string | null;
}

const FUNCTIONS = [
  "all",
  "receive-meta-lead",
  "receive-tiktok-lead",
  "receive-landing-lead",
  "distribute-lead",
  "lead-escalation",
  "whatsapp-notificacao",
  "execute-automations",
  "execute-sequences",
  "generate-monthly-report",
  "notify",
] as const;

const LEVELS = ["all", "error", "warn", "info"] as const;
const CATEGORIES = ["all", "system", "business", "integration", "validation"] as const;

const levelColors: Record<string, string> = {
  error: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  warn: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
};

const categoryColors: Record<string, string> = {
  system: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  business: "bg-green-500/10 text-green-700 dark:text-green-400",
  integration: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  validation: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

export function OpsEventsPanel() {
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [filterFn, setFilterFn] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [traceSearch, setTraceSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activePreset, setActivePreset] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("ops_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterFn !== "all") query = query.eq("fn", filterFn);
    if (filterLevel !== "all") query = query.eq("level", filterLevel);
    if (filterCategory !== "all") query = query.eq("category", filterCategory);
    if (traceSearch.trim()) query = query.eq("trace_id", traceSearch.trim());

    if (dateRange?.from) {
      query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      if (dateRange.to) query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
    } else {
      query = query.gte("created_at", startOfDay(subDays(new Date(), activePreset)).toISOString());
    }

    const { data } = await query;
    setEvents((data as OpsEvent[]) || []);
    setLoading(false);
  }, [filterFn, filterLevel, filterCategory, traceSearch, dateRange, activePreset]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const clearFilters = () => {
    setFilterFn("all");
    setFilterLevel("all");
    setFilterCategory("all");
    setTraceSearch("");
    setDateRange(undefined);
    setActivePreset(7);
  };

  const hasActiveFilters = filterFn !== "all" || filterLevel !== "all" || filterCategory !== "all" || traceSearch || dateRange?.from || activePreset !== 7;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4" /> Eventos Operacionais
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={loadEvents} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Select value={filterFn} onValueChange={setFilterFn}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Função" /></SelectTrigger>
            <SelectContent>
              {FUNCTIONS.map((f) => (
                <SelectItem key={f} value={f}>{f === "all" ? "Todas funções" : f}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Level" /></SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{l === "all" ? "Todos levels" : l.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c === "all" ? "Todas categorias" : c}</SelectItem>
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

          <div className="flex gap-1">
            {[{ label: "24h", days: 1 }, { label: "7d", days: 7 }, { label: "30d", days: 30 }].map((p) => (
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

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={dateRange?.from ? "default" : "outline"} className="text-[10px] h-7 px-2">
                <CalendarIcon className="h-3 w-3 mr-1" />
                {dateRange?.from ? `${format(dateRange.from, "dd/MM")}${dateRange.to ? ` – ${format(dateRange.to, "dd/MM")}` : ""}` : "Período"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => { setDateRange(range); setActivePreset(0); }}
                numberOfMonths={1}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Badge variant="secondary" className="text-[10px] h-6">
            {loading ? "..." : `${events.length} eventos`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {loading ? "Carregando..." : "Nenhum evento encontrado."}
          </p>
        ) : (
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-6"></TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Função</TableHead>
                  <TableHead className="text-xs">Level</TableHead>
                  <TableHead className="text-xs">Cat.</TableHead>
                  <TableHead className="text-xs">Mensagem</TableHead>
                  <TableHead className="text-xs">Trace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <>
                    <TableRow
                      key={ev.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        ev.level === "error" && "bg-destructive/5"
                      )}
                      onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    >
                      <TableCell className="p-1">
                        {expandedId === ev.id
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(ev.created_at), "dd/MM HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">{ev.fn}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${levelColors[ev.level] || ""}`}>
                          {ev.level.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryColors[ev.category || ""] || "bg-muted"}`}>
                          {ev.category || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[250px] truncate">{ev.message}</TableCell>
                      <TableCell className="text-xs">
                        {ev.trace_id ? (
                          <button
                            className="font-mono text-[10px] text-primary hover:underline"
                            onClick={(e) => { e.stopPropagation(); setTraceSearch(ev.trace_id!); }}
                          >
                            {ev.trace_id.slice(0, 12)}…
                          </button>
                        ) : "—"}
                      </TableCell>
                    </TableRow>

                    {expandedId === ev.id && (
                      <TableRow key={`${ev.id}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Detalhes</p>
                              <dl className="space-y-1">
                                <div className="flex gap-2">
                                  <dt className="text-muted-foreground">ID:</dt>
                                  <dd className="font-mono text-[10px]">{ev.id}</dd>
                                </div>
                                {ev.trace_id && (
                                  <div className="flex gap-2">
                                    <dt className="text-muted-foreground">Trace ID:</dt>
                                    <dd className="font-mono text-[10px]">{ev.trace_id}</dd>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <dt className="text-muted-foreground">Timestamp:</dt>
                                  <dd>{format(new Date(ev.created_at), "dd/MM/yyyy HH:mm:ss.SSS")}</dd>
                                </div>
                              </dl>
                            </div>
                            <div className="space-y-2">
                              {ev.ctx && Object.keys(ev.ctx).length > 0 && (
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">Contexto</p>
                                  <pre className="bg-background rounded p-2 text-[10px] max-h-32 overflow-auto font-mono">
                                    {JSON.stringify(ev.ctx, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {ev.error_detail && (
                                <div>
                                  <p className="font-medium text-destructive mb-1">Erro</p>
                                  <pre className="bg-background rounded p-2 text-[10px] max-h-32 overflow-auto font-mono text-destructive">
                                    {ev.error_detail}
                                  </pre>
                                </div>
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
