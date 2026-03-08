import { useState, useMemo, useCallback } from "react";
import { format, isToday, isTomorrow, isThisWeek, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, List, Columns3, Plus, CalendarIcon, X, ArrowUpDown, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVisitas, STATUS_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useUserRole } from "@/hooks/useUserRole";
import VisitasList from "@/components/visitas/VisitasList";
import VisitasCalendar from "@/components/visitas/VisitasCalendar";
import VisitasKanban from "@/components/visitas/VisitasKanban";
import VisitaForm from "@/components/visitas/VisitaForm";
import VisitaResultadoDialog, { type ResultadoVisita } from "@/components/visitas/VisitaResultadoDialog";

const STATUS_CHIP_COLORS: Record<string, string> = {
  marcada: "bg-blue-500 text-white",
  confirmada: "bg-emerald-500 text-white",
  realizada: "bg-muted text-muted-foreground",
  reagendada: "bg-amber-500 text-white",
  cancelada: "bg-destructive/80 text-white",
  no_show: "bg-destructive text-white",
};

export default function AgendaVisitas() {
  const { isAdmin, isGestor } = useUserRole();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [corretorFilter, setCorretorFilter] = useState<string>("all");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [resultadoVisita, setResultadoVisita] = useState<Visita | null>(null);

  const { visitas, isLoading, createVisita, updateVisita, updateStatus, deleteVisita } = useVisitas();

  const handleUpdateStatus = useCallback((id: string, newStatus: VisitaStatus) => {
    if (newStatus === "realizada") {
      const visita = visitas.find(v => v.id === id);
      if (visita) { setResultadoVisita(visita); return; }
    }
    updateStatus(id, newStatus);
  }, [visitas, updateStatus]);

  const handleResultadoSubmit = useCallback(async (resultado: ResultadoVisita, observacoes?: string) => {
    if (!resultadoVisita) return;
    const updates: any = { status: "realizada", resultado_visita: resultado };
    if (observacoes) {
      updates.observacoes = [resultadoVisita.observacoes, observacoes].filter(Boolean).join(" | ");
    }
    await updateVisita(resultadoVisita.id, updates);
    setResultadoVisita(null);
  }, [resultadoVisita, updateVisita]);

  // Unique corretores and empreendimentos for filters
  const { corretores, empreendimentos } = useMemo(() => {
    const cSet = new Map<string, string>();
    const eSet = new Set<string>();
    for (const v of visitas) {
      if (v.corretor_nome && v.corretor_id) cSet.set(v.corretor_id, v.corretor_nome);
      if (v.empreendimento) eSet.add(v.empreendimento);
    }
    return {
      corretores: Array.from(cSet.entries()).map(([id, nome]) => ({ id, nome })),
      empreendimentos: Array.from(eSet).sort(),
    };
  }, [visitas]);

  const filtered = useMemo(() => {
    let list = [...visitas];
    if (statusFilter !== "all") list = list.filter(v => v.status === statusFilter);
    if (corretorFilter !== "all") list = list.filter(v => v.corretor_id === corretorFilter);
    if (empreendimentoFilter !== "all") list = list.filter(v => v.empreendimento === empreendimentoFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(v =>
        v.nome_cliente.toLowerCase().includes(term) ||
        v.empreendimento?.toLowerCase().includes(term) ||
        v.telefone?.includes(term) ||
        v.corretor_nome?.toLowerCase().includes(term)
      );
    }
    if (dateFrom) {
      const fromStr = format(dateFrom, "yyyy-MM-dd");
      list = list.filter(v => v.data_visita >= fromStr);
    }
    if (dateTo) {
      const toStr = format(dateTo, "yyyy-MM-dd");
      list = list.filter(v => v.data_visita <= toStr);
    }
    list.sort((a, b) => {
      const dateComp = a.data_visita.localeCompare(b.data_visita);
      if (dateComp !== 0) return sortOrder === "asc" ? dateComp : -dateComp;
      const timeA = a.hora_visita || "99:99";
      const timeB = b.hora_visita || "99:99";
      return sortOrder === "asc" ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
    });
    return list;
  }, [visitas, statusFilter, corretorFilter, empreendimentoFilter, searchTerm, dateFrom, dateTo, sortOrder]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of visitas) c[v.status] = (c[v.status] || 0) + 1;
    return c;
  }, [visitas]);

  // Count pending (past visits still "marcada" or "confirmada")
  const pendingCount = useMemo(() => {
    const today = startOfDay(new Date());
    return visitas.filter(v => {
      const d = new Date(v.data_visita + "T12:00:00");
      return isBefore(d, today) && (v.status === "marcada" || v.status === "confirmada");
    }).length;
  }, [visitas]);

  const totalCount = visitas.length;
  const hasFilters = statusFilter !== "all" || corretorFilter !== "all" || empreendimentoFilter !== "all" || !!dateFrom || !!dateTo || searchTerm.trim();

  const clearAll = () => {
    setStatusFilter("all");
    setCorretorFilter("all");
    setEmpreendimentoFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchTerm("");
  };

  const filterPending = () => {
    setStatusFilter("all");
    setDateTo(new Date(Date.now() - 86400000));
    // We'll show marcada + confirmada in the past
  };

  return (
    <div className="space-y-3">
      {/* Header Line 1 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Agenda de Visitas
          </h1>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Visão consolidada da empresa" : isGestor ? "Visitas da sua equipe" : "Suas visitas agendadas"}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova Visita
        </Button>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <button
          onClick={filterPending}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors text-left"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{pendingCount} visita{pendingCount > 1 ? "s" : ""} sem atualização de status</span>
          <span className="ml-auto text-[10px] underline">Resolver agora →</span>
        </button>
      )}

      {/* Line 2 — Status chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
            statusFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          Todas {totalCount}
        </button>
        {(["marcada", "confirmada", "realizada", "reagendada", "cancelada", "no_show"] as VisitaStatus[]).map(s => {
          const count = counts[s] || 0;
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                isActive
                  ? STATUS_CHIP_COLORS[s] + " shadow-sm"
                  : count === 0
                    ? "bg-muted/30 text-muted-foreground/40 cursor-default"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
              )}
            >
              {STATUS_LABELS[s]} {count}
            </button>
          );
        })}
      </div>

      {/* Line 3 — Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, corretor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-xs h-8 pl-8"
          />
        </div>

        {(isAdmin || isGestor) && corretores.length > 1 && (
          <Select value={corretorFilter} onValueChange={setCorretorFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Corretor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos corretores</SelectItem>
              {corretores.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {empreendimentos.length > 1 && (
          <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Empreendimento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos empreend.</SelectItem>
              {empreendimentos.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", dateFrom && "border-primary text-primary")}>
              <CalendarIcon className="h-3 w-3" />
              {dateFrom ? format(dateFrom, "dd/MM") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", dateTo && "border-primary text-primary")}>
              <CalendarIcon className="h-3 w-3" />
              {dateTo ? format(dateTo, "dd/MM") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setSortOrder(s => s === "asc" ? "desc" : "asc")}>
          <ArrowUpDown className="h-3 w-3" />
          {sortOrder === "asc" ? "↑ Próxima" : "↓ Recente"}
        </Button>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 text-xs gap-1 text-muted-foreground">
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Views */}
      <Tabs defaultValue="lista">
        <TabsList className="h-8">
          <TabsTrigger value="lista" className="gap-1 text-xs h-7 px-3">
            <List className="h-3 w-3" /> Lista
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1 text-xs h-7 px-3">
            <CalendarDays className="h-3 w-3" /> Calendário
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1 text-xs h-7 px-3">
            <Columns3 className="h-3 w-3" /> Kanban
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <VisitasList
              visitas={filtered}
              onUpdateStatus={handleUpdateStatus}
              onDelete={deleteVisita}
              showCorretor={isAdmin || isGestor}
            />
          )}
        </TabsContent>

        <TabsContent value="calendario" className="mt-3">
          <VisitasCalendar visitas={filtered} />
        </TabsContent>

        <TabsContent value="kanban" className="mt-3">
          <VisitasKanban visitas={filtered} onUpdateStatus={handleUpdateStatus} onDelete={deleteVisita} />
        </TabsContent>
      </Tabs>

      {showForm && (
        <VisitaForm open={showForm} onClose={() => setShowForm(false)} onSubmit={createVisita} />
      )}

      {resultadoVisita && (
        <VisitaResultadoDialog
          open={!!resultadoVisita}
          onClose={() => setResultadoVisita(null)}
          onSubmit={handleResultadoSubmit}
          nomeCliente={resultadoVisita.nome_cliente}
        />
      )}
    </div>
  );
}
