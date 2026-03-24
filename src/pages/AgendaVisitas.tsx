import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, isBefore, startOfDay, startOfWeek, startOfMonth, endOfWeek, endOfMonth, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, List, AlertTriangle, History, BarChart3, MessageCircle, Users, Plus, Search, X, LayoutGrid } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
import VisitasCobrancaDialog from "@/components/visitas/VisitasCobrancaDialog";
import { toast } from "sonner";

const FIXED_TEAMS = [
  { key: "gabrielle", label: "Gabrielle", emoji: "🟢" },
  { key: "bruno", label: "Bruno", emoji: "🔵" },
  { key: "gabriel", label: "Gabriel", emoji: "🟣" },
];

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

const STATUS_PILL_STYLES: Record<string, string> = {
  marcada: "text-[#f59e0b] bg-[#fffbeb] border-[#fde68a]",
  confirmada: "text-[#3b82f6] bg-[#eff6ff] border-[#bfdbfe]",
  realizada: "text-[#10b981] bg-[#f0fdf4] border-[#bbf7d0]",
  reagendada: "text-[#6366f1] bg-[#eef2ff] border-[#c7d2fe]",
  no_show: "text-[#ef4444] bg-[#fef2f2] border-[#fecaca]",
  cancelada: "text-[#52525b] bg-[#f7f7fb] border-[#e8e8f0]",
};

const STATUSES: VisitaStatus[] = ["marcada", "confirmada", "realizada", "reagendada", "no_show", "cancelada"];

const PERIOD_TABS: { key: AgendaTab; label: string }[] = [
  { key: "semana-atual", label: "Semana atual" },
  { key: "semana-anterior", label: "Anterior" },
  { key: "mes", label: "Mês" },
  { key: "calendario", label: "Calendário" },
];

