import { useState, useMemo, useCallback } from "react";
import { format, isToday, isTomorrow, isBefore, startOfDay, startOfWeek, startOfMonth, endOfWeek, endOfMonth, addDays, isWithinInterval, subMonths, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, List, Users, Plus, CalendarIcon, X, ArrowUpDown, Search, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, TrendingUp, MessageCircle, Users2, History, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVisitas, STATUS_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { getTeamBadgeStyle } from "@/components/visitas/VisitaRow";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import VisitasList from "@/components/visitas/VisitasList";
import VisitasByCorretor from "@/components/visitas/VisitasByCorretor";
import VisitasCalendar from "@/components/visitas/VisitasCalendar";
import VisitaForm from "@/components/visitas/VisitaForm";
import VisitaTypeSelector from "@/components/visitas/VisitaTypeSelector";
import ReuniaoNegocioForm from "@/components/visitas/ReuniaoNegocioForm";
import VisitaResultadoDialog, { type ResultadoVisita } from "@/components/visitas/VisitaResultadoDialog";
import VisitasEquipe from "@/components/visitas/VisitasEquipe";
import VisitasPerformance from "@/components/visitas/VisitasPerformance";


const FIXED_TEAMS = [
  { key: "gabrielle", label: "Gabrielle", emoji: "🟢", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  { key: "bruno", label: "Bruno", emoji: "🔵", className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { key: "gabriel", label: "Gabriel", emoji: "🟣", className: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
];


// ─── Day Summary Card ───
type PlacarPeriodo = "dia" | "semana" | "mes";

function DaySummary({ visitas, showTeamBreakdown }: { visitas: Visita[]; showTeamBreakdown?: boolean }) {
  const [periodo, setPeriodo] = useState<PlacarPeriodo>("dia");
  const today = startOfDay(new Date());

  const periodVisitas = useMemo(() => {
    if (periodo === "dia") {
      return visitas.filter(v => isToday(new Date(v.data_visita + "T12:00:00")));
    }
    const start = periodo === "semana"
      ? startOfWeek(today, { weekStartsOn: 1 })
      : startOfMonth(today);
    const end = periodo === "semana"
      ? endOfWeek(today, { weekStartsOn: 1 })
      : endOfMonth(today);
    return visitas.filter(v => {
      const d = new Date(v.data_visita + "T12:00:00");
      return isWithinInterval(d, { start, end });
    });
  }, [visitas, periodo, today]);

  const realizadas = periodVisitas.filter(v => v.status === "realizada").length;
  const noShows = periodVisitas.filter(v => v.status === "no_show").length;
  const reagendadas = periodVisitas.filter(v => v.status === "reagendada").length;
  const pendentes = periodVisitas.filter(v => v.status === "marcada" || v.status === "confirmada").length;
  const total = periodVisitas.length;
  const taxa = total > 0 ? Math.round((realizadas / total) * 100) : 0;

  const periodoLabel = periodo === "dia" ? "Hoje" : periodo === "semana" ? "Semana" : "Mês";

  // Team breakdown
  const teamStats = useMemo(() => {
    if (!showTeamBreakdown) return [];
    const map = new Map<string, { total: number; realizadas: number }>();
    FIXED_TEAMS.forEach(t => map.set(t.key, { total: 0, realizadas: 0 }));
    for (const v of periodVisitas) {
      const equipe = (v.equipe || "").toLowerCase().replace(/^equipe\s+/i, "").trim();
      const teamKey = FIXED_TEAMS.find(t => equipe.includes(t.key))?.key;
      if (teamKey) {
        const s = map.get(teamKey)!;
        s.total++;
        if (v.status === "realizada") s.realizadas++;
      }
    }
    return FIXED_TEAMS.map(t => ({
      name: t.key,
      label: t.label,
      emoji: t.emoji,
      className: t.className,
      ...map.get(t.key)!,
    }));
  }, [periodVisitas, showTeamBreakdown]);

  if (total === 0 && periodo === "dia") return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground tracking-tight">Placar</span>
        </div>
        <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5">
          {(["dia", "semana", "mes"] as PlacarPeriodo[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={cn(
                "px-3 py-1 rounded-md text-[11px] font-bold transition-all",
                periodo === p
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "dia" ? "Dia" : p === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-0 divide-x divide-border/40">
        {[
          { value: total, label: periodoLabel, emoji: "📅", color: "text-foreground" },
          { value: realizadas, label: "Realizadas", emoji: "✅", color: "text-emerald-600" },
          { value: noShows, label: "No Show", emoji: "❌", color: "text-destructive" },
          { value: reagendadas, label: "Reagend.", emoji: "🔄", color: "text-purple-600" },
          { value: pendentes, label: "Pendentes", emoji: "⏳", color: "text-amber-600" },
        ].map((item, i) => (
          <div key={i} className="text-center flex-1 py-1">
            <p className={cn("text-base font-black", item.color)}>{item.value}</p>
            <p className="text-[9px] text-muted-foreground font-medium">{item.emoji} {item.label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        <Progress value={taxa} className="flex-1 h-1.5" />
        <span className={cn("text-[11px] font-bold tabular-nums", taxa >= 70 ? "text-emerald-600" : taxa >= 40 ? "text-amber-600" : "text-destructive")}>
          {taxa}% realização
        </span>
      </div>

      {/* Team breakdown for CEO/admin */}
      {showTeamBreakdown && teamStats.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-4 flex-wrap">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Equipes</span>
          {teamStats.map(t => (
            <div key={t.name} className="flex items-center gap-1.5">
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap font-bold", t.className)}>
                {t.emoji} {t.label}
              </span>
              <span className="text-[10px] text-foreground font-bold">{t.total}</span>
              <span className="text-[10px] text-emerald-600 font-semibold">{t.realizadas}✅</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STATUS chip colors ───
const STATUS_CHIP_COLORS: Record<string, string> = {
  marcada: "bg-amber-100 text-amber-700 border-amber-300",
  confirmada: "bg-blue-100 text-blue-700 border-blue-300",
  realizada: "bg-green-100 text-green-700 border-green-300",
  reagendada: "bg-purple-100 text-purple-700 border-purple-300",
  cancelada: "bg-gray-100 text-gray-600 border-gray-300",
  no_show: "bg-red-100 text-red-700 border-red-300",
};

const STATUS_EMOJIS: Record<string, string> = {
  marcada: "🟡", confirmada: "🔵", realizada: "✅", reagendada: "🔄", cancelada: "⚫", no_show: "❌",
};

export default function AgendaVisitas() {
  const { isAdmin, isGestor } = useUserRole();
  const [showForm, setShowForm] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showReuniaoForm, setShowReuniaoForm] = useState(false);
  const [editingVisita, setEditingVisita] = useState<Visita | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [corretorFilter, setCorretorFilter] = useState<string>("all");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [resultadoVisita, setResultadoVisita] = useState<Visita | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [showCobranca, setShowCobranca] = useState(false);
  const [cobrancaMsg, setCobrancaMsg] = useState("");
  const [sendingCobranca, setSendingCobranca] = useState(false);
  const [agendaTipo, setAgendaTipo] = useState<"lead" | "negocio">("lead");
  const [leadSubTab, setLeadSubTab] = useState<"minhas" | "time">("minhas");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [anterioresPeriodo, setAnterioresPeriodo] = useState<string>("mes-atual");
  const [anterioresCustomFrom, setAnterioresCustomFrom] = useState<Date | undefined>();
  const [anterioresCustomTo, setAnterioresCustomTo] = useState<Date | undefined>();

  const { visitas: allVisitas, isLoading, createVisita, updateVisita, updateStatus, deleteVisita } = useVisitas();

  // Split visitas by tipo
  const visitas = useMemo(() => {
    return allVisitas.filter(v => {
      const tipo = (v as any).tipo || "lead";
      return tipo === agendaTipo;
    });
  }, [allVisitas, agendaTipo]);

  const negocioCount = useMemo(() => allVisitas.filter(v => (v as any).tipo === "negocio").length, [allVisitas]);
  const leadCount = useMemo(() => allVisitas.filter(v => (v as any).tipo !== "negocio").length, [allVisitas]);

  const handleEdit = useCallback((visita: Visita) => {
    setEditingVisita(visita);
  }, []);

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

  const handleResultadoSubmit = useCallback(async (resultado: ResultadoVisita, observacoes?: string) => {
    if (!resultadoVisita) return;
    // First update resultado_visita and observacoes
    const updates: any = { resultado_visita: resultado };
    if (observacoes) {
      updates.observacoes = [resultadoVisita.observacoes, observacoes].filter(Boolean).join(" | ");
    }
    await updateVisita(resultadoVisita.id, updates, true);
    // Then call updateStatus which triggers negócio creation + pipeline move
    await updateStatus(resultadoVisita.id, "realizada");
    setResultadoVisita(null);
  }, [resultadoVisita, updateVisita, updateStatus]);

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

  const pendingVisitas = useMemo(() => {
    const today = startOfDay(new Date());
    return visitas.filter(v => {
      const d = new Date(v.data_visita + "T12:00:00");
      return isBefore(d, today) && (v.status === "marcada" || v.status === "confirmada");
    });
  }, [visitas]);

  const pendingCount = pendingVisitas.length;

  // Group pending visitas by corretor for cobrança
  const pendingByCorretor = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; telefone?: string }>();
    for (const v of pendingVisitas) {
      const id = v.corretor_id || "unknown";
      if (!map.has(id)) map.set(id, { nome: v.corretor_nome || "Corretor", count: 0 });
      map.get(id)!.count++;
    }
    return Array.from(map.values());
  }, [pendingVisitas]);

  const openCobranca = useCallback(() => {
    const defaultMsg = (nome: string, count: number) =>
      `Oi ${nome.split(" ")[0]}! 👋 Você tem ${count} visita${count > 1 ? "s" : ""} sem status atualizado no UhomeSales. Por favor, acesse o sistema e atualize: Realizada, No Show ou Reagendada. Obrigado! 🏠`;
    setCobrancaMsg(defaultMsg("[nome]", 0));
    setShowCobranca(true);
  }, []);

  const sendCobranca = useCallback(async () => {
    setSendingCobranca(true);
    try {
      const corretorIds = [...new Set(pendingVisitas.map(v => v.corretor_id).filter(Boolean))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, telefone")
        .in("user_id", corretorIds);

      let sent = 0;
      for (const p of profiles || []) {
        if (!p.telefone) continue;
        const count = pendingVisitas.filter(v => v.corretor_id === p.user_id).length;
        const msg = cobrancaMsg
          .replace("[nome]", p.nome?.split(" ")[0] || "")
          .replace("[X]", String(count));

        await supabase.functions.invoke("whatsapp-notificacao", {
          body: { telefone: p.telefone, mensagem: msg, tipo: "cobranca_visita" },
        });
        sent++;
      }
      toast.success(`✅ Cobrança enviada para ${sent} corretor${sent !== 1 ? "es" : ""}`);
      setShowCobranca(false);
    } catch (e) {
      toast.error("Erro ao enviar cobranças");
    } finally {
      setSendingCobranca(false);
    }
  }, [pendingVisitas, cobrancaMsg]);

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
    if (dateFrom) {
      const fromStr = format(dateFrom, "yyyy-MM-dd");
      list = list.filter(v => v.data_visita >= fromStr);
    }
    if (dateTo) {
      const toStr = format(dateTo, "yyyy-MM-dd");
      list = list.filter(v => v.data_visita <= toStr);
    }
    if (pendingOnly) {
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
  }, [visitas, statusFilter, corretorFilter, empreendimentoFilter, searchTerm, dateFrom, dateTo, sortOrder, pendingOnly, teamFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of visitas) c[v.status] = (c[v.status] || 0) + 1;
    return c;
  }, [visitas]);

  // Calendar shows ALL visitas (leads + negócios) with date/search filters but ignoring agendaTipo
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
    if (dateFrom) {
      const fromStr = format(dateFrom, "yyyy-MM-dd");
      list = list.filter(v => v.data_visita >= fromStr);
    }
    if (dateTo) {
      const toStr = format(dateTo, "yyyy-MM-dd");
      list = list.filter(v => v.data_visita <= toStr);
    }
    if (statusFilter !== "all") list = list.filter(v => v.status === statusFilter);
    if (corretorFilter !== "all") list = list.filter(v => v.corretor_id === corretorFilter);
    if (empreendimentoFilter !== "all") list = list.filter(v => v.empreendimento === empreendimentoFilter);
    return list;
  }, [allVisitas, searchTerm, dateFrom, dateTo, statusFilter, corretorFilter, empreendimentoFilter]);

  // Filtered past visitas based on anteriores period selector
  const anterioresFiltered = useMemo(() => {
    const today = startOfDay(new Date());
    let pastList = filtered.filter(v => {
      const d = new Date(v.data_visita + "T12:00:00");
      return isBefore(d, today);
    });

    if (anterioresPeriodo === "personalizado") {
      if (anterioresCustomFrom) {
        const fromStr = format(anterioresCustomFrom, "yyyy-MM-dd");
        pastList = pastList.filter(v => v.data_visita >= fromStr);
      }
      if (anterioresCustomTo) {
        const toStr = format(anterioresCustomTo, "yyyy-MM-dd");
        pastList = pastList.filter(v => v.data_visita <= toStr);
      }
    } else {
      let periodStart: Date;
      if (anterioresPeriodo === "mes-atual") {
        periodStart = startOfMonth(today);
      } else if (anterioresPeriodo === "mes-1") {
        periodStart = startOfMonth(subMonths(today, 1));
      } else if (anterioresPeriodo === "mes-2") {
        periodStart = startOfMonth(subMonths(today, 2));
      } else if (anterioresPeriodo === "mes-3") {
        periodStart = startOfMonth(subMonths(today, 3));
      } else {
        periodStart = startOfMonth(today);
      }
      const periodEnd = anterioresPeriodo === "mes-atual" ? today : endOfMonth(periodStart);
      const fromStr = format(periodStart, "yyyy-MM-dd");
      const toStr = format(periodEnd, "yyyy-MM-dd");
      pastList = pastList.filter(v => v.data_visita >= fromStr && v.data_visita <= toStr);
    }

    return pastList;
  }, [filtered, anterioresPeriodo, anterioresCustomFrom, anterioresCustomTo]);

  const hasFilters = statusFilter !== "all" || corretorFilter !== "all" || empreendimentoFilter !== "all" || !!dateFrom || !!dateTo || searchTerm.trim() || pendingOnly || teamFilter !== "all";

  const clearAll = () => {
    setStatusFilter("all");
    setCorretorFilter("all");
    setEmpreendimentoFilter("all");
    setTeamFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchTerm("");
    setPendingOnly(false);
  };

  return (
    <div className="space-y-4">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            📅 Agenda de Visitas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? "Visão consolidada da empresa" : isGestor ? "Visitas da sua equipe" : "Suas visitas agendadas"}
          </p>
        </div>
        <Button onClick={() => setShowTypeSelector(true)} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md">
          <Plus className="h-4 w-4" /> Nova Visita
        </Button>
      </div>

      {/* ─── TIPO TABS (Lead / Negócio) ─── */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setAgendaTipo("lead")}
          className={cn(
            "px-4 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
            agendaTipo === "lead"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          🏠 Visitas de Leads <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">{leadCount}</Badge>
        </button>
        <button
          onClick={() => setAgendaTipo("negocio")}
          className={cn(
            "px-4 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
            agendaTipo === "negocio"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          💼 Reuniões de Negócios <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">{negocioCount}</Badge>
        </button>
      </div>

      {/* Sub-tab: Minhas vs Time (for all roles with leads tab) */}
      {agendaTipo === "lead" && (
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setLeadSubTab("minhas")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
              leadSubTab === "minhas"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            📋 Minhas Visitas
          </button>
          <button
            onClick={() => setLeadSubTab("time")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
              leadSubTab === "time"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users2 className="h-3.5 w-3.5" /> Visitas do Time
          </button>
        </div>
      )}

      {/* ─── TEAM VIEW (Visitas do Time) ─── */}
      {agendaTipo === "lead" && leadSubTab === "time" ? (
        <VisitasEquipe />
      ) : (
      <>
      {/* ─── PENDING ALERT ─── */}
      {pendingCount > 0 && (
        <div
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all",
            pendingOnly
              ? "bg-red-100 border-red-400 border-l-4"
              : "bg-red-50 border-red-300 border-l-4 border-l-red-500"
          )}
        >
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-semibold text-red-700">
              ⚠️ {pendingCount} visita{pendingCount > 1 ? "s" : ""} sem atualização de status
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); openCobranca(); }}
                className="text-xs font-semibold text-red-700 bg-red-200 hover:bg-red-300 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Cobrar todos
              </button>
            )}
            <button
              onClick={() => { setPendingOnly(!pendingOnly); setStatusFilter("all"); }}
              className="text-xs font-semibold text-red-600 underline"
            >
              {pendingOnly ? "Mostrar todas ←" : "Resolver agora →"}
            </button>
          </div>
        </div>
      )}


      {/* ─── TEAM TABS (CEO/Admin) ─── */}
      {isAdmin && (
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
          {[
            { key: "all", label: "Todas Equipes", emoji: "👥" },
            ...FIXED_TEAMS,
          ].map(t => {
            const isActive = teamFilter === t.key;
            const count = t.key === "all"
              ? visitas.length
              : visitas.filter(v => (v.equipe || "").toLowerCase().replace(/^equipe\s+/i, "").trim().includes(t.key)).length;
            const teamMeta = FIXED_TEAMS.find(ft => ft.key === t.key);
            return (
              <button
                key={t.key}
                onClick={() => setTeamFilter(t.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                  isActive
                    ? t.key === "all"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : `${teamMeta?.className || ""} shadow-sm border`
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.emoji} {t.label} <Badge variant="secondary" className="text-[10px] ml-0.5 px-1.5 py-0">{count}</Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── FILTERS ROW ─── */}
      <div className="flex flex-wrap items-center gap-2">
        {(isAdmin || isGestor) && corretores.length > 1 && (
          <Select value={corretorFilter} onValueChange={setCorretorFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Todos corretores" />
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
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Todos empreend." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos empreend.</SelectItem>
              {empreendimentos.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}



        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, corretor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-xs h-9 pl-9"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-xs gap-1 text-destructive">
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* ─── STATUS CHIPS ─── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
            statusFilter === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-muted/60 text-muted-foreground border-transparent hover:bg-muted"
          )}
        >
          Todas {visitas.length}
        </button>
        {(["marcada", "confirmada", "realizada", "reagendada", "no_show", "cancelada"] as VisitaStatus[]).map(s => {
          const count = counts[s] || 0;
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                isActive
                  ? STATUS_CHIP_COLORS[s] + " shadow-sm"
                  : count === 0
                    ? "bg-muted/30 text-muted-foreground/40 border-transparent cursor-default"
                    : "bg-muted/60 text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
              {STATUS_EMOJIS[s]} {STATUS_LABELS[s]} {count}
            </button>
          );
        })}
      </div>

      {/* ─── VIEWS ─── */}
      <Tabs defaultValue="lista">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="lista" className="gap-1.5 text-xs h-8 px-3">
            <List className="h-3.5 w-3.5" /> Visitas
          </TabsTrigger>
          <TabsTrigger value="anteriores" className="gap-1.5 text-xs h-8 px-3">
            <History className="h-3.5 w-3.5" /> Anteriores
          </TabsTrigger>
          <TabsTrigger value="geral" className="gap-1.5 text-xs h-8 px-3">
            <CalendarDays className="h-3.5 w-3.5" /> Visitas Geral
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5 text-xs h-8 px-3">
            <CalendarDays className="h-3.5 w-3.5" /> Calendário
          </TabsTrigger>
          {(isAdmin || isGestor) && (
            <TabsTrigger value="por-corretor" className="gap-1.5 text-xs h-8 px-3">
              <Users className="h-3.5 w-3.5" /> Por Corretor
            </TabsTrigger>
          )}
          <TabsTrigger value="performance" className="gap-1.5 text-xs h-8 px-3">
            <BarChart3 className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <VisitasList
              visitas={filtered}
              onUpdateStatus={handleUpdateStatus}
              onEdit={handleEdit}
              onDelete={deleteVisita}
              showCorretor={isAdmin || isGestor}
              showTeam={isAdmin}
              mode="upcoming"
            />
          )}
        </TabsContent>

        <TabsContent value="anteriores" className="mt-3 space-y-3">
          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "mes-atual", label: "Mês atual" },
              { key: "mes-1", label: format(subMonths(new Date(), 1), "MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()) },
              { key: "mes-2", label: format(subMonths(new Date(), 2), "MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()) },
              { key: "mes-3", label: format(subMonths(new Date(), 3), "MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()) },
              { key: "personalizado", label: "Personalizado" },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => setAnterioresPeriodo(p.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  anterioresPeriodo === p.key
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/60 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {anterioresPeriodo === "personalizado" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1", anterioresCustomFrom && "border-primary text-primary")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {anterioresCustomFrom ? format(anterioresCustomFrom, "dd/MM/yyyy") : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={anterioresCustomFrom}
                    onSelect={setAnterioresCustomFrom}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1", anterioresCustomTo && "border-primary text-primary")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {anterioresCustomTo ? format(anterioresCustomTo, "dd/MM/yyyy") : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={anterioresCustomTo}
                    onSelect={setAnterioresCustomTo}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {(anterioresCustomFrom || anterioresCustomTo) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs text-destructive" onClick={() => { setAnterioresCustomFrom(undefined); setAnterioresCustomTo(undefined); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <VisitasList
              visitas={anterioresFiltered}
              onUpdateStatus={handleUpdateStatus}
              onEdit={handleEdit}
              onDelete={deleteVisita}
              showCorretor={isAdmin || isGestor}
              showTeam={isAdmin}
              mode="past"
            />
          )}
        </TabsContent>

        <TabsContent value="geral" className="mt-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <>
              <DaySummary visitas={visitas} showTeamBreakdown={isAdmin} />
              <div className="mt-3">
                <VisitasList
                  visitas={filtered}
                  onUpdateStatus={handleUpdateStatus}
                  onEdit={handleEdit}
                  onDelete={deleteVisita}
                  showCorretor={isAdmin || isGestor}
                  showTeam={isAdmin}
                  mode="all"
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="calendario" className="mt-3">
          <VisitasCalendar visitas={allVisitasFiltered} showTeam={isAdmin} />
        </TabsContent>

        {(isAdmin || isGestor) && (
          <TabsContent value="por-corretor" className="mt-3">
            <VisitasByCorretor visitas={filtered} onUpdateStatus={handleUpdateStatus} onDelete={deleteVisita} showTeam={isAdmin} />
          </TabsContent>
        )}

        <TabsContent value="performance" className="mt-3">
          <VisitasPerformance visitas={visitas} showCorretor={isAdmin || isGestor} />
        </TabsContent>
      </Tabs>
      </>
      )}

      {/* ─── TYPE SELECTOR ─── */}
      <VisitaTypeSelector
        open={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelectImovel={() => { setShowTypeSelector(false); setShowForm(true); }}
        onSelectReuniao={() => { setShowTypeSelector(false); setShowReuniaoForm(true); }}
      />

      {/* ─── VISITA IMÓVEL FORM ─── */}
      {showForm && (
        <VisitaForm open={showForm} onClose={() => setShowForm(false)} onSubmit={createVisita} />
      )}

      {/* ─── REUNIÃO NEGÓCIO FORM ─── */}
      {showReuniaoForm && (
        <ReuniaoNegocioForm open={showReuniaoForm} onClose={() => setShowReuniaoForm(false)} onSubmit={createVisita} />
      )}

      {editingVisita && (
        <VisitaForm
          open={!!editingVisita}
          onClose={() => setEditingVisita(null)}
          onSubmit={handleEditSubmit}
          initialData={editingVisita}
          mode="edit"
        />
      )}

      {resultadoVisita && (
        <VisitaResultadoDialog
          open={!!resultadoVisita}
          onClose={() => setResultadoVisita(null)}
          onSubmit={handleResultadoSubmit}
          nomeCliente={resultadoVisita.nome_cliente}
        />
      )}

      {/* ─── COBRANÇA DIALOG ─── */}
      <Dialog open={showCobranca} onOpenChange={setShowCobranca}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-red-600" /> Cobrar atualização de visitas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Enviar cobrança para <strong>{pendingByCorretor.length}</strong> corretor{pendingByCorretor.length !== 1 ? "es" : ""}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pendingByCorretor.map((c, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {c.nome} ({c.count})
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mensagem (editável)</label>
              <Textarea
                value={cobrancaMsg}
                onChange={e => setCobrancaMsg(e.target.value)}
                rows={5}
                className="mt-1 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use [nome] para nome do corretor e [X] para qtd de visitas
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCobranca(false)}>Cancelar</Button>
            <Button onClick={sendCobranca} disabled={sendingCobranca} className="gap-1.5 bg-red-600 hover:bg-red-700 text-white">
              {sendingCobranca ? "Enviando..." : `📲 Enviar para ${pendingByCorretor.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
