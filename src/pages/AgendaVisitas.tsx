import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  format, startOfDay, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth,
  addDays, isToday, isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, Search, X, Check, XCircle, Users, User } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { useVisitas, STATUS_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import VisitaForm from "@/components/visitas/VisitaForm";
import VisitaTypeSelector from "@/components/visitas/VisitaTypeSelector";
import ReuniaoNegocioForm from "@/components/visitas/ReuniaoNegocioForm";
import VisitaResultadoDialog, { type ResultadoVisita } from "@/components/visitas/VisitaResultadoDialog";
import VisitasCobrancaDialog from "@/components/visitas/VisitasCobrancaDialog";
import { toast } from "sonner";

/* ═══════ Period helpers ═══════ */
type Period = "hoje" | "semana" | "proxima-semana" | "mes";

function getDateRange(period: Period): { from: string; to: string } {
  const today = startOfDay(new Date());
  switch (period) {
    case "hoje":
      return { from: format(today, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "semana":
      return {
        from: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        to: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "proxima-semana": {
      const next = addWeeks(today, 1);
      return {
        from: format(startOfWeek(next, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        to: format(endOfWeek(next, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    case "mes":
      return {
        from: format(startOfMonth(today), "yyyy-MM-dd"),
        to: format(endOfMonth(today), "yyyy-MM-dd"),
      };
  }
}

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "proxima-semana", label: "Próxima semana" },
  { key: "mes", label: "Mês" },
];

const STATUS_PILL_COLORS: Record<string, string> = {
  marcada: "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30",
  confirmada: "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30",
  realizada: "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30",
  reagendada: "bg-[#f97316]/15 text-[#f97316] border-[#f97316]/30",
  no_show: "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30",
  cancelada: "bg-[#71717a]/15 text-[#71717a] border-[#71717a]/30",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  marcada: "bg-[#f59e0b]",
  confirmada: "bg-[#3b82f6]",
  realizada: "bg-[#10b981]",
  reagendada: "bg-[#f97316]",
  no_show: "bg-[#ef4444]",
  cancelada: "bg-[#71717a]",
};

/* ═══════ Mini week calendar ═══════ */
function MiniWeekCalendar({
  from,
  visitas,
  onDayClick,
  activeDayRef,
}: {
  from: string;
  visitas: Visita[];
  onDayClick: (dateStr: string) => void;
  activeDayRef?: string;
}) {
  const days = useMemo(() => {
    const start = new Date(from + "T12:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const key = format(d, "yyyy-MM-dd");
      const dayVisitas = visitas.filter(v => v.data_visita === key);
      const hasRealizada = dayVisitas.some(v => v.status === "realizada");
      const hasMarcada = dayVisitas.some(v => ["marcada", "confirmada", "reagendada"].includes(v.status));
      let dotColor = "bg-transparent";
      if (hasRealizada) dotColor = "bg-[#10b981]";
      else if (hasMarcada) dotColor = "bg-[#f59e0b]";
      else if (dayVisitas.length > 0) dotColor = "bg-[#a1a1aa]";
      return { date: d, key, dayVisitas, dotColor, count: dayVisitas.length };
    });
  }, [from, visitas]);

  const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d, i) => {
        const today = isToday(d.date);
        const active = activeDayRef === d.key;
        return (
          <button
            key={d.key}
            onClick={() => onDayClick(d.key)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 px-1 rounded-[10px] transition-all",
              today && !active && "bg-[#4F46E5]/5",
              active && "bg-[#4F46E5]/10 ring-1 ring-[#4F46E5]/30",
              !today && !active && "hover:bg-[#f7f7fb] dark:hover:bg-white/5"
            )}
          >
            <span className="text-[10px] font-medium text-[#a1a1aa]">{DAY_NAMES[i]}</span>
            <span className={cn(
              "text-[14px] font-bold w-7 h-7 flex items-center justify-center rounded-full",
              today ? "bg-[#4F46E5] text-white" : "text-[#0a0a0a] dark:text-[#fafafa]"
            )}>
              {format(d.date, "d")}
            </span>
            <div className={cn("w-1.5 h-1.5 rounded-full", d.dotColor)} />
            {d.count > 0 && (
              <span className="text-[9px] text-[#a1a1aa] font-medium">{d.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════ Compact visit card ═══════ */
function VisitaCompactCard({
  visita,
  showCorretor,
  isColleague,
  onEdit,
  onMarkRealizada,
  onMarkNoShow,
}: {
  visita: Visita;
  showCorretor: boolean;
  isColleague: boolean;
  onEdit: (v: Visita) => void;
  onMarkRealizada: (v: Visita) => void;
  onMarkNoShow: (id: string) => void;
}) {
  const isDone = visita.status === "realizada" || visita.status === "cancelada" || visita.status === "no_show";
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-[10px] border transition-all cursor-pointer group",
        isColleague
          ? "bg-[#f7f7fb]/60 dark:bg-white/3 border-[#e8e8f0]/60 dark:border-white/5"
          : "bg-white dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/8",
        "hover:border-[#4F46E5]/30"
      )}
      onClick={() => onEdit(visita)}
    >
      {/* Status dot */}
      <div className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT_COLORS[visita.status] || "bg-[#a1a1aa]")} />

      {/* Time */}
      <span className="text-[12px] font-mono font-semibold text-[#0a0a0a] dark:text-[#fafafa] w-[42px] shrink-0">
        {visita.hora_visita ? visita.hora_visita.slice(0, 5) : "—"}
      </span>

      {/* Client name */}
      <span className={cn(
        "text-[12px] font-semibold truncate min-w-0",
        isDone ? "text-[#a1a1aa] line-through" : "text-[#0a0a0a] dark:text-[#fafafa]"
      )}>
        {visita.nome_cliente}
      </span>

      {/* Empreendimento */}
      {visita.empreendimento && (
        <span className="text-[11px] text-[#a1a1aa] truncate hidden md:block max-w-[140px]">
          {visita.empreendimento}
        </span>
      )}

      {/* Corretor name (team mode) */}
      {showCorretor && visita.corretor_nome && (
        <span className={cn(
          "text-[11px] font-medium truncate hidden sm:block max-w-[100px]",
          isColleague ? "text-[#4F46E5]" : "text-[#71717a]"
        )}>
          {visita.corretor_nome.split(" ")[0]}
        </span>
      )}

      <div className="flex-1" />

      {/* Status pill */}
      <span className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0",
        STATUS_PILL_COLORS[visita.status] || "text-[#71717a] bg-[#f7f7fb] border-[#e8e8f0]"
      )}>
        {STATUS_LABELS[visita.status]}
      </span>

      {/* Quick actions */}
      {!isDone && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRealizada(visita); }}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#10b981]/10 text-[#10b981] transition-colors"
            title="Marcar como Realizada"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMarkNoShow(visita.id); }}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors"
            title="Marcar como No-show"
          >
            <XCircle size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════ Day group ═══════ */
function DayGroup({
  dateStr,
  visitas,
  showCorretor,
  userId,
  onEdit,
  onMarkRealizada,
  onMarkNoShow,
}: {
  dateStr: string;
  visitas: Visita[];
  showCorretor: boolean;
  userId: string | undefined;
  onEdit: (v: Visita) => void;
  onMarkRealizada: (v: Visita) => void;
  onMarkNoShow: (id: string) => void;
}) {
  const d = new Date(dateStr + "T12:00:00");
  const dayLabel = format(d, "EEEE", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
  const dateLabel = format(d, "dd 'de' MMMM", { locale: ptBR });
  const today = isToday(d);
  const realizadas = visitas.filter(v => v.status === "realizada").length;

  return (
    <div id={`day-${dateStr}`} className="space-y-1">
      {/* Day header */}
      <div className="flex items-center gap-2 px-1 py-1.5">
        <span className={cn(
          "text-[13px] font-bold tracking-[-0.2px]",
          today ? "text-[#4F46E5]" : "text-[#0a0a0a] dark:text-[#fafafa]"
        )}>
          {dayLabel}
        </span>
        <span className="text-[12px] text-[#a1a1aa]">· {dateLabel}</span>
        {today && (
          <span className="text-[10px] font-bold bg-[#4F46E5] text-white px-2 py-0.5 rounded-full">HOJE</span>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-[#a1a1aa]">
          {visitas.length} visita{visitas.length !== 1 ? "s" : ""}
          {realizadas > 0 && (
            <span className="text-[#10b981] font-semibold ml-1">· {realizadas} realizada{realizadas !== 1 ? "s" : ""}</span>
          )}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-1">
        {visitas.map(v => (
          <VisitaCompactCard
            key={v.id}
            visita={v}
            showCorretor={showCorretor}
            isColleague={!!userId && v.corretor_id !== userId}
            onEdit={onEdit}
            onMarkRealizada={onMarkRealizada}
            onMarkNoShow={onMarkNoShow}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════ MAIN PAGE ═══════ */
export default function AgendaVisitas() {
  const { isAdmin, isGestor } = useUserRole();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [period, setPeriod] = useState<Period>((searchParams.get("period") as Period) || "semana");
  const [showOnlyMine, setShowOnlyMine] = useState(!isAdmin && !isGestor);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [kpiFilter, setKpiFilter] = useState<string | null>(searchParams.get("status") || null);
  const [scrollToDay, setScrollToDay] = useState<string | null>(null);

  // Dialogs
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showReuniaoForm, setShowReuniaoForm] = useState(false);
  const [editingVisita, setEditingVisita] = useState<Visita | null>(null);
  const [resultadoVisita, setResultadoVisita] = useState<Visita | null>(null);
  const [showCobranca, setShowCobranca] = useState(false);

  // Data
  const dateRange = useMemo(() => getDateRange(period), [period]);
  const { visitas: rawVisitas, isLoading, createVisita, updateVisita, updateStatus, deleteVisita } = useVisitas({
    startDate: dateRange.from,
    endDate: dateRange.to,
  });
  const { visitas: allVisitas } = useVisitas();

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (period !== "semana") params.set("period", period);
    if (searchTerm) params.set("q", searchTerm);
    if (kpiFilter) params.set("status", kpiFilter);
    setSearchParams(params, { replace: true });
  }, [period, searchTerm, kpiFilter, setSearchParams]);

  // Scroll to day
  useEffect(() => {
    if (scrollToDay) {
      const el = document.getElementById(`day-${scrollToDay}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToDay(null);
    }
  }, [scrollToDay]);

  // Filter by visibility
  const visitas = useMemo(() => {
    let list = rawVisitas.filter(v => ((v as any).tipo || "lead") === "lead");
    if (showOnlyMine && user) {
      list = list.filter(v => v.corretor_id === user.id);
    } else if (!isAdmin && !isGestor && user) {
      list = list.filter(v => v.corretor_id === user.id);
    }
    return list;
  }, [rawVisitas, showOnlyMine, user, isAdmin, isGestor]);

  // Apply search + KPI filter
  const filtered = useMemo(() => {
    let list = [...visitas];
    if (kpiFilter) {
      if (kpiFilter === "marcadas") {
        list = list.filter(v => ["marcada", "confirmada", "reagendada"].includes(v.status));
      } else if (kpiFilter === "realizadas") {
        list = list.filter(v => v.status === "realizada");
      } else if (kpiFilter === "no_show") {
        list = list.filter(v => v.status === "no_show");
      }
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(v =>
        v.nome_cliente.toLowerCase().includes(term) ||
        v.empreendimento?.toLowerCase().includes(term) ||
        v.corretor_nome?.toLowerCase().includes(term)
      );
    }
    list.sort((a, b) => {
      const dc = a.data_visita.localeCompare(b.data_visita);
      if (dc !== 0) return dc;
      return (a.hora_visita || "99:99").localeCompare(b.hora_visita || "99:99");
    });
    return list;
  }, [visitas, kpiFilter, searchTerm]);

  // Group by day
  const dayGroups = useMemo(() => {
    const map = new Map<string, Visita[]>();
    for (const v of filtered) {
      if (!map.has(v.data_visita)) map.set(v.data_visita, []);
      map.get(v.data_visita)!.push(v);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // KPIs
  const kpis = useMemo(() => {
    const marcadas = visitas.filter(v => ["marcada", "confirmada", "reagendada"].includes(v.status)).length;
    const realizadas = visitas.filter(v => v.status === "realizada").length;
    const noShow = visitas.filter(v => v.status === "no_show").length;
    const taxa = marcadas + realizadas > 0 ? Math.round((realizadas / (marcadas + realizadas)) * 100) : 0;
    return { marcadas, realizadas, noShow, taxa };
  }, [visitas]);

  // Pending for cobranca
  const pendingVisitas = useMemo(() => {
    const today = startOfDay(new Date());
    const allByTipo = allVisitas.filter(v => ((v as any).tipo || "lead") === "lead");
    return allByTipo.filter(v => {
      const d = new Date(v.data_visita + "T12:00:00");
      return isBefore(d, today) && (v.status === "marcada" || v.status === "confirmada");
    });
  }, [allVisitas]);

  const pendingByCorretor = useMemo(() => {
    const map = new Map<string, { nome: string; count: number }>();
    for (const v of pendingVisitas) {
      const id = v.corretor_id || "unknown";
      if (!map.has(id)) map.set(id, { nome: v.corretor_nome || "Corretor", count: 0 });
      map.get(id)!.count++;
    }
    return Array.from(map.values());
  }, [pendingVisitas]);

  // Handlers
  const handleEdit = useCallback((visita: Visita) => setEditingVisita(visita), []);
  const handleEditSubmit = useCallback(async (data: Partial<Visita>) => {
    if (!editingVisita) return null;
    const result = await updateVisita(editingVisita.id, data);
    if (result) setEditingVisita(null);
    return result;
  }, [editingVisita, updateVisita]);

  const handleMarkRealizada = useCallback((visita: Visita) => {
    setResultadoVisita(visita);
  }, []);

  const handleMarkNoShow = useCallback((id: string) => {
    updateStatus(id, "no_show");
  }, [updateStatus]);

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

  const showCorretor = isAdmin || isGestor || !showOnlyMine;
  const showWeekCalendar = period === "semana" || period === "proxima-semana";

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-6 -m-6 min-h-full space-y-4">

      {/* ═══════ HEADER: Title + Search + Toggle + Nova Visita ═══════ */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-7 h-7 rounded-[7px] bg-[#4F46E5] flex items-center justify-center shrink-0">
          <CalendarDays size={13} strokeWidth={1.5} className="text-white" />
        </div>
        <h1 className="text-[16px] font-bold tracking-[-0.3px] text-[#0a0a0a] dark:text-[#fafafa]">
          Agenda de visitas
        </h1>

        {/* Search */}
        <div className="relative flex-1 max-w-[260px]">
          <Search size={13} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
          <input
            placeholder="Buscar cliente, empreend. ou corretor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-[12px] pl-8 pr-3 h-[32px] w-full bg-white dark:bg-white/5 border border-[#e8e8f0] dark:border-white/10 rounded-[8px] focus:border-[#4F46E5] transition-all outline-none text-[#0a0a0a] dark:text-[#fafafa] placeholder:text-[#a1a1aa]"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#71717a]">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Visibility toggle */}
        {(isAdmin || isGestor || true) && (
          <div className="flex items-center gap-0.5 bg-white dark:bg-white/5 border border-[#e8e8f0] dark:border-white/10 rounded-[8px] p-0.5">
            <button
              onClick={() => setShowOnlyMine(true)}
              className={cn(
                "text-[11px] font-medium px-2.5 py-1 rounded-[6px] transition-all flex items-center gap-1",
                showOnlyMine
                  ? "bg-[#4F46E5] text-white"
                  : "text-[#71717a] hover:text-[#0a0a0a] dark:hover:text-white"
              )}
            >
              <User size={11} /> Só minhas
            </button>
            <button
              onClick={() => setShowOnlyMine(false)}
              className={cn(
                "text-[11px] font-medium px-2.5 py-1 rounded-[6px] transition-all flex items-center gap-1",
                !showOnlyMine
                  ? "bg-[#4F46E5] text-white"
                  : "text-[#71717a] hover:text-[#0a0a0a] dark:hover:text-white"
              )}
            >
              <Users size={11} /> {isAdmin || isGestor ? "Meu time" : "Time"}
            </button>
          </div>
        )}

        {/* Cobrar (discrete) */}
        {isAdmin && pendingVisitas.length > 0 && (
          <button
            onClick={() => setShowCobranca(true)}
            className="text-[11px] text-[#ef4444] hover:bg-[#fef2f2] px-2 py-1 rounded-[6px] transition-colors"
          >
            {pendingVisitas.length} pendente{pendingVisitas.length !== 1 ? "s" : ""}
          </button>
        )}

        {/* Nova Visita */}
        <button
          onClick={() => setShowTypeSelector(true)}
          className="h-[32px] px-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[12px] font-semibold rounded-[8px] flex items-center gap-1.5 transition-colors"
        >
          <Plus size={13} strokeWidth={2} /> Nova Visita
        </button>
      </div>

      {/* ═══════ KPIs ═══════ */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: "marcadas", label: "Marcadas", value: kpis.marcadas, color: "text-[#f59e0b]", border: "border-l-[#f59e0b]" },
          { key: "realizadas", label: "Realizadas", value: kpis.realizadas, color: "text-[#10b981]", border: "border-l-[#10b981]" },
          { key: "no_show", label: "No-show", value: kpis.noShow, color: "text-[#ef4444]", border: "border-l-[#ef4444]" },
          { key: "taxa", label: "Taxa realização", value: `${kpis.taxa}%`, color: "text-[#4F46E5]", border: "border-l-[#4F46E5]" },
        ].map(kpi => (
          <button
            key={kpi.key}
            onClick={() => {
              if (kpi.key === "taxa") return;
              setKpiFilter(kpiFilter === kpi.key ? null : kpi.key);
            }}
            className={cn(
              "bg-white dark:bg-[#141e30] border border-[#e8e8f0] dark:border-white/8 border-l-[3px] rounded-[10px] p-3 text-left transition-all",
              kpi.border,
              kpi.key !== "taxa" && "cursor-pointer hover:border-[#d4d4d8] dark:hover:border-white/15",
              kpiFilter === kpi.key && "ring-2 ring-[#4F46E5]/30 bg-[#4F46E5]/[0.02]"
            )}
          >
            <p className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wide">{kpi.label}</p>
            <p className={cn("text-[22px] font-[800] leading-none mt-1 tracking-[-0.5px]", kpi.color)}>{kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Active filter badge */}
      {(kpiFilter || searchTerm) && (
        <div className="flex items-center gap-2">
          {kpiFilter && (
            <span className="text-[11px] bg-[#4F46E5]/10 text-[#4F46E5] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              Filtro: {kpiFilter === "marcadas" ? "Marcadas" : kpiFilter === "realizadas" ? "Realizadas" : "No-show"}
              <button onClick={() => setKpiFilter(null)} className="hover:text-[#4338CA]"><X size={10} /></button>
            </span>
          )}
          {searchTerm && (
            <span className="text-[11px] bg-[#71717a]/10 text-[#71717a] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              Busca: "{searchTerm}"
              <button onClick={() => setSearchTerm("")} className="hover:text-[#0a0a0a]"><X size={10} /></button>
            </span>
          )}
          <button
            onClick={() => { setKpiFilter(null); setSearchTerm(""); }}
            className="text-[11px] text-[#ef4444] hover:underline"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* ═══════ PERIOD PILLS ═══════ */}
      <div className="flex items-center gap-1">
        {PERIOD_OPTIONS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all",
              period === p.key
                ? "bg-[#4F46E5] text-white"
                : "text-[#71717a] bg-white dark:bg-white/5 border border-[#e8e8f0] dark:border-white/10 hover:text-[#0a0a0a] dark:hover:text-white"
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="text-[11px] text-[#a1a1aa] ml-2">
          {dateRange.from === dateRange.to
            ? format(new Date(dateRange.from + "T12:00:00"), "dd/MM/yyyy")
            : `${format(new Date(dateRange.from + "T12:00:00"), "dd/MM")} — ${format(new Date(dateRange.to + "T12:00:00"), "dd/MM")}`
          }
        </span>
      </div>

      {/* ═══════ MINI WEEK CALENDAR ═══════ */}
      {showWeekCalendar && (
        <div className="bg-white dark:bg-[#141e30] border border-[#e8e8f0] dark:border-white/8 rounded-[12px] p-3">
          <MiniWeekCalendar
            from={dateRange.from}
            visitas={visitas}
            onDayClick={(day) => setScrollToDay(day)}
          />
        </div>
      )}

      {/* ═══════ DAY LIST ═══════ */}
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-[#a1a1aa] text-center py-8">Carregando...</p>
        ) : dayGroups.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} strokeWidth={1.5} />}
            title="Nenhuma visita neste período"
            description="As visitas agendadas aparecerão aqui organizadas por dia"
          />
        ) : (
          dayGroups.map(([dateStr, dayVisitas]) => (
            <DayGroup
              key={dateStr}
              dateStr={dateStr}
              visitas={dayVisitas}
              showCorretor={showCorretor}
              userId={user?.id}
              onEdit={handleEdit}
              onMarkRealizada={handleMarkRealizada}
              onMarkNoShow={handleMarkNoShow}
            />
          ))
        )}
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