export default function AgendaVisitas() {
  const { isAdmin, isGestor } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<AgendaTab>("semana-atual");
  const dateRange = useMemo(() => getDateRangeForTab(activeTab), [activeTab]);

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

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (searchTerm) params.set("q", searchTerm);
    if (corretorFilter !== "all") params.set("corretor", corretorFilter);
    if (empreendimentoFilter !== "all") params.set("empreendimento", empreendimentoFilter);
    if (agendaTipo !== "lead") params.set("tipo", agendaTipo);
    if (teamFilter !== "all") params.set("team", teamFilter);
    setSearchParams(params, { replace: true });
  }, [statusFilter, searchTerm, corretorFilter, empreendimentoFilter, agendaTipo, teamFilter, setSearchParams]);

  const tabFilters = useMemo(() => {
    const f: { startDate?: string; endDate?: string } = {};
    if (dateRange.from) f.startDate = dateRange.from;
    if (dateRange.to) f.endDate = dateRange.to;
    return f;
  }, [dateRange]);

  const { visitas: tabVisitas, isLoading, createVisita, updateVisita, updateStatus, deleteVisita } = useVisitas(tabFilters);
  const { visitas: allVisitas, isLoading: isLoadingAll } = useVisitas();

  const { user } = useAuth();
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

  const filtered = useMemo(() => {
    let list = [...visitas];
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
    list.sort((a, b) => {
      const dateComp = a.data_visita.localeCompare(b.data_visita);
      if (dateComp !== 0) return sortOrder === "asc" ? dateComp : -dateComp;
      const timeA = a.hora_visita || "99:99";
      const timeB = b.hora_visita || "99:99";
      return sortOrder === "asc" ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
    });
    return list;
  }, [visitas, statusFilter, corretorFilter, empreendimentoFilter, searchTerm, sortOrder, teamFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of allVisitasByTipo) c[v.status] = (c[v.status] || 0) + 1;
    return c;
  }, [allVisitasByTipo]);

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

  const hasFilters = statusFilter !== "all" || corretorFilter !== "all" || empreendimentoFilter !== "all" || searchTerm.trim() !== "" || teamFilter !== "all";

  const clearAll = useCallback(() => {
    setStatusFilter("all");
    setCorretorFilter("all");
    setEmpreendimentoFilter("all");
    setTeamFilter("all");
    setSearchTerm("");
    setActiveTab("semana-atual");
  }, []);

  const showCorretor = isAdmin || isGestor;

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

  // Determine which content to render based on activeTab
  const renderContent = () => {
    if (activeTab === "calendario") {
      return <VisitasCalendar visitas={allVisitasFiltered} showTeam={isAdmin} />;
    }
    if (activeTab === "performance") {
      return <VisitasPerformance visitas={allVisitasByTipo} showCorretor={showCorretor} />;
    }
    if (activeTab === "alertas") {
      return (
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
      );
    }
    if (activeTab === "meu-time") {
      if (isLoading) return <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>;
      if (teamVisitas.length === 0) {
        return (
          <EmptyState
            icon={<CalendarDays size={22} strokeWidth={1.5} />}
            title="Nenhuma visita do time"
            description="As visitas agendadas pelo time aparecerão aqui"
          />
        );
      }
      return <VisitasList visitas={teamVisitas} onUpdateStatus={handleUpdateStatus} onEdit={handleEdit} onDelete={deleteVisita} showCorretor showTeam={false} mode="all" />;
    }
    // Default: semana-atual, semana-anterior, mes
    if (isLoading) return <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>;
    const mode = activeTab === "semana-anterior" ? "past" : "all";
    return <VisitasList visitas={filtered} onUpdateStatus={handleUpdateStatus} onEdit={handleEdit} onDelete={deleteVisita} showCorretor={showCorretor} showTeam={isAdmin} mode={mode as any} />;
  };

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-6 -m-6 min-h-full space-y-3">

      {/* ═══════ LINE 1: Title + Filters + Toggle + Nova Visita ═══════ */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Icon + Title */}
        <div className="w-7 h-7 rounded-[7px] bg-[#4F46E5] flex items-center justify-center flex-shrink-0">
          <CalendarDays size={13} strokeWidth={1.5} className="text-white" />
        </div>
        <h1 className="text-[16px] font-bold tracking-[-0.3px] text-[#0a0a0a] dark:text-[#fafafa]">Agenda de visitas</h1>
        <span className="text-[12px] text-[#a1a1aa]">{allVisitasByTipo.length} visitas</span>

        <div className="flex-1" />

        {/* Filters */}
        {showCorretor && corretores.length > 1 && (
          <Select value={corretorFilter} onValueChange={setCorretorFilter}>
            <SelectTrigger className="h-[32px] w-[150px] text-[12px] bg-[#f7f7fb] dark:bg-white/5 border-[#e8e8f0] dark:border-white/10 rounded-[8px] focus:border-[#4F46E5]">
              <SelectValue placeholder="Todos corretores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos corretores</SelectItem>
              {corretores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {empreendimentos.length > 1 && (
          <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter}>
            <SelectTrigger className="h-[32px] w-[150px] text-[12px] bg-[#f7f7fb] dark:bg-white/5 border-[#e8e8f0] dark:border-white/10 rounded-[8px] focus:border-[#4F46E5]">
              <SelectValue placeholder="Todos empreend." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos empreend.</SelectItem>
              {empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {isAdmin && (
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-[32px] w-[140px] text-[12px] bg-[#f7f7fb] dark:bg-white/5 border-[#e8e8f0] dark:border-white/10 rounded-[8px] focus:border-[#4F46E5]">
              <SelectValue placeholder="Todas equipes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas equipes</SelectItem>
              {FIXED_TEAMS.map(t => <SelectItem key={t.key} value={t.key}>{t.emoji} {t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={12} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
          <input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-[12px] pl-7 pr-3 h-[32px] w-[160px] bg-[#f7f7fb] dark:bg-white/5 border border-[#e8e8f0] dark:border-white/10 rounded-[8px] focus:border-[#4F46E5] focus:w-[200px] transition-all outline-none text-[#0a0a0a] dark:text-[#fafafa] placeholder:text-[#a1a1aa]"
          />
        </div>

        {/* Visitas / Negócios toggle */}
        <div className="flex items-center gap-0.5 bg-[#f7f7fb] dark:bg-white/5 border border-[#e8e8f0] dark:border-white/10 rounded-[8px] p-0.5">
          <button
            onClick={() => setAgendaTipo("lead")}
            className={cn(
              "text-[12px] font-medium px-3 py-1 rounded-[6px] transition-all",
              agendaTipo === "lead"
                ? "bg-[#4F46E5] text-white"
                : "text-[#71717a] hover:text-[#0a0a0a] dark:hover:text-white"
            )}
          >
            Visitas {leadCount}
          </button>
          <button
            onClick={() => setAgendaTipo("negocio")}
            className={cn(
              "text-[12px] font-medium px-3 py-1 rounded-[6px] transition-all",
              agendaTipo === "negocio"
                ? "bg-[#4F46E5] text-white"
                : "text-[#71717a] hover:text-[#0a0a0a] dark:hover:text-white"
            )}
          >
            Negócios {negocioCount}
          </button>
        </div>

        {/* Nova Visita — single instance */}
        <button
          onClick={() => setShowTypeSelector(true)}
          className="h-[32px] px-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[12px] font-semibold rounded-[8px] flex items-center gap-1.5 transition-colors"
        >
          <Plus size={13} strokeWidth={2} /> Nova Visita
        </button>

        {hasFilters && (
          <button onClick={clearAll} className="h-[32px] px-2 text-[11px] text-[#ef4444] hover:bg-[#fef2f2] rounded-[8px] flex items-center gap-1 transition-colors">
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* ═══════ LINE 2: Status pills (left) + Period tabs (right) ═══════ */}
      <div className="flex items-center justify-between gap-3">
        {/* Status pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1 rounded-[7px] text-[12px] font-medium whitespace-nowrap transition-all border",
              statusFilter === "all"
                ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                : "text-[#71717a] bg-[#f7f7fb] dark:bg-white/5 border-[#e8e8f0] dark:border-white/10 hover:text-[#0a0a0a]"
            )}
          >
            Todas {allVisitasByTipo.length}
          </button>
          {STATUSES.map(s => {
            const count = counts[s] || 0;
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                className={cn(
                  "px-3 py-1 rounded-[7px] text-[12px] font-medium whitespace-nowrap transition-all border",
                  isActive
                    ? STATUS_PILL_STYLES[s]
                    : count === 0
                      ? "text-[#a1a1aa]/40 bg-[#f7f7fb]/50 dark:bg-white/3 border-transparent cursor-default"
                      : "text-[#71717a] bg-[#f7f7fb] dark:bg-white/5 border-[#e8e8f0] dark:border-white/10 hover:text-[#0a0a0a]"
                )}
              >
                {STATUS_LABELS[s]} {count}
              </button>
            );
          })}
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {PERIOD_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "px-3 py-1 rounded-[7px] text-[12px] font-medium whitespace-nowrap transition-all",
                activeTab === t.key
                  ? "bg-[#4F46E5] text-white"
                  : "text-[#71717a] hover:bg-[#f0f0f5] dark:hover:bg-white/5"
              )}
            >
              {t.label}
            </button>
          ))}

          {pendingVisitas.length > 0 && (
            <button
              onClick={() => setActiveTab("alertas")}
              className={cn(
                "px-3 py-1 rounded-[7px] text-[12px] font-medium whitespace-nowrap transition-all",
                activeTab === "alertas"
                  ? "bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]"
                  : "text-[#ef4444] hover:bg-[#fef2f2]"
              )}
            >
              Alertas <span className="bg-[#ef4444] text-white text-[10px] rounded-full px-1.5 ml-0.5 inline-flex items-center justify-center">{pendingVisitas.length}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("meu-time")}
            className={cn(
              "px-3 py-1 rounded-[7px] text-[12px] font-medium whitespace-nowrap transition-all",
              activeTab === "meu-time"
                ? "bg-[#4F46E5] text-white"
                : "text-[#71717a] hover:bg-[#f0f0f5] dark:hover:bg-white/5"
            )}
          >
            {(isAdmin || isGestor) ? "Meu Time" : "Time"}
            {teamVisitas.length > 0 && <span className="text-[#4F46E5] font-semibold ml-1">{teamVisitas.length}</span>}
          </button>

          <button
            onClick={() => setActiveTab("performance")}
            className={cn(
              "px-3 py-1 rounded-[7px] text-[12px] font-medium whitespace-nowrap transition-all",
              activeTab === "performance"
                ? "bg-[#4F46E5] text-white"
                : "text-[#71717a] hover:bg-[#f0f0f5] dark:hover:bg-white/5"
            )}
          >
            Performance
          </button>
        </div>
      </div>

      {/* Date label */}
      {tabDateLabel && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#a1a1aa] font-medium">{tabDateLabel}</span>
        </div>
      )}

      {/* ═══════ CONTENT ═══════ */}
      <div className="mt-1">
        {renderContent()}
      </div>

      {/* ═══════ DIALOGS ═══════ */}
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
