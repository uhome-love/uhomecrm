import { useState, useEffect, useCallback, useMemo, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 as Building2Tab } from "lucide-react";
import TabEmpresa from "@/components/ceo/TabEmpresa";
import { GreetingBar } from "@/components/ui/GreetingBar";
import { StatCard } from "@/components/ui/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCeoDashboard, type DashPeriod } from "@/hooks/useCeoDashboard";
import { useDateFilter } from "@/contexts/DateFilterContext";
import GlobalDateFilterBar from "@/components/GlobalDateFilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, CheckCircle2, XCircle, Phone, CalendarDays, CalendarCheck,
  DollarSign, Users, BarChart3, Inbox, Rocket, Building2, TrendingUp,
  Target, Eye, EyeOff, FileText, Megaphone, UserCheck, Activity
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import FilaCeoDispatchModal from "@/components/pipeline/FilaCeoDispatchModal";
import BulkEmpreendimentoAssign from "@/components/ceo/BulkEmpreendimentoAssign";
import { formatBRLCompact as _formatBRLCompactLegacy, cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/fmtMoney";
void _formatBRLCompactLegacy; // M5 cleanup
const formatBRLCompact = (v: number) => fmtMoney(v, "short");
import { CeoDashboardSkeleton } from "@/components/ui/skeleton-dashboard";
import KpiDetailDialog, { type KpiDetailType } from "@/components/ceo/KpiDetailDialog";
import { StateWrapper } from "@/components/ui/StateWrapper";
// PresencaSummaryCard removido do dashboard — KPIs agora vivem na página /roleta/presenca.


const FRASES = [
  "Liderar é servir com propósito.",
  "Dados guiam, pessoas executam.",
  "Cada número esconde uma história.",
  "A disciplina do processo gera resultado.",
  "O melhor dashboard é aquele que provoca ação.",
  "Quem mede, melhora. Quem acompanha, transforma.",
];

const ORIGIN_COLORS: Record<string, string> = {
  meta_ads: "#4969FF", "Meta Ads": "#4969FF",
  "TikTok Ads": "#ec4899",
  "Landing Page": "#10b981",
  imovelweb: "#f97316", ImovelWeb: "#f97316",
  site_uhome: "#06b6d4", "Site - uhome.com.br": "#06b6d4",
  jetimob: "#6366f1", indicacao: "#8b5cf6",
  whatsapp: "#22c55e", rd_station: "#f59e0b",
  "Oferta Ativa": "#4969FF",
};
const FALLBACK_COLORS = ["#4969FF","#ec4899","#10b981","#f97316","#06b6d4","#6366f1","#8b5cf6","#f59e0b","#ef4444","#14b8a6"];

// ─── Section Label ───
function SectionLabel({ children, icon: Icon }: { children: string; icon: any }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-primary">{children}</span>
    </div>
  );
}

// ─── Mini KPI ─── (casca canônica StatCard; valores/lógica inalterados)
const VARIANT_TONE = {
  default: "neutral",
  highlight: "primary",
  success: "success",
  warning: "warning",
} as const;

const MiniKpi = forwardRef<HTMLDivElement, {
  label: string; value: string | number; sub?: string;
  variant?: "default" | "highlight" | "success" | "warning";
  onClick?: () => void;
  /** Variação % vs. período anterior. null/undefined esconde o indicador. */
  delta?: number | null;
  /** Quando true, queda é boa (ex.: no-show). */
  invertDelta?: boolean;
}>(({ label, value, sub, variant = "default", onClick, delta, invertDelta }, ref) => {
  const showDelta = delta != null && Number.isFinite(delta);
  const positive = showDelta && (invertDelta ? delta! < 0 : delta! > 0);
  const neutral = showDelta && Math.round(delta!) === 0;
  const deltaNode = showDelta ? (
    <span
      className={`text-[10px] font-semibold leading-none ${neutral ? "text-muted-foreground" : positive ? "text-success-500" : "text-danger-500"}`}
      title="vs. período anterior"
    >
      {neutral ? "→" : delta! > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta!))}%
    </span>
  ) : null;

  return (
    <div ref={ref}>
      <StatCard
        label={label}
        value={value}
        tone={VARIANT_TONE[variant]}
        onClick={onClick}
        sub={
          deltaNode || sub ? (
            <span className="inline-flex items-center gap-1.5">
              {deltaNode}
              {sub && <span className="text-muted-foreground/70 truncate">{sub}</span>}
            </span>
          ) : undefined
        }
        className="w-full p-3.5 rounded-xl [&>p:nth-child(1)]:normal-case [&>p:nth-child(1)]:truncate [&>p:nth-child(2)]:text-xl [&>p:nth-child(2)]:tracking-tight"
      />
    </div>
  );
});
MiniKpi.displayName = "MiniKpi";

// ─── Card da faixa de destaque (números-herói do topo) ───
function HeroKpi({ label, value, hint, delta: d, tone = "neutral" }: {
  label: string; value: string; hint?: string; delta?: number | null;
  tone?: "neutral" | "success" | "accent";
}) {
  const showDelta = d != null && Number.isFinite(d);
  const dir = showDelta ? (Math.round(d!) === 0 ? "flat" : d! > 0 ? "up" : "down") : null;
  const valColor = tone === "success" ? "text-success-500" : tone === "accent" ? "text-primary" : "text-foreground";
  return (
    <div className="bg-white dark:bg-white/[0.04] p-4 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className={cn("text-[26px] font-[850] mt-1.5 leading-none tabular-nums", valColor)}>{value}</p>
      <p className="text-[10.5px] mt-1 font-semibold">
        {showDelta ? (
          <span className={dir === "flat" ? "text-muted-foreground" : dir === "up" ? "text-success-500" : "text-danger-500"}>
            {dir === "flat" ? "→" : dir === "up" ? "▲" : "▼"} {Math.abs(Math.round(d!))}% vs. anterior
          </span>
        ) : (
          <span className="text-muted-foreground/70">{hint || " "}</span>
        )}
      </p>
    </div>
  );
}

