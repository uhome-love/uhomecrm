import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, isToday, isTomorrow, isBefore, startOfDay, startOfWeek, startOfMonth, endOfWeek, endOfMonth, addDays, subWeeks, isWithinInterval, subMonths, endOfDay } from "date-fns";
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
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synced filters
  const [showForm, setShowForm] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showReuniaoForm, setShowReuniaoForm] = useState(false);
  const [editingVisita, setEditingVisita] = useState<Visita | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [corretorFilter, setCorretorFilter] = useState<string>(searchParams.get("corretor") || "all");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState<string>(searchParams.get("empreendimento") || "all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [resultadoVisita, setResultadoVisita] = useState<Visita | null>(null);
  const [pendingOnly, setPendingOnly] = useState(searchParams.get("pending") === "1");
  const [showCobranca, setShowCobranca] = useState(false);
  const [cobrancaMsg, setCobrancaMsg] = useState("");
  const [sendingCobranca, setSendingCobranca] = useState(false);
  const [agendaTipo, setAgendaTipo] = useState<"lead" | "negocio">((searchParams.get("tipo") as any) || "lead");
  const [leadSubTab, setLeadSubTab] = useState<"minhas" | "time">("minhas");
  const [teamFilter, setTeamFilter] = useState<string>(searchParams.get("team") || "all");
  const [anterioresPeriodo, setAnterioresPeriodo] = useState<string>("mes-atual");
  const [anterioresCustomFrom, setAnterioresCustomFrom] = useState<Date | undefined>();
  const [anterioresCustomTo, setAnterioresCustomTo] = useState<Date | undefined>();
  const [quickFilter, setQuickFilter] = useState<string>(searchParams.get("quick") || "");

  // Sync filter state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (searchTerm) params.set("q", searchTerm);
    if (corretorFilter !== "all") params.set("corretor", corretorFilter);
    if (empreendimentoFilter !== "all") params.set("empreendimento", empreendimentoFilter);
    if (pendingOnly) params.set("pending", "1");
    if (agendaTipo !== "lead") params.set("tipo", agendaTipo);
    if (teamFilter !== "all") params.set("team", teamFilter);
    if (quickFilter) params.set("quick", quickFilter);
    setSearchParams(params, { replace: true });
  }, [statusFilter, searchTerm, corretorFilter, empreendimentoFilter, pendingOnly, agendaTipo, teamFilter, quickFilter]);

  // Quick filter logic
  const applyQuickFilter = useCallback((key: string) => {
    const today = startOfDay(new Date());
    if (quickFilter === key) {
      // Toggle off
      setQuickFilter("");
      setDateFrom(undefined);
      setDateTo(undefined);
      setPendingOnly(false);
      setStatusFilter("all");
      return;
    }
    setQuickFilter(key);
    setPendingOnly(false);
    setStatusFilter("all");

    if (key === "hoje") {
      setDateFrom(today);
      setDateTo(today);
    } else if (key === "amanha") {
      const tom = addDays(today, 1);
      setDateFrom(tom);
      setDateTo(tom);
    } else if (key === "semana") {
      setDateFrom(startOfWeek(today, { weekStartsOn: 1 }));
      setDateTo(endOfWeek(today, { weekStartsOn: 1 }));
    } else if (key === "semana_anterior") {
      const prevWeek = subWeeks(today, 1);
      setDateFrom(startOfWeek(prevWeek, { weekStartsOn: 1 }));
      setDateTo(endOfWeek(prevWeek, { weekStartsOn: 1 }));
    } else if (key === "mes") {
      setDateFrom(startOfMonth(today));
      setDateTo(endOfMonth(today));
    } else if (key === "mes_anterior") {
      const prevMonth = subMonths(today, 1);
      setDateFrom(startOfMonth(prevMonth));
      setDateTo(endOfMonth(prevMonth));
    } else if (key === "nao_confirmadas") {
      setDateFrom(undefined);
      setDateTo(undefined);
      setStatusFilter("marcada");
    } else if (key === "sem_feedback") {
      setDateFrom(undefined);
      setDateTo(undefined);
      setPendingOnly(true);
    } else if (key === "personalizado") {
      // keep current dateFrom/dateTo, user picks via calendar
    }
  }, [quickFilter]);

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

  const handleResultadoSubmit = useCallback(async (resultado: ResultadoVisita, observacoes?: string, feedback?: { objecao?: string; temperatura?: string; proxima_acao?: string }) => {
    if (!resultadoVisita) return;
    // First update resultado_visita and observacoes
    const updates: any = { resultado_visita: resultado };
    if (observacoes) {
      updates.observacoes = [resultadoVisita.observacoes, observacoes].filter(Boolean).join(" | ");
    }
    await updateVisita(resultadoVisita.id, updates, true);
    // Then call updateStatus which triggers negócio creation + pipeline move
    await updateStatus(resultadoVisita.id, "realizada");

    // Update pipeline lead with feedback if available
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

  const hasFilters = statusFilter !== "all" || corretorFilter !== "all" || empreendimentoFilter !== "all" || !!dateFrom || !!dateTo || searchTerm.trim() || pendingOnly || teamFilter !== "all" || !!quickFilter;

  const clearAll = () => {
    setStatusFilter("all");
    setCorretorFilter("all");
    setEmpreendimentoFilter("all");
    setTeamFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchTerm("");
    setPendingOnly(false);
    setQuickFilter("");
  };

  return (
    <div className="space-y-3">
      {/* ─── BLOCO 1: CONTROLES PRINCIPAIS ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, telefone ou corretor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-xs h-9 pl-9 bg-card border-border/60"
          />
        </div>

        {(isAdmin || isGestor) && corretores.length > 1 && (
          <Select value={corretorFilter} onValueChange={setCorretorFilter}>
            <SelectTrigger className="h-9 w-[155px] text-xs bg-card border-border/60">
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
            <SelectTrigger className="h-9 w-[155px] text-xs bg-card border-border/60">
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

        {/* Equipe dropdown (replaces team tabs) */}
        {isAdmin && (
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-9 w-[140px] text-xs bg-card border-border/60">
              <SelectValue placeholder="Equipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas equipes</SelectItem>
              {FIXED_TEAMS.map(t => (
                <SelectItem key={t.key} value={t.key}>{t.emoji} {t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Tipo toggle */}
        <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
          <button
            onClick={() => setAgendaTipo("lead")}
            className={cn(
              "px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all",
              agendaTipo === "lead"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            🏠 Visitas ({leadCount})
          </button>
          <button
            onClick={() => setAgendaTipo("negocio")}
            className={cn(
              "px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all",
              agendaTipo === "negocio"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            💼 Negócios ({negocioCount})
          </button>
        </div>

        <Button onClick={() => setShowTypeSelector(true)} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md h-9 text-xs ml-auto">
          <Plus className="h-3.5 w-3.5" /> Nova Visita
        </Button>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-[11px] gap-1 text-destructive px-2">
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* ─── BLOCO 2: STATUS CHIPS ─── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border",
            statusFilter === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
          )}
        >
          Todas ({visitas.length})
        </button>
        {(["marcada", "confirmada", "realizada", "reagendada", "no_show", "cancelada"] as VisitaStatus[]).map(s => {
          const count = counts[s] || 0;
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border",
                isActive
                  ? STATUS_CHIP_COLORS[s] + " shadow-sm"
                  : count === 0
                    ? "bg-muted/20 text-muted-foreground/30 border-transparent cursor-default"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
              {STATUS_EMOJIS[s]} {STATUS_LABELS[s]} ({count})
            </button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-border/50" />
        {[
          { key: "nao_confirmadas", label: "⚠️ Não confirmadas" },
          { key: "sem_feedback", label: "🔴 Sem feedback" },
        ].map(qf => (
          <button
            key={qf.key}
            onClick={() => applyQuickFilter(qf.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border",
              quickFilter === qf.key
                ? "bg-amber-100 text-amber-700 border-amber-300 shadow-sm"
                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
            )}
          >
            {qf.label}
          </button>
        ))}
      </div>

      <Tabs defaultValue="semana-atual" onValueChange={(val) => {
        // Auto-apply date filters based on tab
        const today = startOfDay(new Date());
        if (val === "semana-atual") {
          setDateFrom(startOfWeek(today, { weekStartsOn: 1 }));
          setDateTo(endOfWeek(today, { weekStartsOn: 1 }));
          setQuickFilter("semana");
        } else if (val === "semana-anterior") {
          const prevWeek = subWeeks(today, 1);
          setDateFrom(startOfWeek(prevWeek, { weekStartsOn: 1 }));
          setDateTo(endOfWeek(prevWeek, { weekStartsOn: 1 }));
          setQuickFilter("semana_anterior");
        } else if (val === "mes") {
          setDateFrom(startOfMonth(today));
          setDateTo(endOfMonth(today));
          setQuickFilter("mes");
        } else {
          // calendar / performance: clear date filter
          setDateFrom(undefined);
          setDateTo(undefined);
          setQuickFilter("");
        }
      }}>
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
          {pendingCount > 0 && (
            <TabsTrigger value="alertas" className="gap-1.5 text-xs h-8 px-3 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> Alertas <Badge variant="destructive" className="text-[10px] ml-0.5 px-1.5 py-0">{pendingCount}</Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="performance" className="gap-1.5 text-xs h-8 px-3">
            <BarChart3 className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
        </TabsList>

        {/* ─── SEMANA ATUAL ─── */}
        <TabsContent value="semana-atual" className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {format(startOfWeek(new Date(), { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })} — {format(endOfWeek(new Date(), { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })}
            </Badge>
          </div>
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
              mode="all"
            />
          )}
        </TabsContent>

        {/* ─── SEMANA ANTERIOR ─── */}
        <TabsContent value="semana-anterior" className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })} — {format(endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })}
            </Badge>
          </div>
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
              mode="past"
            />
          )}
        </TabsContent>

        {/* ─── MÊS ─── */}
        <TabsContent value="mes" className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {format(new Date(), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
            </Badge>
          </div>
          
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
              mode="all"
            />
          )}
        </TabsContent>

        {/* ─── CALENDÁRIO ─── */}
        <TabsContent value="calendario" className="mt-3">
          <VisitasCalendar visitas={allVisitasFiltered} showTeam={isAdmin} />
        </TabsContent>

        {/* ─── PERFORMANCE ─── */}
        <TabsContent value="performance" className="mt-3">
          <VisitasPerformance visitas={visitas} showCorretor={isAdmin || isGestor} />
        </TabsContent>

        {/* ─── ALERTAS TAB ─── */}
        <TabsContent value="alertas" className="mt-3 space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="text-sm font-bold text-destructive">
                  {pendingCount} visita{pendingCount > 1 ? "s" : ""} sem atualização de status
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button variant="outline" size="sm" className="text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={openCobranca}>
                    <MessageCircle className="h-3.5 w-3.5" /> Cobrar todos
                  </Button>
                )}
              </div>
            </div>
            <VisitasList
              visitas={pendingVisitas}
              onUpdateStatus={handleUpdateStatus}
              onEdit={handleEdit}
              onDelete={deleteVisita}
              showCorretor={isAdmin || isGestor}
              showTeam={isAdmin}
              mode="past"
            />
          </div>
        </TabsContent>
      </Tabs>

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
