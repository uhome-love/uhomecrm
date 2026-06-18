import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  format, startOfDay, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth,
  addDays, isToday, isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, Search, X, Check, XCircle, Users, User, RotateCcw, ChevronDown, Link2, Link2Off, List, Columns3 } from "lucide-react";
import { useCalendarIntegration } from "@/hooks/useCalendarIntegration";
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
type Period = "hoje" | "semana" | "proxima-semana" | "mes" | "personalizado";

function getDateRange(period: Period, customFrom?: string, customTo?: string): { from: string; to: string } {
  if (period === "personalizado" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
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
    default:
      return { from: format(today, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
  }
}

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "proxima-semana", label: "Próxima semana" },
  { key: "mes", label: "Mês" },
  { key: "personalizado", label: "Personalizado" },
];

const STATUS_PILL_COLORS: Record<string, string> = {
  marcada: "bg-warning-500/15 text-warning-500 border-warning-500/30",
  confirmada: "bg-primary/15 text-primary border-primary/30",
  realizada: "bg-success-500/15 text-success-500 border-success-500/30",
  reagendada: "bg-[#f97316]/15 text-[#f97316] border-[#f97316]/30",
  no_show: "bg-danger-500/15 text-danger-500 border-danger-500/30",
  cancelada: "bg-neutral-500/15 text-neutral-500 border-neutral-500/30",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  marcada: "bg-warning-500",
  confirmada: "bg-primary",
  realizada: "bg-success-500",
  reagendada: "bg-[#f97316]",
  no_show: "bg-danger-500",
  cancelada: "bg-neutral-500",
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
      if (hasRealizada) dotColor = "bg-success-500";
      else if (hasMarcada) dotColor = "bg-warning-500";
      else if (dayVisitas.length > 0) dotColor = "bg-muted-foreground";
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
              today && !active && "bg-primary/5",
              active && "bg-primary/10 ring-1 ring-primary/30",
              !today && !active && "hover:bg-muted dark:hover:bg-white/5"
            )}
          >
            <span className="text-[10px] font-medium text-muted-foreground">{DAY_NAMES[i]}</span>
            <span className={cn(
              "text-[14px] font-bold w-7 h-7 flex items-center justify-center rounded-full",
              today ? "bg-primary text-white" : "text-foreground"
            )}>
              {format(d.date, "d")}
            </span>
            <div className={cn("w-1.5 h-1.5 rounded-full", d.dotColor)} />
            {d.count > 0 && (
              <span className="text-[9px] text-muted-foreground font-medium">{d.count}</span>
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
  onReabrir,
}: {
  visita: Visita;
  showCorretor: boolean;
  isColleague: boolean;
  onEdit: (v: Visita) => void;
  onMarkRealizada: (v: Visita) => void;
  onMarkNoShow: (id: string) => void;
  onReabrir: (id: string) => void;
}) {
  const isDone = visita.status === "realizada" || visita.status === "cancelada" || visita.status === "no_show";
  // Vencida sem desfecho: data passada e ainda marcada/confirmada
  const isOverdue = !isDone &&
    (visita.status === "marcada" || visita.status === "confirmada") &&
    isBefore(new Date(visita.data_visita + "T23:59:59"), startOfDay(new Date()));
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-[10px] border transition-all cursor-pointer group",
        isColleague
          ? "bg-muted/60 dark:bg-white/3 border-border/60 dark:border-white/5"
          : "bg-card border-border",
        isOverdue && "border-danger-500/40 bg-danger-500/[0.03]",
        "hover:border-primary/30"
      )}
      onClick={() => onEdit(visita)}
    >
      {/* Status dot */}
      <div className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT_COLORS[visita.status] || "bg-muted-foreground")} />

      {/* Time */}
      <span className="text-[12px] font-mono font-semibold text-foreground w-[42px] shrink-0">
        {visita.hora_visita ? visita.hora_visita.slice(0, 5) : "—"}
      </span>

      {/* Text block — uma linha no desktop, duas no mobile */}
      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            "text-[12px] font-semibold truncate min-w-0",
            isDone && visita.status !== "realizada" ? "text-muted-foreground line-through" : isDone ? "text-muted-foreground" : "text-foreground"
          )}>
            {visita.nome_cliente}
          </span>
          {visita.empreendimento && (
            <span className="text-[11px] text-muted-foreground truncate hidden md:block max-w-[140px]">
              {visita.empreendimento}
            </span>
          )}
          {showCorretor && visita.corretor_nome && (
            <span className={cn(
              "text-[11px] font-medium truncate hidden sm:block max-w-[100px]",
              isColleague ? "text-primary" : "text-neutral-500"
            )}>
              {visita.corretor_nome.split(" ")[0]}
            </span>
          )}
          {isOverdue && (
            <span className="text-[9px] font-bold text-danger-500 bg-danger-500/10 px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline">
              VENCIDA
            </span>
          )}
        </div>
        {/* Linha de meta no mobile */}
        {(visita.empreendimento || (showCorretor && visita.corretor_nome) || isOverdue) && (
          <div className="flex items-center gap-2 sm:hidden min-w-0">
            {visita.empreendimento && (
              <span className="text-[10px] text-muted-foreground truncate">{visita.empreendimento}</span>
            )}
            {showCorretor && visita.corretor_nome && (
              <span className={cn("text-[10px] font-medium truncate", isColleague ? "text-primary" : "text-neutral-500")}>
                {visita.corretor_nome.split(" ")[0]}
              </span>
            )}
            {isOverdue && (
              <span className="text-[9px] font-bold text-danger-500 shrink-0">VENCIDA</span>
            )}
          </div>
        )}
      </div>

      {/* Status pill */}
      <span className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline",
        STATUS_PILL_COLORS[visita.status] || "text-neutral-500 bg-muted border-border"
      )}>
        {STATUS_LABELS[visita.status]}
      </span>

      {/* Quick actions — sempre visíveis em touch, hover no desktop */}
      <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
        {visita.status !== "realizada" && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRealizada(visita); }}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-success-500/10 text-success-500 transition-colors"
            title="Marcar como Realizada"
            aria-label="Marcar como Realizada"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
        )}
        {visita.status !== "no_show" && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkNoShow(visita.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-danger-500/10 text-danger-500 transition-colors"
            title="Marcar como No-show"
            aria-label="Marcar como No-show"
          >
            <XCircle size={14} strokeWidth={2} />
          </button>
        )}
        {isDone && (
          <button
            onClick={(e) => { e.stopPropagation(); onReabrir(visita.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-primary/10 text-primary transition-colors"
            title="Reabrir visita (voltar para Marcada)"
            aria-label="Reabrir visita"
          >
            <RotateCcw size={13} strokeWidth={2.2} />
          </button>
        )}
      </div>
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
  onReabrir,
}: {
  dateStr: string;
  visitas: Visita[];
  showCorretor: boolean;
  userId: string | undefined;
  onEdit: (v: Visita) => void;
  onMarkRealizada: (v: Visita) => void;
  onMarkNoShow: (id: string) => void;
  onReabrir: (id: string) => void;
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
          today ? "text-primary" : "text-foreground"
        )}>
          {dayLabel}
        </span>
        <span className="text-[12px] text-muted-foreground">· {dateLabel}</span>
        {today && (
          <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">HOJE</span>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">
          {visitas.length} visita{visitas.length !== 1 ? "s" : ""}
          {realizadas > 0 && (
            <span className="text-success-500 font-semibold ml-1">· {realizadas} realizada{realizadas !== 1 ? "s" : ""}</span>
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
            onReabrir={onReabrir}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════ Week board (visão semanal por colunas) ═══════ */
function WeekBoard({
  from,
  visitas,
  onEdit,
  showCorretor,
}: {
  from: string;
  visitas: Visita[];
  onEdit: (v: Visita) => void;
  showCorretor: boolean;
}) {
  const days = useMemo(() => {
    const start = new Date(from + "T12:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const key = format(d, "yyyy-MM-dd");
      const dayVisitas = visitas
        .filter(v => v.data_visita === key)
        .sort((a, b) => (a.hora_visita || "99:99").localeCompare(b.hora_visita || "99:99"));
      return { date: d, key, dayVisitas };
    });
  }, [from, visitas]);

  const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid grid-cols-7 gap-2 min-w-[860px]">
        {days.map((d, i) => {
          const today = isToday(d.date);
          return (
            <div key={d.key} className="flex flex-col min-w-0">
              {/* Column header */}
              <div className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded-t-[10px] border border-b-0",
                today ? "bg-primary/10 border-primary/30" : "bg-card border-border"
              )}>
                <span className={cn("text-[11px] font-bold", today ? "text-primary" : "text-foreground")}>
                  {DAY_NAMES[i]} {format(d.date, "dd")}
                </span>
                {d.dayVisitas.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">{d.dayVisitas.length}</span>
                )}
              </div>
              {/* Column body */}
              <div className={cn(
                "flex-1 space-y-1 p-1.5 rounded-b-[10px] border min-h-[120px]",
                today ? "bg-primary/[0.03] border-primary/30" : "bg-background border-border"
              )}>
                {d.dayVisitas.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/60 text-center pt-3">—</p>
                ) : (
                  d.dayVisitas.map(v => {
                    const isDone = v.status === "realizada" || v.status === "cancelada" || v.status === "no_show";
                    return (
                      <button
                        key={v.id}
                        onClick={() => onEdit(v)}
                        className="w-full text-left px-2 py-1.5 rounded-[8px] border bg-card border-border hover:border-primary/40 transition-colors flex flex-col gap-0.5"
                      >
                        <div className="flex items-center gap-1">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT_COLORS[v.status] || "bg-muted-foreground")} />
                          <span className="text-[10px] font-mono font-semibold text-foreground">
                            {v.hora_visita ? v.hora_visita.slice(0, 5) : "—"}
                          </span>
                        </div>
                        <span className={cn(
                          "text-[11px] font-semibold truncate",
                          isDone && v.status !== "realizada" ? "text-muted-foreground line-through" : isDone ? "text-muted-foreground" : "text-foreground"
                        )}>
                          {v.nome_cliente}
                        </span>
                        {v.empreendimento && (
                          <span className="text-[9px] text-muted-foreground truncate">{v.empreendimento}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════ MAIN PAGE ═══════ */
export default function AgendaVisitas() {
  const { isAdmin, isGestor } = useUserRole();
  const { integration, connect, disconnect, connecting, disconnecting } = useCalendarIntegration();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [period, setPeriod] = useState<Period>((searchParams.get("period") as Period) || "semana");
  const [showOnlyMine, setShowOnlyMine] = useState(!isAdmin && !isGestor);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [kpiFilter, setKpiFilter] = useState<string | null>(searchParams.get("status") || null);
  const [equipeFilter, setEquipeFilter] = useState<string | null>(searchParams.get("equipe") || null);
  const [scrollToDay, setScrollToDay] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"lista" | "semana">("lista");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Applied custom range — só aplica ao clicar "Aplicar" (evita refetch a cada tecla)
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);
  const customError = customFrom && customTo && customFrom > customTo
    ? "A data inicial não pode ser maior que a final."
    : null;

  // Dialogs
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showReuniaoForm, setShowReuniaoForm] = useState(false);
  const [editingVisita, setEditingVisita] = useState<Visita | null>(null);
  const [resultadoVisita, setResultadoVisita] = useState<Visita | null>(null);
  const [showCobranca, setShowCobranca] = useState(false);

  // Data
  const dateRange = useMemo(
    () => getDateRange(period, appliedCustom?.from, appliedCustom?.to),
    [period, appliedCustom]
  );
  const { visitas: rawVisitas, isLoading, createVisita, updateVisita, updateStatus, deleteVisita } = useVisitas({
    startDate: dateRange.from,
    endDate: dateRange.to,
  });
  // Janela reduzida (30 dias atrás → hoje) só para calcular pendentes/cobrança — evita puxar base inteira
  const pendingRange = useMemo(() => {
    const today = startOfDay(new Date());
    return {
      from: format(addDays(today, -30), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    };
  }, []);
  const { visitas: allVisitas } = useVisitas({ startDate: pendingRange.from, endDate: pendingRange.to });

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (period !== "semana") params.set("period", period);
    if (searchTerm) params.set("q", searchTerm);
    if (kpiFilter) params.set("status", kpiFilter);
    if (equipeFilter) params.set("equipe", equipeFilter);
    setSearchParams(params, { replace: true });
  }, [period, searchTerm, kpiFilter, equipeFilter, setSearchParams]);

  // Sync state from URL when navegação externa muda ?status= (TabProvider não remonta)
  useEffect(() => {
    const s = searchParams.get("status");
    if ((s || null) !== kpiFilter) setKpiFilter(s || null);
  }, [searchParams]);

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
    }
    // When "Time" mode is active, show all visits (RLS already scopes visibility)
    return list;
  }, [rawVisitas, showOnlyMine, user]);

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
    if (equipeFilter) {
      list = list.filter(v => (v.equipe || "Sem equipe") === equipeFilter);
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
  }, [visitas, kpiFilter, equipeFilter, searchTerm]);

  // Equipes disponíveis (derivadas das visitas carregadas, sem filtro de equipe)
  const equipesDisponiveis = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of visitas) {
      const key = v.equipe || "Sem equipe";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [visitas]);

  // Group by day
  const dayGroups = useMemo(() => {
    const map = new Map<string, Visita[]>();
    for (const v of filtered) {
      if (!map.has(v.data_visita)) map.set(v.data_visita, []);
      map.get(v.data_visita)!.push(v);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // KPIs — refletem período + time + equipe + busca (tudo exceto o próprio kpiFilter)
  const kpiBase = useMemo(() => {
    let list = visitas;
    if (equipeFilter) {
      list = list.filter(v => (v.equipe || "Sem equipe") === equipeFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(v =>
        v.nome_cliente.toLowerCase().includes(term) ||
        v.empreendimento?.toLowerCase().includes(term) ||
        v.corretor_nome?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [visitas, equipeFilter, searchTerm]);

  const kpis = useMemo(() => {
    const marcadas = kpiBase.filter(v => ["marcada", "confirmada", "reagendada"].includes(v.status)).length;
    const realizadas = kpiBase.filter(v => v.status === "realizada").length;
    const noShow = kpiBase.filter(v => v.status === "no_show").length;
    // Taxa de comparecimento: das visitas com desfecho (realizada ou no-show), quantas compareceram
    const comDesfecho = realizadas + noShow;
    const taxa = comDesfecho > 0 ? Math.round((realizadas / comDesfecho) * 100) : 0;
    return { marcadas, realizadas, noShow, taxa };
  }, [kpiBase]);

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

  const handleReabrir = useCallback(async (id: string) => {
    // Limpa resultado anterior e volta status para "marcada" para permitir reclassificação
    await updateVisita(id, { resultado_visita: null } as any, true);
    await updateStatus(id, "marcada");
  }, [updateStatus, updateVisita]);

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
  const showWeekCalendar = period === "hoje" || period === "semana" || period === "proxima-semana";
  // Âncora do mini-calendário: início da semana que contém a data inicial do período
  const calendarFrom = useMemo(
    () => format(startOfWeek(new Date(dateRange.from + "T12:00:00"), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [dateRange.from]
  );

  return (
    <div className="bg-background p-6 -m-6 min-h-full space-y-4">

      {/* ═══════ HEADER ═══════ */}
      <div className="space-y-2">
        {/* Row 1: título + ações primárias */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[7px] bg-primary flex items-center justify-center shrink-0">
            <CalendarDays size={13} strokeWidth={1.5} className="text-white" />
          </div>
          <h1 className="text-[16px] font-bold tracking-[-0.3px] text-foreground">
            Agenda de visitas
          </h1>

          <div className="flex-1" />

          {/* Google Calendar — texto some no mobile */}
          {integration?.connected ? (
            <button
              onClick={() => disconnect()}
              disabled={disconnecting}
              title={`Conectado: ${integration.email}`}
              className="h-[32px] px-2.5 sm:px-3 bg-success-500/10 hover:bg-success-500/20 text-success-500 border border-success-500/30 text-[11px] font-semibold rounded-[8px] flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Link2 size={12} /> <span className="hidden sm:inline">Agenda conectada</span>
            </button>
          ) : (
            <button
              onClick={() => connect()}
              disabled={connecting}
              title="Vincular Google Agenda"
              className="h-[32px] px-2.5 sm:px-3 bg-white dark:bg-white/5 hover:bg-primary/5 text-primary border border-primary/30 text-[11px] font-semibold rounded-[8px] flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Link2Off size={12} /> <span className="hidden sm:inline">{connecting ? "Conectando…" : "Vincular Google Agenda"}</span>
            </button>
          )}

          {/* Nova Visita */}
          <button
            onClick={() => setShowTypeSelector(true)}
            className="h-[32px] px-3 sm:px-4 bg-primary hover:bg-primary-600 text-white text-[12px] font-semibold rounded-[8px] flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Plus size={13} strokeWidth={2} /> <span className="hidden sm:inline">Nova Visita</span><span className="sm:hidden">Nova</span>
          </button>
        </div>

        {/* Row 2: busca + filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px] max-w-[280px]">
            <Search size={13} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar cliente, empreend. ou corretor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="text-[12px] pl-8 pr-3 h-[32px] w-full bg-white dark:bg-white/5 border border-border dark:border-white/10 rounded-[8px] focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-neutral-500">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Visibility toggle */}
          <div className="flex items-center gap-0.5 bg-white dark:bg-white/5 border border-border dark:border-white/10 rounded-[8px] p-0.5 shrink-0">
            <button
              onClick={() => setShowOnlyMine(true)}
              className={cn(
                "text-[11px] font-medium px-2.5 py-1 rounded-[6px] transition-all flex items-center gap-1",
                showOnlyMine
                  ? "bg-primary text-white"
                  : "text-neutral-500 hover:text-foreground dark:hover:text-white"
              )}
            >
              <User size={11} /> Só minhas
            </button>
            <button
              onClick={() => setShowOnlyMine(false)}
              className={cn(
                "text-[11px] font-medium px-2.5 py-1 rounded-[6px] transition-all flex items-center gap-1",
                !showOnlyMine
                  ? "bg-primary text-white"
                  : "text-neutral-500 hover:text-foreground dark:hover:text-white"
              )}
            >
              <Users size={11} /> {isAdmin || isGestor ? "Meu time" : "Time"}
            </button>
          </div>

          {/* Filtro de Equipe (CEO/Admin/Gestor) */}
          {(isAdmin || isGestor) && !showOnlyMine && equipesDisponiveis.length > 1 && (
            <div className="relative shrink-0">
              <select
                value={equipeFilter || ""}
                onChange={(e) => setEquipeFilter(e.target.value || null)}
                className={cn(
                  "appearance-none text-[11px] font-medium h-[28px] pl-7 pr-7 rounded-[8px] border outline-none cursor-pointer transition-all",
                  equipeFilter
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-white dark:bg-white/5 border-border dark:border-white/10 text-neutral-500 hover:text-foreground dark:hover:text-white"
                )}
                title="Filtrar por equipe"
              >
                <option value="">Todas as equipes</option>
                {equipesDisponiveis.map((eq) => (
                  <option key={eq.nome} value={eq.nome}>{eq.nome} ({eq.total})</option>
                ))}
              </select>
              <Users size={11} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-current" />
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-current" />
            </div>
          )}

          {/* Cobrar (discrete) */}
          {isAdmin && pendingVisitas.length > 0 && (
            <button
              onClick={() => setShowCobranca(true)}
              className="text-[11px] text-danger-500 hover:bg-danger-50 px-2 py-1 rounded-[6px] transition-colors shrink-0"
            >
              {pendingVisitas.length} pendente{pendingVisitas.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* ═══════ KPIs ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {[
          { key: "criadas", label: "Criadas", value: kpiBase.length, color: "text-[#6366f1]", border: "border-l-[#6366f1]" },
          { key: "marcadas", label: "Marcadas", value: kpis.marcadas, color: "text-warning-500", border: "border-l-warning-500" },
          { key: "realizadas", label: "Realizadas", value: kpis.realizadas, color: "text-success-500", border: "border-l-success-500" },
          { key: "no_show", label: "No-show", value: kpis.noShow, color: "text-danger-500", border: "border-l-danger-500" },
          { key: "taxa", label: "Taxa comparecimento", value: `${kpis.taxa}%`, color: "text-primary", border: "border-l-primary" },
        ].map(kpi => {
          const isStatic = kpi.key === "taxa" || kpi.key === "criadas";
          const isActive = kpiFilter === kpi.key;
          const cardClass = cn(
            "bg-card border border-border border-l-[3px] rounded-[10px] p-3 text-left transition-all",
            kpi.border,
            !isStatic && "cursor-pointer hover:border-neutral-300 dark:hover:border-white/15",
            isActive && "ring-2 ring-primary/30 bg-primary/[0.02]"
          );
          const inner = (
            <>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={cn("text-[22px] font-[800] leading-none mt-1 tracking-[-0.5px]", kpi.color)}>{kpi.value}</p>
            </>
          );
          if (isStatic) {
            return <div key={kpi.key} className={cardClass}>{inner}</div>;
          }
          return (
            <button
              key={kpi.key}
              aria-pressed={isActive}
              onClick={() => setKpiFilter(isActive ? null : kpi.key)}
              className={cardClass}
            >
              {inner}
            </button>
          );
        })}
      </div>

      {/* Active filter badge */}
      {(kpiFilter || searchTerm || equipeFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          {kpiFilter && (
            <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              Filtro: {kpiFilter === "marcadas" ? "Marcadas" : kpiFilter === "realizadas" ? "Realizadas" : "No-show"}
              <button onClick={() => setKpiFilter(null)} className="hover:text-primary-600"><X size={10} /></button>
            </span>
          )}
          {equipeFilter && (
            <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              Equipe: {equipeFilter}
              <button onClick={() => setEquipeFilter(null)} className="hover:text-primary-600"><X size={10} /></button>
            </span>
          )}
          {searchTerm && (
            <span className="text-[11px] bg-neutral-500/10 text-neutral-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              Busca: "{searchTerm}"
              <button onClick={() => setSearchTerm("")} className="hover:text-foreground"><X size={10} /></button>
            </span>
          )}
          <button
            onClick={() => { setKpiFilter(null); setSearchTerm(""); setEquipeFilter(null); }}
            className="text-[11px] text-danger-500 hover:underline"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* ═══════ PERIOD PILLS + VIEW TOGGLE ═══════ */}
      <div className="flex items-center gap-1 flex-wrap">
        {PERIOD_OPTIONS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all",
              period === p.key
                ? "bg-primary text-white"
                : "text-neutral-500 bg-white dark:bg-white/5 border border-border dark:border-white/10 hover:text-foreground dark:hover:text-white"
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="text-[11px] text-muted-foreground ml-2">
          {dateRange.from === dateRange.to
            ? format(new Date(dateRange.from + "T12:00:00"), "dd/MM/yyyy")
            : `${format(new Date(dateRange.from + "T12:00:00"), "dd/MM")} — ${format(new Date(dateRange.to + "T12:00:00"), "dd/MM")}`
          }
        </span>

        <div className="flex-1" />

        {/* Visão: Lista | Semana */}
        <div className="flex items-center gap-0.5 bg-white dark:bg-white/5 border border-border dark:border-white/10 rounded-[8px] p-0.5">
          <button
            onClick={() => setViewMode("lista")}
            title="Visão em lista"
            aria-pressed={viewMode === "lista"}
            className={cn(
              "text-[11px] font-medium px-2 py-1 rounded-[6px] transition-all flex items-center gap-1",
              viewMode === "lista" ? "bg-primary text-white" : "text-neutral-500 hover:text-foreground dark:hover:text-white"
            )}
          >
            <List size={12} /> <span className="hidden sm:inline">Lista</span>
          </button>
          <button
            onClick={() => setViewMode("semana")}
            title="Visão semanal"
            aria-pressed={viewMode === "semana"}
            className={cn(
              "text-[11px] font-medium px-2 py-1 rounded-[6px] transition-all flex items-center gap-1",
              viewMode === "semana" ? "bg-primary text-white" : "text-neutral-500 hover:text-foreground dark:hover:text-white"
            )}
          >
            <Columns3 size={12} /> <span className="hidden sm:inline">Semana</span>
          </button>
        </div>
      </div>

      {/* ═══════ CUSTOM DATE RANGE ═══════ */}
      {period === "personalizado" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[12px] font-medium text-neutral-500">De:</label>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={e => setCustomFrom(e.target.value)}
              className="text-[12px] h-[32px] px-2 bg-white dark:bg-white/5 border border-border dark:border-white/10 rounded-[8px] outline-none focus:border-primary text-foreground transition-all"
            />
            <label className="text-[12px] font-medium text-neutral-500">Até:</label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={e => setCustomTo(e.target.value)}
              className="text-[12px] h-[32px] px-2 bg-white dark:bg-white/5 border border-border dark:border-white/10 rounded-[8px] outline-none focus:border-primary text-foreground transition-all"
            />
            <button
              disabled={!customFrom || !customTo || !!customError}
              onClick={() => setAppliedCustom({ from: customFrom, to: customTo })}
              className={cn(
                "h-[32px] px-4 text-[12px] font-semibold rounded-[8px] transition-all",
                customFrom && customTo && !customError
                  ? "bg-primary hover:bg-primary-600 text-white"
                  : "bg-border dark:bg-white/10 text-muted-foreground cursor-not-allowed"
              )}
            >
              Aplicar
            </button>
          </div>
          {customError && (
            <p className="text-[11px] text-danger-500 px-1">{customError}</p>
          )}
        </div>
      )}
      {showWeekCalendar && (
        <div className="bg-card border border-border rounded-[12px] p-3">
          <MiniWeekCalendar
            from={calendarFrom}
            visitas={visitas}
            onDayClick={(day) => setScrollToDay(day)}
            activeDayRef={period === "hoje" ? dateRange.from : undefined}
          />
        </div>
      )}

      {/* ═══════ DAY LIST ═══════ */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1].map(g => (
              <div key={g} className="space-y-1">
                <div className="h-4 w-40 rounded bg-border dark:bg-white/10 animate-pulse mb-2" />
                {[0, 1, 2].map(c => (
                  <div key={c} className="h-[44px] rounded-[10px] bg-card border border-border animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : dayGroups.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} strokeWidth={1.5} />}
            title="Nenhuma visita neste período"
            description="As visitas agendadas aparecerão aqui organizadas por dia"
          />
        ) : viewMode === "semana" ? (
          <WeekBoard from={calendarFrom} visitas={filtered} onEdit={handleEdit} />
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
              onReabrir={handleReabrir}
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
        <VisitaForm
          open={!!editingVisita}
          onClose={() => setEditingVisita(null)}
          onSubmit={handleEditSubmit}
          onDelete={async () => {
            const ok = await deleteVisita(editingVisita.id);
            if (ok !== false) setEditingVisita(null);
          }}
          initialData={editingVisita}
          mode="edit"
        />
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