// ─── Horizontal Bar ───
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="group/bar">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="truncate text-muted-foreground group-hover/bar:text-foreground transition-colors">{label}</span>
        <span className="font-semibold text-foreground ml-2 shrink-0">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-[#e8e8f0] dark:bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── Funnel Step ───
function FunnelStep({ label, value, pct, color, isLast }: { label: string; value: number; pct: number; color: string; isLast?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: color }}>
          {value}
        </div>
        {!isLast && <div className="w-px h-4 bg-[#e8e8f0] dark:bg-white/[0.07]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-foreground truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground">{pct}% do total</p>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function CeoDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { period, range } = useDateFilter();
  const [frase] = useState(() => FRASES[Math.floor(Math.random() * FRASES.length)]);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [filaCeoCount, setFilaCeoCount] = useState(0);
  const [lastDispatch, setLastDispatch] = useState<{ at: string; count: number } | null>(null);
  const [bulkEmpOpen, setBulkEmpOpen] = useState(false);
  const [kpiDetail, setKpiDetail] = useState<{ type: KpiDetailType; label: string } | null>(null);
  
  const [funnelCorretorFilter, setFunnelCorretorFilter] = useState<"all" | string>("all");
  const [showAllCorretorLeads, setShowAllCorretorLeads] = useState(false);

  const {
    loading, lastUpdate, profile, roletaPendentes, kpis, prevKpis,
    pipelineStages, campanhas, alertas, negocioFases, vgvEmRisco, topCorretoresVgv, vendasPeriodo, vgvMesAtual,
    teams, corretoresRank, origens, leadsPorEmpreendimento, leadsPorCorretor, visitasPorEmp,
    totalLeadsPeriodo, leadsReaproveitadosOA, agendaVisitas, agendaVisitasPrev, novoInteresse, enviadosRoleta, presentesHoje, metasDiaTotal,
    reload, reloadRoleta,
    error: dashError, partial, partialSources, errors,
  } = useCeoDashboard(period as DashPeriod, { start: range.start, end: range.end });

  /** Variação % vs. período anterior (null quando não há base de comparação). */
  const delta = (curr: number | undefined, prev: number | undefined): number | null => {
    if (curr == null || prev == null || !Number.isFinite(prev) || prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  };


  // CEO metas (React Query)
  const mesAtual = useMemo(() => format(new Date(), "yyyy-MM"), []);
  const { data: ceoMetas = {} } = useQuery({
    queryKey: ["ceo-metas-mensais", mesAtual],
    queryFn: async () => {
      const { data, error } = await supabase.from("ceo_metas_mensais").select("*").eq("mes", mesAtual);
      if (error) throw error;
      if (!data || data.length === 0) return {};
      return {
        meta_ligacoes: data.reduce((a: number, m: any) => a + (m.meta_ligacoes || 0), 0),
        meta_visitas_marcadas: data.reduce((a: number, m: any) => a + (m.meta_visitas_marcadas || 0), 0),
        meta_visitas_realizadas: data.reduce((a: number, m: any) => a + (m.meta_visitas_realizadas || 0), 0),
        meta_vgv_assinado: data.reduce((a: number, m: any) => a + (m.meta_vgv_assinado || 0), 0),
        meta_propostas: data.reduce((a: number, m: any) => a + ((m as any).meta_propostas || 0), 0),
        meta_contratos: data.reduce((a: number, m: any) => a + ((m as any).meta_contratos || 0), 0),
        meta_assinados: data.reduce((a: number, m: any) => a + ((m as any).meta_assinados || 0), 0),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  // Fila CEO
  const loadFilaCeo = useCallback(async () => {
    const [countRes, logRes] = await Promise.all([
      supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).eq("aceite_status", "pendente_distribuicao").is("corretor_id", null).eq("arquivado", false),
      supabase.from("audit_log").select("created_at, depois").eq("acao", "dispatch_fila_ceo").order("created_at", { ascending: false }).limit(1),
    ]);
    setFilaCeoCount(countRes.count || 0);
    if (logRes.data?.[0]) {
      const d = logRes.data[0].depois as any;
      setLastDispatch({ at: logRes.data[0].created_at, count: d?.dispatched || 0 });
    }
  }, []);
  useEffect(() => {
    loadFilaCeo();

    const handleFocus = () => loadFilaCeo();
    window.addEventListener("focus", handleFocus);

    const interval = window.setInterval(() => {
      loadFilaCeo();
    }, 15000);

    const channel = supabase
      .channel("ceo-fila-ceo-counter")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_leads" }, () => {
        loadFilaCeo();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_log" }, () => {
        loadFilaCeo();
      })
      .subscribe();

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadFilaCeo]);

  // Roleta approval logic
  const [localPendentes, setLocalPendentes] = useState<any[]>([]);
  useEffect(() => { setLocalPendentes(roletaPendentes); }, [roletaPendentes]);

  const getProfileId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    return data?.id || null;
  }, [user]);

  const insertFilaForCred = useCallback(async (cred: any) => {
    const segmentoIds = [cred.segmento_1_id, cred.segmento_2_id].filter(Boolean) as string[];
    for (const segId of segmentoIds) {
      await supabase.rpc("upsert_roleta_fila" as any, {
        p_corretor_id: cred.corretor_id,
        p_segmento_id: segId,
        p_janela: cred.janela,
        p_data: hoje,
        p_credenciamento_id: cred.id,
      });
    }
  }, [hoje]);

  const aprovar = useCallback(async (id: string) => {
    if (!user) return;
    const profileId = await getProfileId();
    if (!profileId) { toast.error("Perfil não encontrado"); return; }
    const item = localPendentes.find((c: any) => c.id === id);
    setLocalPendentes(prev => prev.filter((c: any) => c.id !== id));
    const { data: cred, error } = await supabase.from("roleta_credenciamentos")
      .update({ status: "aprovado", aprovado_por: profileId, aprovado_em: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error || !cred) {
      toast.error("Erro ao aprovar");
      setLocalPendentes(prev => [...prev, item].filter(Boolean));
      return;
    }
    await insertFilaForCred(cred);
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("id", cred.corretor_id).single();
    if (prof?.user_id) {
      await supabase.from("corretor_disponibilidade")
        .upsert({ user_id: prof.user_id, na_roleta: true, status: "na_empresa", segmentos: [], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    }
    toast.success(`${item?.corretor_nome || "Corretor"} aprovado(a) na Roleta`);
    reloadRoleta();
  }, [user, localPendentes, getProfileId, insertFilaForCred, reloadRoleta]);

  const recusar = useCallback(async (id: string) => {
    if (!user) return;
    const profileId = await getProfileId();
    if (!profileId) return;
    const item = localPendentes.find((c: any) => c.id === id);
    setLocalPendentes(prev => prev.filter((c: any) => c.id !== id));
    const { error } = await supabase.from("roleta_credenciamentos")
      .update({ status: "recusado", aprovado_por: profileId, aprovado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Erro ao recusar"); setLocalPendentes(prev => [...prev, item].filter(Boolean)); return; }
    if (item?.corretor_id) {
      const { count } = await supabase.from("roleta_credenciamentos")
        .select("id", { count: "exact", head: true }).eq("corretor_id", item.corretor_id).eq("data", hoje).eq("status", "aprovado");
      if ((count || 0) === 0) {
        const { data: prof } = await supabase.from("profiles").select("user_id").eq("id", item.corretor_id).single();
        if (prof?.user_id) await supabase.from("corretor_disponibilidade").update({ na_roleta: false, updated_at: new Date().toISOString() }).eq("user_id", prof.user_id);
      }
    }
    toast.success(`${item?.corretor_nome || "Corretor"} recusado(a) da Roleta`);
    reloadRoleta();
  }, [user, localPendentes, getProfileId, reloadRoleta, hoje]);

  const aprovarTodos = useCallback(async () => {
    if (!user) return;
    const profileId = await getProfileId();
    if (!profileId) { toast.error("Perfil não encontrado"); return; }
    const pending = [...localPendentes];
    setLocalPendentes([]);
    let ok = 0;
    for (const c of pending) {
      const { data: cred, error } = await supabase.from("roleta_credenciamentos")
        .update({ status: "aprovado", aprovado_por: profileId, aprovado_em: new Date().toISOString() })
        .eq("id", c.id).select().single();
      if (!error && cred) {
        await insertFilaForCred(cred);
        const { data: prof } = await supabase.from("profiles").select("user_id").eq("id", cred.corretor_id).single();
        if (prof?.user_id) {
          await supabase.from("corretor_disponibilidade")
            .upsert({ user_id: prof.user_id, na_roleta: true, status: "na_empresa", segmentos: [], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        }
        ok++;
      }
    }
    toast.success(`${ok} corretor(es) aprovado(s) na Roleta`);
    reloadRoleta();
  }, [user, localPendentes, getProfileId, insertFilaForCred, reloadRoleta]);

  // Derived
  const totalTeam = teams.reduce((acc, t) => ({
    ligacoes: acc.ligacoes + t.ligacoes, aproveitados: acc.aproveitados + t.aproveitados,
    visitasMarcadas: acc.visitasMarcadas + t.visitasMarcadas, visitasRealizadas: acc.visitasRealizadas + t.visitasRealizadas,
    propostas: acc.propostas + t.propostas, vgv: acc.vgv + t.vgv,
  }), { ligacoes: 0, aproveitados: 0, visitasMarcadas: 0, visitasRealizadas: 0, propostas: 0, vgv: 0 });

  const totalNeg = negocioFases.reduce((a: number, f: any) => a + f.count, 0);
  const negTotalVgv = negocioFases.reduce((a: number, f: any) => a + f.vgv, 0);
  // "Contrato" = fase canônica intermediária (contrato gerado/em assinatura)
  const contratoGerado = negocioFases.find((f: any) => f.fase === "contrato_gerado");
  const vgvContrato = contratoGerado?.vgv || 0;
  const countContrato = contratoGerado?.count || 0;
  const leadsDistribuidos = enviadosRoleta;

  // Rótulo legível do período selecionado (para deixar claro o escopo dos KPIs)
  const periodoLabel = useMemo(() => {
    const br = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
    return range.start === range.end ? br(range.start) : `${br(range.start)} – ${br(range.end)}`;
  }, [range]);

  // Taxas de conversão do período (Lead → Visita realizada → Venda assinada)
  const conversoes = useMemo(() => {
    const vendas = vendasPeriodo.length;
    const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");
    return [
      { label: "Lead → Visita realizada", value: pct(kpis.visitasRealizadas, totalLeadsPeriodo), sub: `${kpis.visitasRealizadas} de ${totalLeadsPeriodo} leads` },
      { label: "Visita → Venda", value: pct(vendas, kpis.visitasRealizadas), sub: `${vendas} de ${kpis.visitasRealizadas} visitas` },
      { label: "Lead → Venda", value: pct(vendas, totalLeadsPeriodo), sub: `${vendas} de ${totalLeadsPeriodo} leads` },
      { label: "Ticket médio", value: vendas > 0 ? formatBRLCompact(kpis.vgvAssinado / vendas) : "—", sub: "VGV assinado / vendas" },
    ];
  }, [vendasPeriodo, kpis.visitasRealizadas, kpis.vgvAssinado, totalLeadsPeriodo]);


  // Pipeline funnel totals
  const funnelTotal = pipelineStages.reduce((a, s) => a + s.count, 0) || 1;
  const funnelColors = ["#4969FF","#6366f1","#6B84FF","#a5b4fc","#c7d2fe","#22c55e","#ef4444","#10b981","#f59e0b"];

  // Funil de negócios — 3 fases canônicas (pós-consolidação 07/2026).
  // "Perdido" vive em coluna status, não em fase, portanto fora deste funil.
  const negFunnelOrder = ["documentacao", "proposta", "contrato_gerado", "ganho"];
  const negFunnelLabels: Record<string,string> = {
    documentacao: "Documentação",
    proposta: "Em Negociação",
    contrato_gerado: "Contrato",
    ganho: "Ganho",
  };
  const negFunnelColors: Record<string,string> = {
    documentacao: "#4969FF",
    proposta: "#F59E0B",
    contrato_gerado: "#8B5CF6",
    ganho: "#22C55E",
  };

  // Loading/erro do conteúdo do dashboard são tratados pelo StateWrapper da aba,
  // para o cabeçalho (saudação + filtro de data) continuar acessível.

  return (
    <div className="bg-background p-4 -m-4 sm:p-6 sm:-m-6 min-h-full space-y-5">
      {/* ═══ GREETING ═══ */}
      <GreetingBar
        name={profile?.nome || user?.email?.split("@")[0] || "CEO"}
        avatarUrl={profile?.avatar_gamificado_url || profile?.avatar_url}
        subtitle={`"${frase}"`}
        filter={period === "hoje" ? "hoje" : period === "ontem" ? "ontem" : period === "semana" ? "semana" : period === "mes" || period === "ultimos_30d" ? "mes" : "personalizado"}
        dateRange={{ from: range.start, to: range.end }}
        onFilterChange={(f, r) => {
          const periodMap: Record<string, string> = { hoje: "hoje", ontem: "ontem", semana: "semana", mes: "mes" };
          window.dispatchEvent(new CustomEvent("date-filter-change", { detail: { period: periodMap[f] || "personalizado", range: r } }));
        }}
        onRefresh={reload}
        refreshTime={format(lastUpdate, "HH:mm")}
      />

      {/* ═══ DATE FILTER + ACTION BUTTONS ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1"><GlobalDateFilterBar variant="header" /></div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDispatchOpen(true)}
            disabled={filaCeoCount === 0}
            className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
          >
            <Inbox className="h-3.5 w-3.5" />
            Fila CEO
            {filaCeoCount > 0 && <Badge className="bg-primary text-white text-[10px] px-1.5 py-0 ml-1">{filaCeoCount}</Badge>}
          </Button>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="h-auto bg-muted/50">
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs py-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="empresa" className="gap-1.5 text-xs py-1.5">
            <Building2Tab className="h-3.5 w-3.5" /> Empresa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-5 mt-0">
        <StateWrapper
          error={dashError}
          loading={loading && !profile}
          skeleton={<CeoDashboardSkeleton />}
          stale={partial}
          staleMessage={`Alguns dados não carregaram (${partialSources.join(", ")}). Os números abaixo podem estar incompletos.`}
          onRetry={reload}
          errorTitle="Não foi possível carregar o dashboard"
          errorDescription="Uma das consultas essenciais falhou. Os números não são confiáveis agora."
          className="space-y-5"
        >



      {/* ═══ FAIXA DE DESTAQUE — o período em 2 segundos ═══ */}
      <section>
        <SectionLabel icon={TrendingUp}>{`Visão geral · ${periodoLabel}`}</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          <div className="bg-gradient-to-br from-[#4969FF] to-[#6D5CF0] text-white p-4 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-90 truncate">VGV assinado</p>
            <p className="text-[26px] font-[850] mt-1.5 leading-none tabular-nums whitespace-nowrap">
              {kpis.vgvAssinado > 0 ? formatBRLCompact(kpis.vgvAssinado) : (vgvMesAtual.vgv > 0 ? formatBRLCompact(vgvMesAtual.vgv) : "sem dado")}
            </p>
            <p className="text-[10.5px] opacity-90 mt-1 font-semibold">
              {ceoMetas.meta_vgv_assinado > 0
                ? `${Math.round((kpis.vgvAssinado / ceoMetas.meta_vgv_assinado) * 100)}% da meta`
                : (kpis.vgvAssinado === 0 && vgvMesAtual.vgv > 0 ? "mês atual" : "no período")}
            </p>
          </div>
          <HeroKpi label="Vendas" value={String(vendasPeriodo.length)} tone="success"
            hint={vendasPeriodo.length > 0 ? `ticket ${formatBRLCompact(kpis.vgvAssinado / vendasPeriodo.length)}` : "no período"} />
          <HeroKpi label="Visitas realizadas" value={String(kpis.visitasRealizadas)}
            delta={delta(kpis.visitasRealizadas, prevKpis?.visitasRealizadas)} hint="realizadas" />
          <HeroKpi label="Leads gerados" value={String(totalLeadsPeriodo)} hint="marketing no período" />
          <HeroKpi label="Lead → Venda"
            value={totalLeadsPeriodo > 0 ? `${((vendasPeriodo.length / totalLeadsPeriodo) * 100).toFixed(1)}%` : "—"}
            tone="accent" hint="taxa do funil" />
        </div>
      </section>

      {/* ═══ APROVAÇÕES PENDENTES ═══ */}
      {errors.roleta && (
        <Card className="border-danger/40 bg-[#f7f7fb] dark:bg-[#141e30]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Aprovações Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <StateWrapper
              error={errors.roleta}
              onRetry={() => { reloadRoleta(); }}
              errorTitle="Falha ao carregar a fila de credenciamento"
              errorDescription="Pode haver credenciamentos pendentes não exibidos."
            />
          </CardContent>
        </Card>
      )}
      {!errors.roleta && localPendentes.length > 0 && (
        <Card className="border-primary/40 bg-[#f7f7fb] dark:bg-[#141e30]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                Aprovações Pendentes
                <Badge className="bg-primary text-white text-[10px]">{localPendentes.length}</Badge>
              </CardTitle>
              {localPendentes.length > 1 && (
                <Button size="sm" onClick={aprovarTodos} className="bg-success hover:bg-[#059669] text-white text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar todos
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {localPendentes.map((c: any) => (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-white dark:bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {c.avatar && <AvatarImage src={c.avatar} />}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(c.corretor_nome || "C").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{c.corretor_nome}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{c.janela}</Badge>
                        {(c.empreendimentos_alocados && c.empreendimentos_alocados.length > 0) ? (
                          c.empreendimentos_alocados.map((nome: string) => (
                            <Badge key={nome} className="text-[10px] bg-primary/10 text-primary border-0">{nome}</Badge>
                          ))
                        ) : (
                          <Badge className="text-[10px] bg-warning/10 text-warning border-0">Sem alocação</Badge>
                        )}
                      </div>

                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => aprovar(c.id)} className="bg-success hover:bg-[#059669] text-white text-xs flex-1 sm:flex-none">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => recusar(c.id)} className="text-danger border-danger/30 hover:bg-danger/5 text-xs flex-1 sm:flex-none">
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Presença da Roleta migrada para a página /roleta/presenca (menu Presença) */}


      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LINHA 1 — ROLETA DE LEADS                                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section>
        <SectionLabel icon={Target}>Roleta de Leads</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <MiniKpi label="Leads Gerados (Mkt)" value={totalLeadsPeriodo} variant="highlight"
            sub="Meta, TikTok, LP, ImovelWeb..."
            onClick={() => setKpiDetail({ type: "total_leads", label: "Leads Gerados" })} />
          <MiniKpi label="Reaproveitados (OA)" value={leadsReaproveitadosOA} variant="warning"
            sub="Leads da Oferta Ativa"
            onClick={() => setKpiDetail({ type: "reaproveitados_oa", label: "Reaproveitados (OA)" })} />
          <MiniKpi label="Enviados p/ Roleta" value={leadsDistribuidos > 0 ? leadsDistribuidos : 0}
            sub={filaCeoCount > 0 ? `${filaCeoCount} na fila` : "Fila vazia"}
            onClick={() => setKpiDetail({ type: "enviados_roleta", label: "Enviados p/ Roleta" })} />
          <MiniKpi label="Novo Interesse" value={novoInteresse}
            sub="Leads com novo interesse" />
          <MiniKpi label="Corretores na Roleta" value={presentesHoje} sub={`${presentesHoje} presentes hoje`}
            onClick={() => setKpiDetail({ type: "presentes_hoje", label: "Corretores na Roleta" })} />
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Leads por Campanha/Empreendimento */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-primary" /> Leads por Empreendimento
                </CardTitle>
                {campanhas.some(c => c.empreendimento === "Sem empreendimento") && (
                  <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setBulkEmpOpen(true)}>Corrigir</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {leadsPorEmpreendimento.slice(0, 10).map((l, idx) => {
                  const max = Math.max(...leadsPorEmpreendimento.map(x => x.count), 1);
                  const color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return <HBar key={l.emp} label={l.emp} value={l.count} max={max} color={color} />;
                })}
                {leadsPorEmpreendimento.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
              </div>
              {leadsPorEmpreendimento.length > 0 && (
                <p className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground text-right">
                  Soma: <span className="font-semibold text-foreground">{leadsPorEmpreendimento.reduce((s, x) => s + x.count, 0)}</span>
                  {leadsPorEmpreendimento.reduce((s, x) => s + x.count, 0) !== totalLeadsPeriodo && (
                    <> · Total marketing: <span className="font-semibold text-foreground">{totalLeadsPeriodo}</span></>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Leads por Origem */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-primary" /> Leads por Origem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {origens.slice(0, 8).map((o, idx) => {
                  const max = Math.max(...origens.map(x => x.count), 1);
                  const color = ORIGIN_COLORS[o.origem] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return <HBar key={o.origem} label={o.origem} value={o.count} max={max} color={color} />;
                })}
                {origens.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
              </div>
            </CardContent>
          </Card>

          {/* Leads por Corretor */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-primary" /> Leads por Corretor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`space-y-2.5 ${showAllCorretorLeads ? "" : ""}`}>
                {(showAllCorretorLeads ? leadsPorCorretor : leadsPorCorretor.slice(0, 6)).map((c, idx) => {
                  const max = Math.max(...leadsPorCorretor.map(x => x.count), 1);
                  const color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return <HBar key={`${c.nome}-${idx}`} label={c.nome} value={c.count} max={max} color={color} />;
                })}
                {leadsPorCorretor.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
              </div>
              {leadsPorCorretor.length > 6 && (
                <Button variant="ghost" size="sm" className="w-full mt-2 text-[10px] text-primary hover:text-primary/80" onClick={() => setShowAllCorretorLeads(!showAllCorretorLeads)}>
                  {showAllCorretorLeads ? "Ver menos" : `Ver mais (${leadsPorCorretor.length})`}
                </Button>
              )}
              {leadsPorCorretor.length > 0 && (
                <p className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground text-right">
                  Soma: <span className="font-semibold text-foreground">{leadsPorCorretor.reduce((s, x) => s + x.count, 0)}</span>
                  {leadsPorCorretor.reduce((s, x) => s + x.count, 0) !== totalLeadsPeriodo && (
                    <> · Total marketing: <span className="font-semibold text-foreground">{totalLeadsPeriodo}</span></>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LINHA 2 — GESTÃO DE LEADS                                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section>
        <SectionLabel icon={BarChart3}>Gestão de Leads</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Funil do Pipeline - 2/3 */}
          <Card className="lg:col-span-2 bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-xs font-semibold">Funil do Pipeline</CardTitle>
                <span className="text-[10px] text-muted-foreground">Visão global · todas as equipes</span>
              </div>

            </CardHeader>
            <CardContent>
              <StateWrapper
                error={errors.pipeline}
                empty={pipelineStages.length === 0}
                emptyTitle="Sem etapas no período"
                onRetry={reload}
                errorTitle="Falha ao carregar o funil do pipeline"
              >
              <div className="space-y-1.5">
                {pipelineStages.map((s, idx) => {
                  const maxCount = Math.max(...pipelineStages.map(x => x.count), 1);
                  const pct = Math.round((s.count / maxCount) * 100);
                  const stageColor = s.tipo === "descarte" ? "#ef4444" : s.tipo === "convertido" ? "#10b981" : `hsl(${240 - idx * 15}, 70%, ${55 + idx * 3}%)`;
                  return (
                    <div key={s.id} className="flex items-center gap-2 group/stage">
                      <span className="text-[10px] text-muted-foreground w-28 truncate group-hover/stage:text-foreground transition-colors">{s.nome}</span>
                      <div className="flex-1 h-6 rounded-lg bg-[#e8e8f0]/50 dark:bg-white/[0.04] relative overflow-hidden">
                        <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: stageColor, opacity: 0.8 }} />
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-foreground">{s.count}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground w-10 text-right">{Math.round((s.count / funnelTotal) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
              </StateWrapper>
            </CardContent>
          </Card>

          {/* Agenda de Visitas - 1/3 */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <CalendarCheck className="h-3.5 w-3.5 text-primary" /> Agenda de Visitas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const dNovos = delta(agendaVisitas.agendadas, agendaVisitasPrev?.agendadas);
                return (
                  <button
                    type="button"
                    onClick={() => setKpiDetail({ type: "novos_agendamentos", label: "Novos agendamentos" })}
                    className="w-full bg-white dark:bg-white/[0.04] rounded-xl p-3 text-center border border-[#e8e8f0] dark:border-white/[0.05] hover:border-primary/30 transition-colors"
                  >
                    <p className="text-3xl font-[800] text-primary">{agendaVisitas.agendadas}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Novos agendamentos no período</p>
                    {dNovos != null && (
                      <p className={`text-[9px] font-semibold mt-0.5 ${Math.round(dNovos) === 0 ? "text-muted-foreground" : dNovos > 0 ? "text-success" : "text-danger"}`}>
                        {Math.round(dNovos) === 0 ? "→" : dNovos > 0 ? "▲" : "▼"} {Math.abs(Math.round(dNovos))}% vs. anterior
                      </p>
                    )}
                  </button>
                );
              })()}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: "Total", value: agendaVisitas.total, color: "text-primary", type: "visitas_criadas" as const, prev: agendaVisitasPrev?.total },
                  { label: "A realizar", value: agendaVisitas.aRealizar, color: "text-warning", type: "visitas_marcadas" as const, prev: agendaVisitasPrev?.aRealizar },
                  { label: "Realizadas", value: agendaVisitas.realizadas, color: "text-success", type: "visitas_realizadas" as const, prev: agendaVisitasPrev?.realizadas },
                  { label: "No Show", value: agendaVisitas.noShow, color: "text-danger", type: "visitas_no_show" as const, prev: agendaVisitasPrev?.noShow, invert: true },

                ]).map(card => {
                  const d = delta(card.value, card.prev);
                  const positive = d != null && (card.invert ? d < 0 : d > 0);
                  return (
                    <button
                      key={card.label}
                      type="button"
                      onClick={() => setKpiDetail({ type: card.type, label: card.label })}
                      className="bg-white dark:bg-white/[0.04] rounded-xl p-3 text-center border border-[#e8e8f0] dark:border-white/[0.05] hover:border-primary/30 transition-colors"
                    >
                      <p className={`text-2xl font-[800] ${card.color}`}>{card.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}</p>
                      {d != null && (
                        <p className={`text-[9px] font-semibold mt-0.5 ${Math.round(d) === 0 ? "text-muted-foreground" : positive ? "text-success" : "text-danger"}`}>
                          {Math.round(d) === 0 ? "→" : d > 0 ? "▲" : "▼"} {Math.abs(Math.round(d))}% vs. anterior
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {ceoMetas.meta_visitas_realizadas > 0 && (
                <div className="bg-white dark:bg-white/[0.04] rounded-xl p-3 border border-[#e8e8f0] dark:border-white/[0.05]">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Meta Visitas Realizadas</span>
                    <span className="font-semibold text-foreground">{Math.round((kpis.visitasRealizadas / ceoMetas.meta_visitas_realizadas) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#e8e8f0] dark:bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min((kpis.visitasRealizadas / ceoMetas.meta_visitas_realizadas) * 100, 100)}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LINHA 3 — GESTÃO DE NEGÓCIOS                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section>
        <SectionLabel icon={DollarSign}>Gestão de Negócios</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniKpi label="Total de Negócios" value={totalNeg} variant="highlight"
            sub="situação atual do pipeline"
            onClick={() => setKpiDetail({ type: "negocios", label: "Negócios ativos" })} />
          <MiniKpi label="VGV em Contrato Gerado" value={vgvContrato > 0 ? formatBRLCompact(vgvContrato) : "sem valor"}
            sub={`${countContrato} negócio${countContrato !== 1 ? "s" : ""} · situação atual`}
            onClick={() => setKpiDetail({ type: "contratos", label: "Negócios em contrato" })} />
          <MiniKpi label="VGV Assinado" value={formatBRLCompact(kpis.vgvAssinado)} variant="success"
            delta={delta(kpis.vgvAssinado, prevKpis?.vgvAssinado)}
            sub={
              kpis.vgvAssinado === 0 && vgvMesAtual.vgv > 0
                ? `sem assinatura no período · mês: ${formatBRLCompact(vgvMesAtual.vgv)}`
                : ceoMetas.meta_vgv_assinado > 0
                  ? `${Math.round((kpis.vgvAssinado / ceoMetas.meta_vgv_assinado) * 100)}% da meta · ${periodoLabel}`
                  : `no período ${periodoLabel}`
            }
            onClick={() => setKpiDetail({ type: "vgv_assinado", label: "VGV Assinado" })} />
          <MiniKpi label="Propostas" value={kpis.propostas}
            delta={delta(kpis.propostas, prevKpis?.propostas)}
            sub={ceoMetas.meta_propostas > 0 ? `meta: ${ceoMetas.meta_propostas}` : `no período ${periodoLabel}`}
            onClick={() => setKpiDetail({ type: "propostas", label: "Propostas" })} />
        </div>

        <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-semibold">Funil de Negócios</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Documentação, Em Negociação e Contrato = situação atual do pipeline (não filtram por período) · Ganho = vendas assinadas em {periodoLabel}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <StateWrapper
              error={errors.negocios}
              onRetry={reload}
              errorTitle="Falha ao carregar o funil de negócios"
              className="space-y-4"
            >
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
              {negFunnelOrder.map((fase, idx) => {
                const data = negocioFases.find((f: any) => f.fase === fase);
                const count = data?.count || 0;
                const vgv = data?.vgv || 0;
                const maxCount = Math.max(...negocioFases.map((f: any) => f.count), 1);
                const widthPct = maxCount > 0 ? Math.max((count / maxCount) * 100, 18) : 18;
                const color = negFunnelColors[fase] || "#a1a1aa";
                const isCaiu = fase.toLowerCase().includes("caiu") || fase.toLowerCase().includes("perdid");
                const detailType: KpiDetailType | null =
                  fase === "proposta" ? "negociacao" : fase === "contrato_gerado" ? "contratos" : fase === "ganho" ? "vgv_assinado" : null;
                return (
                  <button
                    key={fase}
                    type="button"
                    disabled={!detailType}
                    onClick={() => detailType && setKpiDetail({ type: detailType, label: negFunnelLabels[fase] || fase })}
                    className={`flex flex-col items-center text-center gap-2 rounded-lg p-1 ${detailType ? "hover:bg-white/60 dark:hover:bg-white/[0.04] transition-colors" : "cursor-default"}`}
                  >
                    <span className="text-2xl font-[800] leading-none" style={{ color }}>
                      {count}
                    </span>
                    <div className="w-full flex justify-center">
                      <div
                        className="h-3 rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${widthPct}%`,
                          minWidth: "20px",
                          backgroundColor: color,
                          opacity: isCaiu ? 0.7 : 1,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground leading-tight">
                      {negFunnelLabels[fase] || fase}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {vgv > 0 ? formatBRLCompact(vgv) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Taxas de conversão do período */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              {conversoes.map(c => (
                <div key={c.label} className="bg-white dark:bg-white/[0.04] rounded-lg px-3 py-2 border border-[#e8e8f0] dark:border-white/[0.05]">
                  <p className="text-[10px] text-muted-foreground truncate">{c.label}</p>
                  <p className="text-base font-[800] text-foreground leading-tight">{c.value}</p>
                  <p className="text-[9px] text-muted-foreground/70 truncate">{c.sub}</p>
                </div>
              ))}
            </div>
            </StateWrapper>
          </CardContent>
        </Card>

        {/* Vendas assinadas no período */}
        <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-success" /> Vendas assinadas no período
              <span className="text-[10px] font-normal text-muted-foreground">
                {vendasPeriodo.length} venda{vendasPeriodo.length !== 1 ? "s" : ""} · {formatBRLCompact(kpis.vgvAssinado)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vendasPeriodo.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-4 text-center">Nenhuma venda assinada no período.</p>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#f7f7fb] dark:bg-[#141e30]">
                    <tr className="text-[10px] text-muted-foreground text-left">
                      <th className="py-1.5 pr-2 font-medium">Cliente</th>
                      <th className="py-1.5 pr-2 font-medium">Empreendimento</th>
                      <th className="py-1.5 pr-2 font-medium">Corretor</th>
                      <th className="py-1.5 pr-2 font-medium text-right">VGV</th>
                      <th className="py-1.5 font-medium text-right">Assinatura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasPeriodo.map((v: any) => (
                      <tr
                        key={v.id}
                        onClick={() => v.leadId && navigate(`/pipeline-leads?lead=${v.leadId}`)}
                        className={`border-t border-[#e8e8f0] dark:border-white/[0.05] ${v.leadId ? "cursor-pointer hover:bg-white/60 dark:hover:bg-white/[0.04]" : ""}`}
                      >
                        <td className="py-1.5 pr-2 font-medium text-foreground truncate max-w-[160px]">{v.cliente}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground truncate max-w-[160px]">{v.empreendimento}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground truncate max-w-[140px]">{v.corretor}</td>
                        <td className="py-1.5 pr-2 text-right font-semibold text-success">{formatBRLCompact(v.vgv)}</td>
                        <td className="py-1.5 text-right text-muted-foreground">
                          {v.dataAssinatura ? format(new Date(v.dataAssinatura + "T12:00:00"), "dd/MM/yy") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>


      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LINHA 4 — OFERTA ATIVA                                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section>
        <SectionLabel icon={Phone}>Oferta Ativa</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniKpi label="Total Ligações" value={kpis.ligacoes.toLocaleString("pt-BR")} variant="highlight"
            delta={delta(kpis.ligacoes, prevKpis?.ligacoes)}
            sub={ceoMetas.meta_ligacoes > 0 ? `${Math.round((kpis.ligacoes / ceoMetas.meta_ligacoes) * 100)}% da meta` : undefined}
            onClick={() => setKpiDetail({ type: "tentativas", label: "Ligações" })} />
          <MiniKpi label="Aproveitados" value={kpis.aproveitados} variant="success"
            delta={delta(kpis.aproveitados, prevKpis?.aproveitados)}
            sub={`Taxa: ${kpis.taxaConversao}%`}
            onClick={() => setKpiDetail({ type: "aproveitados", label: "Aproveitados" })} />

          <MiniKpi label="Metas do Dia" value={`${metasDiaTotal.ligacoes} lig`}
            sub={`${metasDiaTotal.aproveitados} aprov · ${metasDiaTotal.visitasMarcadas} VM`} />
          <MiniKpi label="Taxa Aproveitamento" value={`${kpis.taxaConversao}%`}
            variant={kpis.taxaConversao >= 10 ? "success" : kpis.taxaConversao >= 5 ? "warning" : "default"} />
        </div>

        <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold">Performance por Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <StateWrapper
              error={errors.teams}
              empty={teams.length === 0}
              emptyTitle="Sem dados de equipe no período"
              onRetry={reload}
              errorTitle="Falha ao carregar a performance por equipe"
            >
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left pb-2 font-medium">Equipe</th>
                    <th className="text-right pb-2 font-medium">Ligações</th>
                    <th className="text-right pb-2 font-medium">Aprov.</th>
                    <th className="text-right pb-2 font-medium">Taxa</th>
                    <th className="text-right pb-2 font-medium">V.M</th>
                    <th className="text-right pb-2 font-medium">V.R</th>
                    <th className="text-right pb-2 font-medium">Prop.</th>
                    <th className="text-right pb-2 font-medium">VGV</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.sort((a, b) => b.ligacoes - a.ligacoes).map(t => (
                    <tr key={t.gerente_id} className="border-b border-[#e8e8f0]/50 dark:border-white/[0.04] hover:bg-white/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 font-medium text-foreground">{t.gerente_nome}</td>
                      <td className="py-2 text-right font-semibold text-primary">{t.ligacoes}</td>
                      <td className="py-2 text-right text-success font-semibold">{t.aproveitados}</td>
                      <td className="py-2 text-right">{t.taxa}%</td>
                      <td className="py-2 text-right">{t.visitasMarcadas}</td>
                      <td className="py-2 text-right">{t.visitasRealizadas}</td>
                      <td className="py-2 text-right">{t.propostas}</td>
                      <td className="py-2 text-right font-semibold">{formatBRLCompact(t.vgv)}</td>
                    </tr>
                  ))}
                  {teams.length > 0 && (
                    <tr className="bg-primary/5 font-semibold">
                      <td className="py-2 text-primary">Total</td>
                      <td className="py-2 text-right text-primary">{totalTeam.ligacoes}</td>
                      <td className="py-2 text-right text-success">{totalTeam.aproveitados}</td>
                      <td className="py-2 text-right">{totalTeam.ligacoes > 0 ? Math.round((totalTeam.aproveitados / totalTeam.ligacoes) * 100) : 0}%</td>
                      <td className="py-2 text-right">{totalTeam.visitasMarcadas}</td>
                      <td className="py-2 text-right">{totalTeam.visitasRealizadas}</td>
                      <td className="py-2 text-right">{totalTeam.propostas}</td>
                      <td className="py-2 text-right">{formatBRLCompact(totalTeam.vgv)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </StateWrapper>
          </CardContent>
        </Card>

        {/* Top Corretores */}
        {(corretoresRank.length > 0 || errors.teams) && (
          <Card className="mt-3 bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold">Top Corretores — Oferta Ativa</CardTitle>
            </CardHeader>
            <CardContent>
              <StateWrapper
                error={errors.teams}
                empty={corretoresRank.length === 0}
                emptyTitle="Sem corretores no período"
                onRetry={reload}
                errorTitle="Falha ao carregar o ranking de corretores"
              >
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left pb-2 font-medium">#</th>
                      <th className="text-left pb-2 font-medium">Corretor</th>
                      <th className="text-left pb-2 font-medium">Equipe</th>
                      <th className="text-right pb-2 font-medium">Lig.</th>
                      <th className="text-right pb-2 font-medium">Aprov.</th>
                      <th className="text-right pb-2 font-medium">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...corretoresRank].sort((a, b) => b.ligacoes - a.ligacoes).slice(0, 10).map((c, i) => (
                      <tr key={c.corretor_id} className="border-b border-[#e8e8f0]/50 dark:border-white/[0.04]">
                        <td className="py-1.5 font-bold text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 font-medium text-foreground">{c.nome}</td>
                        <td className="py-1.5 text-muted-foreground">{c.gerente_nome}</td>
                        <td className="py-1.5 text-right font-semibold text-primary">{c.ligacoes}</td>
                        <td className="py-1.5 text-right text-success font-semibold">{c.aproveitados}</td>
                        <td className="py-1.5 text-right">{c.taxa}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </StateWrapper>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LINHA 5 — MARKETING, RH & DADOS GERAIS                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section>
        <SectionLabel icon={Activity}>Dados Gerais</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Marketing */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-primary" /> Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-muted-foreground">Total Leads Gerados</span>
                <span className="text-sm font-bold text-primary">{totalLeadsPeriodo}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-muted-foreground">Origens Ativas</span>
                <span className="text-sm font-bold">{origens.length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-muted-foreground">Top Origem</span>
                <span className="text-sm font-bold">{origens[0]?.origem || "—"}</span>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" className="w-full text-xs text-primary border-primary/20" onClick={() => navigate("/marketing")}>
                  Ver Marketing
                </Button>
              )}
            </CardContent>
          </Card>

          {/* RH */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-primary" /> RH & Equipe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-muted-foreground">Presentes Hoje</span>
                <span className="text-sm font-bold text-success">{presentesHoje}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-muted-foreground">Equipes Ativas</span>
                <span className="text-sm font-bold">{teams.length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-muted-foreground">Total Corretores</span>
                <span className="text-sm font-bold">{corretoresRank.length}</span>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" className="w-full text-xs text-primary border-primary/20" onClick={() => navigate("/rh")}>
                  Ver RH
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Alertas & Info */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-primary" /> Alertas & Atenção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Erro tem precedência: "Operação saudável" nunca pode mascarar falha de consulta */}
              <StateWrapper
                error={errors.pipeline}
                onRetry={reload}
                errorTitle="Não foi possível carregar os alertas"
                errorDescription="Não é possível afirmar que a operação está saudável."
                className="space-y-2"
              >
              {alertas.length > 0 ? alertas.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-[11px] ${
                  a.tipo === "red" ? "bg-danger/5 text-danger" :
                  a.tipo === "yellow" ? "bg-warning/5 text-warning" :
                  "bg-success/5 text-success"
                }`}>
                  <div className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                    a.tipo === "red" ? "bg-danger" : a.tipo === "yellow" ? "bg-warning" : "bg-success"
                  }`} />
                  <span>{a.mensagem}</span>
                </div>
              )) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/5 text-success text-[11px]">
                  <CheckCircle2 className="h-4 w-4" /> Operação saudável
                </div>
              )}
              {vgvEmRisco > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/5 text-warning text-[11px]">
                  <div className="h-2 w-2 rounded-full mt-1 shrink-0 bg-warning" />
                  <span>VGV em risco (parados &gt;15d): {formatBRLCompact(vgvEmRisco)}</span>
                </div>
              )}
              </StateWrapper>
              <Button variant="outline" size="sm" className="w-full text-xs text-primary border-primary/20 mt-2" onClick={() => navigate("/central-relatorios?visao=executivo")}>
                Ver Relatório Geral
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

        </StateWrapper>
        </TabsContent>

        <TabsContent value="empresa" className="mt-0">
          <TabEmpresa />
        </TabsContent>
      </Tabs>

      {/* ═══ MODALS ═══ */}
      <FilaCeoDispatchModal open={dispatchOpen} onOpenChange={setDispatchOpen} onDispatched={() => { reload(); loadFilaCeo(); }} />
      <BulkEmpreendimentoAssign open={bulkEmpOpen} onOpenChange={setBulkEmpOpen} onComplete={reload} />
      <KpiDetailDialog
        open={!!kpiDetail}
        onOpenChange={(o) => { if (!o) setKpiDetail(null); }}
        type={kpiDetail?.type || "total_leads"}
        label={kpiDetail?.label || ""}
        dateRange={{ start: range.start, end: range.end }}
      />
    </div>
  );
}
