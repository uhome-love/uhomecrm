import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, isBefore, startOfDay, startOfWeek, startOfMonth, endOfWeek, endOfMonth, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, List, AlertTriangle, History, BarChart3, MessageCircle, Users, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { useVisitas, STATUS_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import VisitasList from "@/components/visitas/VisitasList";
import VisitasCalendar from "@/components/visitas/VisitasCalendar";
import VisitaForm from "@/components/visitas/VisitaForm";
import VisitaTypeSelector from "@/components/visitas/VisitaTypeSelector";
import ReuniaoNegocioForm from "@/components/visitas/ReuniaoNegocioForm";
import VisitaResultadoDialog, { type ResultadoVisita } from "@/components/visitas/VisitaResultadoDialog";
import VisitasPerformance from "@/components/visitas/VisitasPerformance";
import AgendaHeader from "@/components/visitas/AgendaHeader";
import VisitasQuickFilters, { type QuickFilterKey } from "@/components/visitas/VisitasQuickFilters";
import VisitasCobrancaDialog from "@/components/visitas/VisitasCobrancaDialog";
import { toast } from "sonner";

const FIXED_TEAMS = [
  { key: "gabrielle", label: "Gabrielle", emoji: "🟢" },
  { key: "bruno", label: "Bruno", emoji: "🔵" },
  { key: "gabriel", label: "Gabriel", emoji: "🟣" },
];

// ─── Tab is the SINGLE SOURCE OF TRUTH for date range ───
type AgendaTab = "semana-atual" | "semana-anterior" | "mes" | "calendario" | "alertas" | "performance" | "meu-time";

function getDateRangeForTab(tab: AgendaTab): { from: string | null; to: string | null } {
  const today = startOfDay(new Date());
  switch (tab) {
    case "semana-atual":
      return {
        from: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        to: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "semana-anterior": {
      const prev = subWeeks(today, 1);
      return {
        from: format(startOfWeek(prev, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        to: format(endOfWeek(prev, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    case "mes":
      return {
        from: format(startOfMonth(today), "yyyy-MM-dd"),
        to: format(endOfMonth(today), "yyyy-MM-dd"),
      };
    default:
      return { from: null, to: null };
  }
}

export default function AgendaVisitas() {
  const { isAdmin, isGestor } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── CONTROLLED TAB = single source of truth for dates ───
  const [activeTab, setActiveTab] = useState<AgendaTab>("semana-atual");

  // Derived date range — no independent dateFrom/dateTo state
  const dateRange = useMemo(() => getDateRangeForTab(activeTab), [activeTab]);

  // ─── Other filters (independent of date) ───
  const [showForm, setShowForm] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showReuniaoForm, setShowReuniaoForm] = useState(false);
  const [editingVisita, setEditingVisita] = useState<Visita | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [corretorFilter, setCorretorFilter] = useState<string>(searchParams.get("corretor") || "all");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState<string>(searchParams.get("empreendimento") || "all");
  const [sortOrder] = useState<"asc" | "desc">("asc");
  const [resultadoVisita, setResultadoVisita] = useState<Visita | null>(null);
  const [showCobranca, setShowCobranca] = useState(false);
  const [agendaTipo, setAgendaTipo] = useState<"lead" | "negocio">((searchParams.get("tipo") as any) || "lead");
  const [teamFilter, setTeamFilter] = useState<string>(searchParams.get("team") || "all");
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("");

  // Sync to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (searchTerm) params.set("q", searchTerm);
    if (corretorFilter !== "all") params.set("corretor", corretorFilter);
    if (empreendimentoFilter !== "all") params.set("empreendimento", empreendimentoFilter);
    if (agendaTipo !== "lead") params.set("tipo", agendaTipo);
    if (teamFilter !== "all") params.set("team", teamFilter);
    if (quickFilter) params.set("quick", quickFilter);
    setSearchParams(params, { replace: true });
  }, [statusFilter, searchTerm, corretorFilter, empreendimentoFilter, agendaTipo, teamFilter, quickFilter, setSearchParams]);

  // ─── SERVER-SIDE date filtering: tab determines the query range ───
  // Tabs with date ranges (semana-atual, semana-anterior, mes) → server-filtered query
  const tabFilters = useMemo(() => {
    const f: { startDate?: string; endDate?: string } = {};
    if (dateRange.from) f.startDate = dateRange.from;
    if (dateRange.to) f.endDate = dateRange.to;
    return f;
  }, [dateRange]);

  const { visitas: tabVisitas, isLoading, createVisita, updateVisita, updateStatus, deleteVisita } = useVisitas(tabFilters);

  // Broad query (no date filter) for calendar, alertas, performance, pending counts
  const { visitas: allVisitas, isLoading: isLoadingAll } = useVisitas();

  // Split by tipo — own visitas only for main tabs
  const { user } = useAuth();
  // Gerentes/admins see ALL visitas in main tabs; corretores see only their own
  const visitas = useMemo(() => {
    const byTipo = tabVisitas.filter(v => ((v as any).tipo || "lead") === agendaTipo);
    if (isAdmin || isGestor) return byTipo;
    return byTipo.filter(v => v.corretor_id === user?.id);
  }, [tabVisitas, agendaTipo, user?.id, isAdmin, isGestor]);
  const teamVisitas = useMemo(() => tabVisitas.filter(v => ((v as any).tipo || "lead") === agendaTipo && v.corretor_id !== user?.id), [tabVisitas, agendaTipo, user?.id]);
  const allVisitasByTipo = useMemo(() => {
    const byTipo = allVisitas.filter(v => ((v as any).tipo || "lead") === agendaTipo);
    if (isAdmin || isGestor) return byTipo;
    return byTipo.filter(v => v.corretor_id === user?.id);
  }, [allVisitas, agendaTipo, isAdmin, isGestor, user?.id]);
  const negocioCount = useMemo(() => allVisitas.filter(v => (v as any).tipo === "negocio").length, [allVisitas]);
  const leadCount = useMemo(() => allVisitas.filter(v => (v as any).tipo !== "negocio").length, [allVisitas]);

  // Handlers
  const handleEdit = useCallback((visita: Visita) => setEditingVisita(visita), []);
  const handleEditSubmit = useCallback(async (data: Partial<Visita>) => {
    if (!editingVisita) return null;
    const result = await updateVisita(editingVisita.id, data);
    if (result) setEditingVisita(null);
    return result;
  }, [editingVisita, updateVisita]);

  const handleUpdateStatus = useCallback((id: string, newStatus: VisitaStatus) => {
    if (newStatus === "realizada") {
      const visita = visitas.find(v => v.id === id);
      if (visita) { setResultadoVisita(visita); return; }
    }
    updateStatus(id, newStatus);
  }, [visitas, updateStatus]);

  const handleResultadoSubmit = useCallback(async (resultado: ResultadoVisita, observacoes?: string, feedback?: { objecao?: string; temperatura?: string; proxima_acao?: string }) => {
    if (!resultadoVisita) return;
    const updates: any = { resultado_visita: resultado };
    if (observacoes) {
      updates.observacoes = [resultadoVisita.observacoes, observacoes].filter(Boolean).join(" | ");
    }
    await updateVisita(resultadoVisita.id, updates, true);
    await updateStatus(resultadoVisita.id, "realizada");

    if (resultadoVisita.pipeline_lead_id && feedback) {
      const leadUpdates: any = {};
      if (feedback.temperatura) leadUpdates.temperatura = feedback.temperatura;
      if (feedback.proxima_acao) leadUpdates.proxima_acao = feedback.proxima_acao;
      if (feedback.objecao) {
        leadUpdates.observacoes = [resultadoVisita.observacoes, `Objeção: ${feedback.objecao}`].filter(Boolean).join(" | ");
      }
      if (Object.keys(leadUpdates).length > 0) {
        await supabase.from("pipeline_leads").update({
          ...leadUpdates,
          ultima_acao_at: new Date().toISOString(),
        } as any).eq("id", resultadoVisita.pipeline_lead_id);
      }
    }
    setResultadoVisita(null);
  }, [resultadoVisita, updateVisita, updateStatus]);

  // Corretores/empreendimentos from broad dataset for dropdown options
  const { corretores, empreendimentos } = useMemo(() => {
    const cSet = new Map<string, string>();
    const eSet = new Set<string>();
    for (const v of allVisitasByTipo) {
      if (v.corretor_nome && v.corretor_id) cSet.set(v.corretor_id, v.corretor_nome);
      if (v.empreendimento) eSet.add(v.empreendimento);
    }
    return {
      corretores: Array.from(cSet.entries()).map(([id, nome]) => ({ id, nome })),
      empreendimentos: Array.from(eSet).sort(),
    };
  }, [allVisitasByTipo]);

  // Pending uses broad dataset (allVisitasByTipo) — past visitas may be outside tab range
  const pendingVisitas = useMemo(() => {
    const today = startOfDay(new Date());
    return allVisitasByTipo.filter(v => {
      const d = new Date(v.data_visita + "T12:00:00");
      return isBefore(d, today) && (v.status === "marcada" || v.status === "confirmada");
    });
  }, [allVisitasByTipo]);

  const pendingByCorretor = useMemo(() => {
    const map = new Map<string, { nome: string; count: number }>();
    for (const v of pendingVisitas) {
      const id = v.corretor_id || "unknown";
      if (!map.has(id)) map.set(id, { nome: v.corretor_nome || "Corretor", count: 0 });
      map.get(id)!.count++;
    }
    return Array.from(map.values());
  }, [pendingVisitas]);

  // ─── FILTERED list: date already server-side, apply remaining client-side filters ───
  const filtered = useMemo(() => {
    let list = [...visitas];

    // Status filter or quick filter status override
    if (statusFilter !== "all") list = list.filter(v => v.status === statusFilter);
    if (corretorFilter !== "all") list = list.filter(v => v.corretor_id === corretorFilter);
    if (empreendimentoFilter !== "all") list = list.filter(v => v.empreendimento === empreendimentoFilter);
    if (teamFilter !== "all") {
      list = list.filter(v => {
        const equipe = (v.equipe || "").toLowerCase().replace(/^equipe\s+/i, "").trim();
        return equipe.includes(teamFilter);
      });
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(v =>
        v.nome_cliente.toLowerCase().includes(term) ||
        v.empreendimento?.toLowerCase().includes(term) ||
        v.telefone?.includes(term) ||
        v.corretor_nome?.toLowerCase().includes(term)
      );
    }

    // Quick filter: sem_feedback = pending past visitas
    if (quickFilter === "sem_feedback") {
      const today = startOfDay(new Date());
      list = list.filter(v => {
        const d = new Date(v.data_visita + "T12:00:00");
        return isBefore(d, today) && (v.status === "marcada" || v.status === "confirmada");
      });
    }

    list.sort((a, b) => {
      const dateComp = a.data_visita.localeCompare(b.data_visita);
      if (dateComp !== 0) return sortOrder === "asc" ? dateComp : -dateComp;
      const timeA = a.hora_visita || "99:99";
      const timeB = b.hora_visita || "99:99";
      return sortOrder === "asc" ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
    });
    return list;
  }, [visitas, statusFilter, corretorFilter, empreendimentoFilter, searchTerm, sortOrder, teamFilter, quickFilter]);

  // Counts from broad dataset so chips show global totals
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of allVisitasByTipo) c[v.status] = (c[v.status] || 0) + 1;
    return c;
  }, [allVisitasByTipo]);

  // Calendar: all visitas with search/status/corretor filters but no tab date range
  const allVisitasFiltered = useMemo(() => {
    let list = [...allVisitas];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(v =>
        v.nome_cliente.toLowerCase().includes(term) ||
        v.empreendimento?.toLowerCase().includes(term) ||
        v.telefone?.includes(term) ||
        v.corretor_nome?.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== "all") list = list.filter(v => v.status === statusFilter);
    if (corretorFilter !== "all") list = list.filter(v => v.corretor_id === corretorFilter);
    if (empreendimentoFilter !== "all") list = list.filter(v => v.empreendimento === empreendimentoFilter);
    return list;
  }, [allVisitas, searchTerm, statusFilter, corretorFilter, empreendimentoFilter]);

  const hasFilters = statusFilter !== "all" || corretorFilter !== "all" || empreendimentoFilter !== "all" || searchTerm.trim() !== "" || teamFilter !== "all" || quickFilter !== "" || activeTab !== "semana-atual";

  const clearAll = useCallback(() => {
    setStatusFilter("all");
    setCorretorFilter("all");
    setEmpreendimentoFilter("all");
    setTeamFilter("all");
    setSearchTerm("");
    setQuickFilter("");
    setActiveTab("semana-atual"); // Reset tab = reset dates
  }, []);

  const handleQuickFilterChange = useCallback((key: QuickFilterKey) => {
    setQuickFilter(key);
  }, []);

  const showCorretor = isAdmin || isGestor;

  // Tab period labels
  const tabDateLabel = useMemo(() => {
    const today = new Date();
    switch (activeTab) {
      case "semana-atual":
        return `${format(startOfWeek(today, { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })} — ${format(endOfWeek(today, { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })}`;
      case "semana-anterior": {
        const prev = subWeeks(today, 1);
        return `${format(startOfWeek(prev, { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })} — ${format(endOfWeek(prev, { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })}`;
      }
      case "mes":
        return format(today, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
      default:
        return null;
    }
  }, [activeTab]);

  return (
    <div className="bg-[#f7f7f8] dark:bg-[#0f0f12] p-6 -m-6 min-h-full space-y-3">
      <PageHeader
        title="Agenda de visitas"
        icon={<CalendarDays size={18} strokeWidth={1.5} />}
        actions={
          <Button size="sm" className="bg-[#4F46E5] hover:bg-[#4338CA] text-white" onClick={() => setShowTypeSelector(true)}>
            <Plus size={14} className="mr-1" /> Nova Visita
          </Button>
        }
      />
      <AgendaHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        corretorFilter={corretorFilter}
        onCorretorChange={setCorretorFilter}
        corretores={corretores}
        empreendimentoFilter={empreendimentoFilter}
        onEmpreendimentoChange={setEmpreendimentoFilter}
        empreendimentos={empreendimentos}
        teamFilter={teamFilter}
        onTeamChange={setTeamFilter}
        teams={FIXED_TEAMS}
        agendaTipo={agendaTipo}
        onTipoChange={setAgendaTipo}
        leadCount={leadCount}
        negocioCount={negocioCount}
        onNewVisita={() => setShowTypeSelector(true)}
        hasFilters={hasFilters}
        onClearAll={clearAll}
        showCorretor={showCorretor}
        showTeam={isAdmin}
      />

      {/* ─── BLOCO 2: STATUS CHIPS + QUICK FILTERS ─── */}
      <VisitasQuickFilters
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        quickFilter={quickFilter}
        onQuickFilterChange={handleQuickFilterChange}
        counts={counts}
        totalCount={allVisitasByTipo.length}
      />

      {/* ─── CONTROLLED TABS ─── */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as AgendaTab)}>
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="semana-atual" className="gap-1.5 text-xs h-8 px-3">
            <CalendarDays className="h-3.5 w-3.5" /> Semana Atual
          </TabsTrigger>
          <TabsTrigger value="semana-anterior" className="gap-1.5 text-xs h-8 px-3">
            <History className="h-3.5 w-3.5" /> Semana Anterior
          </TabsTrigger>
          <TabsTrigger value="mes" className="gap-1.5 text-xs h-8 px-3">
            <List className="h-3.5 w-3.5" /> Mês
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5 text-xs h-8 px-3">
            <CalendarDays className="h-3.5 w-3.5" /> Calendário
          </TabsTrigger>
          {pendingVisitas.length > 0 && (
            <TabsTrigger value="alertas" className="gap-1.5 text-xs h-8 px-3 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> Alertas <Badge variant="destructive" className="text-[10px] ml-0.5 px-1.5 py-0">{pendingVisitas.length}</Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="meu-time" className="gap-1.5 text-xs h-8 px-3">
            <Users className="h-3.5 w-3.5" /> {(isAdmin || isGestor) ? "Meu Time" : "Time"}
            {teamVisitas.length > 0 && <Badge variant="secondary" className="text-[10px] ml-0.5 px-1.5 py-0">{teamVisitas.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 text-xs h-8 px-3">
            <BarChart3 className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
        </TabsList>

        {/* ─── SEMANA ATUAL ─── */}
        <TabsContent value="semana-atual" className="mt-3 space-y-3">
          {tabDateLabel && <Badge variant="secondary" className="text-xs">{tabDateLabel}</Badge>}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <VisitasList visitas={filtered} onUpdateStatus={handleUpdateStatus} onEdit={handleEdit} onDelete={deleteVisita} showCorretor={showCorretor} showTeam={isAdmin} mode="all" />
          )}
        </TabsContent>

        {/* ─── SEMANA ANTERIOR ─── */}
        <TabsContent value="semana-anterior" className="mt-3 space-y-3">
          {tabDateLabel && <Badge variant="secondary" className="text-xs">{tabDateLabel}</Badge>}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <VisitasList visitas={filtered} onUpdateStatus={handleUpdateStatus} onEdit={handleEdit} onDelete={deleteVisita} showCorretor={showCorretor} showTeam={isAdmin} mode="past" />
          )}
        </TabsContent>

        {/* ─── MÊS ─── */}
        <TabsContent value="mes" className="mt-3 space-y-3">
          {tabDateLabel && <Badge variant="secondary" className="text-xs">{tabDateLabel}</Badge>}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <VisitasList visitas={filtered} onUpdateStatus={handleUpdateStatus} onEdit={handleEdit} onDelete={deleteVisita} showCorretor={showCorretor} showTeam={isAdmin} mode="all" />
          )}
        </TabsContent>

        {/* ─── CALENDÁRIO ─── */}
        <TabsContent value="calendario" className="mt-3">
          <VisitasCalendar visitas={allVisitasFiltered} showTeam={isAdmin} />
        </TabsContent>

        {/* ─── MEU TIME ─── */}
        <TabsContent value="meu-time" className="mt-3 space-y-3">
          {tabDateLabel && <Badge variant="secondary" className="text-xs">{tabDateLabel}</Badge>}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : teamVisitas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma visita do time neste período.</p>
          ) : (
            <VisitasList visitas={teamVisitas} onUpdateStatus={handleUpdateStatus} onEdit={handleEdit} onDelete={deleteVisita} showCorretor showTeam={false} mode="all" />
          )}
        </TabsContent>

        {/* ─── PERFORMANCE ─── */}
        <TabsContent value="performance" className="mt-3">
          <VisitasPerformance visitas={allVisitasByTipo} showCorretor={showCorretor} />
        </TabsContent>

        {/* ─── ALERTAS ─── */}
        <TabsContent value="alertas" className="mt-3 space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="text-sm font-bold text-destructive">
                  {pendingVisitas.length} visita{pendingVisitas.length > 1 ? "s" : ""} sem atualização de status
                </h3>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" className="text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setShowCobranca(true)}>
                  <MessageCircle className="h-3.5 w-3.5" /> Cobrar todos
                </Button>
              )}
            </div>
            <VisitasList visitas={pendingVisitas} onUpdateStatus={handleUpdateStatus} onEdit={handleEdit} onDelete={deleteVisita} showCorretor={showCorretor} showTeam={isAdmin} mode="past" />
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── DIALOGS ─── */}
      <VisitaTypeSelector
        open={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelectImovel={() => { setShowTypeSelector(false); setShowForm(true); }}
        onSelectReuniao={() => { setShowTypeSelector(false); setShowReuniaoForm(true); }}
      />

      {showForm && (
        <VisitaForm open={showForm} onClose={() => setShowForm(false)} onSubmit={createVisita} />
      )}

      {showReuniaoForm && (
        <ReuniaoNegocioForm open={showReuniaoForm} onClose={() => setShowReuniaoForm(false)} onSubmit={createVisita} />
      )}

      {editingVisita && (
        <VisitaForm open={!!editingVisita} onClose={() => setEditingVisita(null)} onSubmit={handleEditSubmit} initialData={editingVisita} mode="edit" />
      )}

      {resultadoVisita && (
        <VisitaResultadoDialog open={!!resultadoVisita} onClose={() => setResultadoVisita(null)} onSubmit={handleResultadoSubmit} nomeCliente={resultadoVisita.nome_cliente} />
      )}

      <VisitasCobrancaDialog
        open={showCobranca}
        onOpenChange={setShowCobranca}
        pendingVisitas={pendingVisitas}
        pendingByCorretor={pendingByCorretor}
      />
    </div>
  );
}
