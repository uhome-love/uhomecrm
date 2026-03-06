import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, List, Columns3, Plus, CalendarIcon, X, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVisitas, STATUS_LABELS, type VisitaStatus } from "@/hooks/useVisitas";
import { useUserRole } from "@/hooks/useUserRole";
import VisitasList from "@/components/visitas/VisitasList";
import VisitasCalendar from "@/components/visitas/VisitasCalendar";
import VisitasKanban from "@/components/visitas/VisitasKanban";
import VisitaForm from "@/components/visitas/VisitaForm";

export default function AgendaVisitas() {
  const { isAdmin, isGestor } = useUserRole();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { visitas, isLoading, createVisita, updateStatus, deleteVisita } = useVisitas();

  const filtered = useMemo(() => {
    let list = [...visitas];

    if (statusFilter !== "all") list = list.filter(v => v.status === statusFilter);

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

    // Sort by date + time
    list.sort((a, b) => {
      const dateComp = a.data_visita.localeCompare(b.data_visita);
      if (dateComp !== 0) return sortOrder === "asc" ? dateComp : -dateComp;
      const timeA = a.hora_visita || "99:99";
      const timeB = b.hora_visita || "99:99";
      const timeComp = timeA.localeCompare(timeB);
      return sortOrder === "asc" ? timeComp : -timeComp;
    });

    return list;
  }, [visitas, statusFilter, searchTerm, dateFrom, dateTo, sortOrder]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of visitas) {
      c[v.status] = (c[v.status] || 0) + 1;
    }
    return c;
  }, [visitas]);

  const hasDateFilter = !!dateFrom || !!dateTo;

  const clearDateFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Agenda de Visitas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Visão consolidada da empresa" : isGestor ? "Visitas da sua equipe" : "Suas visitas agendadas"}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Visita
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(["marcada", "confirmada", "realizada", "reagendada", "cancelada", "no_show"] as VisitaStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`rounded-lg border p-2 text-center transition-all cursor-pointer ${
              statusFilter === s ? "ring-2 ring-primary border-primary" : "hover:border-muted-foreground/30"
            }`}
          >
            <p className="text-lg font-bold">{counts[s] || 0}</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase">{STATUS_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Input
            placeholder="Buscar cliente, corretor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-sm h-9"
          />
        </div>

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 text-xs gap-1.5", dateFrom ? "border-primary text-primary" : "text-muted-foreground")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 text-xs gap-1.5", dateTo ? "border-primary text-primary" : "text-muted-foreground")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {/* Sort toggle */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-1.5"
          onClick={() => setSortOrder(s => s === "asc" ? "desc" : "asc")}
          title={sortOrder === "asc" ? "Mais antigas primeiro" : "Mais recentes primeiro"}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortOrder === "asc" ? "↑ Antiga" : "↓ Recente"}
        </Button>

        {/* Clear filters */}
        {(hasDateFilter || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { clearDateFilters(); setStatusFilter("all"); }}
            className="h-9 text-xs gap-1"
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="lista">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="lista" className="gap-1.5 text-xs">
            <List className="h-3.5 w-3.5" /> Lista
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" /> Calendário
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1.5 text-xs">
            <Columns3 className="h-3.5 w-3.5" /> Kanban
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <VisitasList
              visitas={filtered}
              onUpdateStatus={updateStatus}
              onDelete={deleteVisita}
              showCorretor={isAdmin || isGestor}
            />
          )}
        </TabsContent>

        <TabsContent value="calendario">
          <VisitasCalendar visitas={filtered} />
        </TabsContent>

        <TabsContent value="kanban">
          <VisitasKanban visitas={filtered} onUpdateStatus={updateStatus} onDelete={deleteVisita} />
        </TabsContent>
      </Tabs>

      {/* Create form */}
      {showForm && (
        <VisitaForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSubmit={createVisita}
        />
      )}
    </div>
  );
}
