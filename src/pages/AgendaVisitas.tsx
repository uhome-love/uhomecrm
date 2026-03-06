import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarDays, List, Columns3, Plus, Filter } from "lucide-react";
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

  const { visitas, isLoading, createVisita, updateStatus } = useVisitas();

  const filtered = useMemo(() => {
    let list = visitas;
    if (statusFilter !== "all") list = list.filter(v => v.status === statusFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(v =>
        v.nome_cliente.toLowerCase().includes(term) ||
        v.empreendimento?.toLowerCase().includes(term) ||
        v.telefone?.includes(term)
      );
    }
    return list;
  }, [visitas, statusFilter, searchTerm]);

  // Summary counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of visitas) {
      c[v.status] = (c[v.status] || 0) + 1;
    }
    return c;
  }, [visitas]);

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
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Input
            placeholder="Buscar cliente, empreendimento..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-sm h-9"
          />
        </div>
        {statusFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")} className="text-xs">
            Limpar filtro
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
              showCorretor={isAdmin || isGestor}
            />
          )}
        </TabsContent>

        <TabsContent value="calendario">
          <VisitasCalendar visitas={filtered} />
        </TabsContent>

        <TabsContent value="kanban">
          <VisitasKanban visitas={filtered} onUpdateStatus={updateStatus} />
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
