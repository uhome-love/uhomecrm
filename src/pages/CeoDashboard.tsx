import { useState, useEffect, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 as Building2Tab } from "lucide-react";
import TabEmpresa from "@/components/ceo/TabEmpresa";
import { GreetingBar } from "@/components/ui/GreetingBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { formatBRLCompact } from "@/lib/utils";
import { CeoDashboardSkeleton } from "@/components/ui/skeleton-dashboard";
import KpiDetailDialog, { type KpiDetailType } from "@/components/ceo/KpiDetailDialog";

const FRASES = [
  "Liderar é servir com propósito.",
  "Dados guiam, pessoas executam.",
  "Cada número esconde uma história.",
  "A disciplina do processo gera resultado.",
  "O melhor dashboard é aquele que provoca ação.",
  "Quem mede, melhora. Quem acompanha, transforma.",
];

const ORIGIN_COLORS: Record<string, string> = {
  meta_ads: "#3b82f6", "Meta Ads": "#3b82f6",
  "TikTok Ads": "#ec4899",
  "Landing Page": "#10b981",
  imovelweb: "#f97316", ImovelWeb: "#f97316",
  site_uhome: "#06b6d4", "Site - uhome.com.br": "#06b6d4",
  jetimob: "#6366f1", indicacao: "#8b5cf6",
  whatsapp: "#22c55e", rd_station: "#f59e0b",
  "Oferta Ativa": "#4F46E5",
};
const FALLBACK_COLORS = ["#3b82f6","#ec4899","#10b981","#f97316","#06b6d4","#6366f1","#8b5cf6","#f59e0b","#ef4444","#14b8a6"];

// ─── Section Label ───
function SectionLabel({ children, icon: Icon }: { children: string; icon: any }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-7 w-7 rounded-lg bg-[#4F46E5]/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-[#4F46E5]" />
      </div>
      <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#4F46E5]">{children}</span>
    </div>
  );
}

// ─── Mini KPI ───
function MiniKpi({ label, value, sub, variant = "default", onClick }: {
  label: string; value: string | number; sub?: string;
  variant?: "default" | "highlight" | "success" | "warning";
  onClick?: () => void;
}) {
  const colors = {
    default: "text-foreground",
    highlight: "text-[#4F46E5]",
    success: "text-[#10b981]",
    warning: "text-[#f59e0b]",
  };
  return (
    <div
      onClick={onClick}
      className={`bg-[#f7f7fb] dark:bg-[#141e30] border border-[#e8e8f0] dark:border-white/[0.07] rounded-xl p-3.5 border-l-[3px] border-l-[#4F46E5] ${onClick ? "cursor-pointer hover:border-[#d0d0d8] dark:hover:border-white/[0.12] transition-colors" : ""}`}
    >
      <p className="text-[10px] font-medium text-[#a1a1aa] dark:text-[#52525b] tracking-wide mb-1 truncate">{label}</p>
      <p className={`text-xl font-[800] leading-none tracking-tight ${colors[variant]}`}>{value}</p>
      {sub && <p className="text-[10px] text-[#a1a1aa] mt-1 truncate">{sub}</p>}
    </div>
  );
}

// ─── Horizontal Bar ───
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="group/bar">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="truncate text-[#71717a] group-hover/bar:text-foreground transition-colors">{label}</span>
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
        <p className="text-[10px] text-[#a1a1aa]">{pct}% do total</p>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function CeoDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { period, range } = useDateFilter();
  const [frase] = useState(() => FRASES[Math.floor(Math.random() * FRASES.length)]);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [filaCeoCount, setFilaCeoCount] = useState(0);
  const [lastDispatch, setLastDispatch] = useState<{ at: string; count: number } | null>(null);
  const [bulkEmpOpen, setBulkEmpOpen] = useState(false);
  const [kpiDetail, setKpiDetail] = useState<{ type: KpiDetailType; label: string } | null>(null);
  const [funnelFilter, setFunnelFilter] = useState<"all" | string>("all");
  const [funnelCorretorFilter, setFunnelCorretorFilter] = useState<"all" | string>("all");
  const [showAllCorretorLeads, setShowAllCorretorLeads] = useState(false);

  const {
    loading, lastUpdate, profile, roletaPendentes, kpis, prevKpis,
    pipelineStages, campanhas, alertas, negocioFases, vgvEmRisco, topCorretoresVgv,
    teams, corretoresRank, origens, leadsPorEmpreendimento, leadsPorCorretor, visitasPorEmp,
    totalLeadsPeriodo, leadsReaproveitadosOA, totalVisitasCriadas, novoInteresse, enviadosRoleta, presentesHoje, metasDiaTotal,
    reload, reloadRoleta,
  } = useCeoDashboard(period as DashPeriod, { start: range.start, end: range.end });

  // CEO metas
  const [ceoMetas, setCeoMetas] = useState<any>({});
  useEffect(() => {
    const mesAtual = format(new Date(), "yyyy-MM");
    supabase.from("ceo_metas_mensais").select("*").eq("mes", mesAtual).then(({ data }) => {
      if (data && data.length > 0) {
        setCeoMetas({
          meta_ligacoes: data.reduce((a: number, m: any) => a + (m.meta_ligacoes || 0), 0),
          meta_visitas_marcadas: data.reduce((a: number, m: any) => a + (m.meta_visitas_marcadas || 0), 0),
          meta_visitas_realizadas: data.reduce((a: number, m: any) => a + (m.meta_visitas_realizadas || 0), 0),
          meta_vgv_assinado: data.reduce((a: number, m: any) => a + (m.meta_vgv_assinado || 0), 0),
          meta_propostas: data.reduce((a: number, m: any) => a + ((m as any).meta_propostas || 0), 0),
          meta_contratos: data.reduce((a: number, m: any) => a + ((m as any).meta_contratos || 0), 0),
          meta_assinados: data.reduce((a: number, m: any) => a + ((m as any).meta_assinados || 0), 0),
        });
      }
    });
  }, []);

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  // Fila CEO
  const loadFilaCeo = useCallback(async () => {
    const [countRes, logRes] = await Promise.all([
      supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).eq("aceite_status", "pendente_distribuicao").is("corretor_id", null),
      supabase.from("audit_log").select("created_at, depois").eq("acao", "dispatch_fila_ceo").order("created_at", { ascending: false }).limit(1),
    ]);
    setFilaCeoCount(countRes.count || 0);
    if (logRes.data?.[0]) {
      const d = logRes.data[0].depois as any;
      setLastDispatch({ at: logRes.data[0].created_at, count: d?.dispatched || 0 });
    }
  }, []);
  useEffect(() => { loadFilaCeo(); }, [loadFilaCeo]);

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
      const { data: existing } = await supabase.from("roleta_fila")
        .select("posicao").eq("data", hoje).eq("segmento_id", segId).eq("janela", cred.janela).eq("ativo", true)
        .order("posicao", { ascending: false }).limit(1);
      const nextPos = (existing?.[0]?.posicao || 0) + 1;
      await supabase.from("roleta_fila").insert({
        corretor_id: cred.corretor_id, segmento_id: segId, janela: cred.janela,
        posicao: nextPos, data: hoje, ativo: true, credenciamento_id: cred.id,
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

  const totalVisitas = kpis.visitasMarcadas + kpis.visitasRealizadas + kpis.noShows;
  const totalNeg = negocioFases.reduce((a: number, f: any) => a + f.count, 0);
  const negTotalVgv = negocioFases.reduce((a: number, f: any) => a + f.vgv, 0);
  const contratoGerado = negocioFases.find((f: any) => f.fase === "documentacao");
  const vgvContrato = contratoGerado?.vgv || 0;
  const countContrato = contratoGerado?.count || 0;
  const leadsDistribuidos = enviadosRoleta;

  // Pipeline funnel totals
  const funnelTotal = pipelineStages.reduce((a, s) => a + s.count, 0) || 1;
  const funnelColors = ["#4F46E5","#6366f1","#818cf8","#a5b4fc","#c7d2fe","#22c55e","#ef4444","#10b981","#f59e0b"];

  // Negocio funnel order
  const negFunnelOrder = ["novo_negocio","proposta","negociacao","documentacao","assinado","vendido","distrato"];
  const negFunnelLabels: Record<string,string> = {
    novo_negocio:"Novo Negócio", proposta:"Proposta", negociacao:"Negociação",
    documentacao:"Contrato Gerado", assinado:"Assinado",
    vendido:"Vendido", distrato:"Caiu"
  };
  const negFunnelColors: Record<string,string> = {
    novo_negocio:"#0EA5E9", proposta:"#3B82F6", negociacao:"#F59E0B",
    documentacao:"#8B5CF6", assinado:"#22C55E",
    vendido:"#16A34A", distrato:"#EF4444"
  };

  if (loading && !profile) return <CeoDashboardSkeleton />;

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-4 -m-4 sm:p-6 sm:-m-6 min-h-full space-y-5">
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
            onClick={() => navigate("/pipeline-leads")}
            className="gap-1.5 text-xs border-[#4F46E5]/30 text-[#4F46E5] hover:bg-[#4F46E5]/5"
          >
            <Inbox className="h-3.5 w-3.5" />
            Fila CEO
            {filaCeoCount > 0 && <Badge className="bg-[#4F46E5] text-white text-[10px] px-1.5 py-0 ml-1">{filaCeoCount}</Badge>}
          </Button>
          <Button
            size="sm"
            onClick={() => setDispatchOpen(true)}
            disabled={filaCeoCount === 0}
            className="gap-1.5 text-xs bg-[#4F46E5] hover:bg-[#4338CA] text-white"
          >
            <Rocket className="h-3.5 w-3.5" />
            Disparar Roleta
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

      {/* ═══ APROVAÇÕES PENDENTES ═══ */}
      {localPendentes.length > 0 && (
        <Card className="border-[#4F46E5]/40 bg-[#f7f7fb] dark:bg-[#141e30]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                Aprovações Pendentes
                <Badge className="bg-[#4F46E5] text-white text-[10px]">{localPendentes.length}</Badge>
              </CardTitle>
              {localPendentes.length > 1 && (
                <Button size="sm" onClick={aprovarTodos} className="bg-[#10b981] hover:bg-[#059669] text-white text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar todos
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {localPendentes.map((c: any) => (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-[#e8e8f0] dark:border-white/[0.07] bg-white dark:bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {c.avatar && <AvatarImage src={c.avatar} />}
                      <AvatarFallback className="text-xs bg-[#4F46E5]/10 text-[#4F46E5]">
                        {(c.corretor_nome || "C").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{c.corretor_nome}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">{c.janela}</Badge>
                        <Badge className="text-[10px] bg-[#4F46E5]/10 text-[#4F46E5] border-0">{c.seg1_nome}</Badge>
                        {c.seg2_nome && <Badge className="text-[10px] bg-muted text-muted-foreground border-0">{c.seg2_nome}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => aprovar(c.id)} className="bg-[#10b981] hover:bg-[#059669] text-white text-xs flex-1 sm:flex-none">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => recusar(c.id)} className="text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/5 text-xs flex-1 sm:flex-none">
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            sub="Leads da Oferta Ativa" />
          <MiniKpi label="Enviados p/ Roleta" value={leadsDistribuidos > 0 ? leadsDistribuidos : 0}
            sub={filaCeoCount > 0 ? `${filaCeoCount} na fila` : "Fila vazia"} />
          <MiniKpi label="Novo Interesse" value={novoInteresse}
            sub="Leads com novo interesse" />
          <MiniKpi label="Corretores na Roleta" value={presentesHoje} sub={`${presentesHoje} presentes hoje`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Leads por Campanha/Empreendimento */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-[#4F46E5]" /> Leads por Empreendimento
                </CardTitle>
                {campanhas.some(c => c.empreendimento === "Sem empreendimento") && (
                  <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setBulkEmpOpen(true)}>Corrigir</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {leadsPorEmpreendimento.filter(l => l.emp !== "Sem empreendimento").slice(0, 10).map((l, idx) => {
                  const max = Math.max(...leadsPorEmpreendimento.map(x => x.count), 1);
                  const color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return <HBar key={l.emp} label={l.emp} value={l.count} max={max} color={color} />;
                })}
                {leadsPorEmpreendimento.length === 0 && <p className="text-xs text-[#a1a1aa] text-center py-4">Sem dados</p>}
              </div>
            </CardContent>
          </Card>

          {/* Leads por Origem */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-[#4F46E5]" /> Leads por Origem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {origens.slice(0, 8).map((o, idx) => {
                  const max = Math.max(...origens.map(x => x.count), 1);
                  const color = ORIGIN_COLORS[o.origem] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return <HBar key={o.origem} label={o.origem} value={o.count} max={max} color={color} />;
                })}
                {origens.length === 0 && <p className="text-xs text-[#a1a1aa] text-center py-4">Sem dados</p>}
              </div>
            </CardContent>
          </Card>

          {/* Leads por Corretor */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-[#4F46E5]" /> Leads por Corretor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`space-y-2.5 ${showAllCorretorLeads ? "" : ""}`}>
                {(showAllCorretorLeads ? leadsPorCorretor : leadsPorCorretor.slice(0, 6)).map((c, idx) => {
                  const max = Math.max(...leadsPorCorretor.map(x => x.count), 1);
                  const color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return <HBar key={`${c.nome}-${idx}`} label={c.nome} value={c.count} max={max} color={color} />;
                })}
                {leadsPorCorretor.length === 0 && <p className="text-xs text-[#a1a1aa] text-center py-4">Sem dados</p>}
              </div>
              {leadsPorCorretor.length > 6 && (
                <Button variant="ghost" size="sm" className="w-full mt-2 text-[10px] text-[#4F46E5] hover:text-[#4F46E5]/80" onClick={() => setShowAllCorretorLeads(!showAllCorretorLeads)}>
                  {showAllCorretorLeads ? "Ver menos" : `Ver mais (${leadsPorCorretor.length})`}
                </Button>
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
          <Card className="lg:col-span-2 bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-xs font-semibold">Funil do Pipeline</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={funnelFilter} onValueChange={setFunnelFilter}>
                    <SelectTrigger className="h-7 text-[10px] w-32 bg-white dark:bg-white/[0.05]">
                      <SelectValue placeholder="Equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Equipes</SelectItem>
                      {teams.map(t => <SelectItem key={t.gerente_id} value={t.gerente_id}>{t.gerente_nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {pipelineStages.map((s, idx) => {
                  const maxCount = Math.max(...pipelineStages.map(x => x.count), 1);
                  const pct = Math.round((s.count / maxCount) * 100);
                  const stageColor = s.tipo === "descarte" ? "#ef4444" : s.tipo === "convertido" ? "#10b981" : `hsl(${240 - idx * 15}, 70%, ${55 + idx * 3}%)`;
                  return (
                    <div key={s.id} className="flex items-center gap-2 group/stage">
                      <span className="text-[10px] text-[#71717a] w-28 truncate group-hover/stage:text-foreground transition-colors">{s.nome}</span>
                      <div className="flex-1 h-6 rounded-lg bg-[#e8e8f0]/50 dark:bg-white/[0.04] relative overflow-hidden">
                        <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: stageColor, opacity: 0.8 }} />
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-foreground">{s.count}</span>
                      </div>
                      <span className="text-[9px] text-[#a1a1aa] w-10 text-right">{Math.round((s.count / funnelTotal) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Agenda de Visitas - 1/3 */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <CalendarCheck className="h-3.5 w-3.5 text-[#4F46E5]" /> Agenda de Visitas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white dark:bg-white/[0.04] rounded-xl p-3 text-center border border-[#e8e8f0] dark:border-white/[0.05]">
                  <p className="text-2xl font-[800] text-[#4F46E5]">{totalVisitasCriadas}</p>
                  <p className="text-[10px] text-[#a1a1aa] mt-0.5">Total Visitas (Novas)</p>
                </div>
                <div className="bg-white dark:bg-white/[0.04] rounded-xl p-3 text-center border border-[#e8e8f0] dark:border-white/[0.05]">
                  <p className="text-2xl font-[800] text-[#f59e0b]">{kpis.visitasMarcadas}</p>
                  <p className="text-[10px] text-[#a1a1aa] mt-0.5">Marcadas</p>
                </div>
                <div className="bg-white dark:bg-white/[0.04] rounded-xl p-3 text-center border border-[#e8e8f0] dark:border-white/[0.05]">
                  <p className="text-2xl font-[800] text-[#10b981]">{kpis.visitasRealizadas}</p>
                  <p className="text-[10px] text-[#a1a1aa] mt-0.5">Realizadas</p>
                </div>
                <div className="bg-white dark:bg-white/[0.04] rounded-xl p-3 text-center border border-[#e8e8f0] dark:border-white/[0.05]">
                  <p className="text-2xl font-[800] text-[#ef4444]">{kpis.noShows}</p>
                  <p className="text-[10px] text-[#a1a1aa] mt-0.5">No Show</p>
                </div>
              </div>
              {ceoMetas.meta_visitas_realizadas > 0 && (
                <div className="bg-white dark:bg-white/[0.04] rounded-xl p-3 border border-[#e8e8f0] dark:border-white/[0.05]">
                  <div className="flex justify-between text-[10px] text-[#a1a1aa] mb-1">
                    <span>Meta Visitas Realizadas</span>
                    <span className="font-semibold text-foreground">{Math.round((kpis.visitasRealizadas / ceoMetas.meta_visitas_realizadas) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#e8e8f0] dark:bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-[#10b981] transition-all" style={{ width: `${Math.min((kpis.visitasRealizadas / ceoMetas.meta_visitas_realizadas) * 100, 100)}%` }} />
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
          <MiniKpi label="Total de Negócios" value={totalNeg} variant="highlight" />
          <MiniKpi label="VGV em Contrato Gerado" value={formatBRLCompact(vgvContrato)} sub={`${countContrato} negócio${countContrato !== 1 ? "s" : ""} em contrato`} />
          <MiniKpi label="VGV Assinado" value={formatBRLCompact(kpis.vgvAssinado)} variant="success"
            sub={ceoMetas.meta_vgv_assinado > 0 ? `${Math.round((kpis.vgvAssinado / ceoMetas.meta_vgv_assinado) * 100)}% da meta` : undefined}
            onClick={() => setKpiDetail({ type: "vgv_assinado", label: "VGV Assinado" })} />
          <MiniKpi label="Propostas" value={kpis.propostas}
            sub={ceoMetas.meta_propostas > 0 ? `meta: ${ceoMetas.meta_propostas}` : undefined}
            onClick={() => setKpiDetail({ type: "propostas", label: "Propostas" })} />
        </div>

        <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-semibold">Funil de Negócios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {negFunnelOrder.map((fase, idx) => {
                const data = negocioFases.find((f: any) => f.fase === fase);
                const count = data?.count || 0;
                const vgv = data?.vgv || 0;
                const maxCount = Math.max(...negocioFases.map((f: any) => f.count), 1);
                const widthPct = maxCount > 0 ? Math.max((count / maxCount) * 100, 18) : 18;
                const color = negFunnelColors[fase] || "#a1a1aa";
                const isLast = idx === negFunnelOrder.length - 1;
                const isCaiu = fase.toLowerCase().includes("caiu") || fase.toLowerCase().includes("perdid");
                return (
                  <div key={fase} className="flex flex-col items-center text-center gap-2">
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
                    <span className="text-[11px] font-semibold text-[#52525b] dark:text-[#a1a1aa] leading-tight">
                      {negFunnelLabels[fase] || fase}
                    </span>
                    <span className="text-[10px] font-medium text-[#a1a1aa] dark:text-[#71717a]">
                      {formatBRLCompact(vgv)}
                    </span>
                  </div>
                );
              })}
            </div>
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
            sub={ceoMetas.meta_ligacoes > 0 ? `${Math.round((kpis.ligacoes / ceoMetas.meta_ligacoes) * 100)}% da meta` : undefined}
            onClick={() => setKpiDetail({ type: "tentativas", label: "Ligações" })} />
          <MiniKpi label="Aproveitados" value={kpis.aproveitados} variant="success"
            sub={`Taxa: ${kpis.taxaConversao}%`}
            onClick={() => setKpiDetail({ type: "aproveitados", label: "Aproveitados" })} />
          <MiniKpi label="Metas do Dia" value={`${metasDiaTotal.ligacoes} lig`}
            sub={`${metasDiaTotal.aproveitados} aprov · ${metasDiaTotal.visitasMarcadas} VM`} />
          <MiniKpi label="Taxa Aproveitamento" value={`${kpis.taxaConversao}%`}
            variant={kpis.taxaConversao >= 10 ? "success" : kpis.taxaConversao >= 5 ? "warning" : "default"} />
        </div>

        <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold">Performance por Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#e8e8f0] dark:border-white/[0.07] text-[#a1a1aa]">
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
                      <td className="py-2 text-right font-semibold text-[#4F46E5]">{t.ligacoes}</td>
                      <td className="py-2 text-right text-[#10b981] font-semibold">{t.aproveitados}</td>
                      <td className="py-2 text-right">{t.taxa}%</td>
                      <td className="py-2 text-right">{t.visitasMarcadas}</td>
                      <td className="py-2 text-right">{t.visitasRealizadas}</td>
                      <td className="py-2 text-right">{t.propostas}</td>
                      <td className="py-2 text-right font-semibold">{formatBRLCompact(t.vgv)}</td>
                    </tr>
                  ))}
                  {teams.length > 0 && (
                    <tr className="bg-[#4F46E5]/5 font-semibold">
                      <td className="py-2 text-[#4F46E5]">Total</td>
                      <td className="py-2 text-right text-[#4F46E5]">{totalTeam.ligacoes}</td>
                      <td className="py-2 text-right text-[#10b981]">{totalTeam.aproveitados}</td>
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
          </CardContent>
        </Card>

        {/* Top Corretores */}
        {corretoresRank.length > 0 && (
          <Card className="mt-3 bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold">Top Corretores — Oferta Ativa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-[#e8e8f0] dark:border-white/[0.07] text-[#a1a1aa]">
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
                        <td className="py-1.5 font-bold text-[#a1a1aa]">{i + 1}</td>
                        <td className="py-1.5 font-medium text-foreground">{c.nome}</td>
                        <td className="py-1.5 text-[#a1a1aa]">{c.gerente_nome}</td>
                        <td className="py-1.5 text-right font-semibold text-[#4F46E5]">{c.ligacoes}</td>
                        <td className="py-1.5 text-right text-[#10b981] font-semibold">{c.aproveitados}</td>
                        <td className="py-1.5 text-right">{c.taxa}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-[#4F46E5]" /> Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-[#71717a]">Total Leads Gerados</span>
                <span className="text-sm font-bold text-[#4F46E5]">{totalLeadsPeriodo}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-[#71717a]">Origens Ativas</span>
                <span className="text-sm font-bold">{origens.length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-[#71717a]">Top Origem</span>
                <span className="text-sm font-bold">{origens[0]?.origem || "—"}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full text-xs text-[#4F46E5] border-[#4F46E5]/20" onClick={() => navigate("/marketing")}>
                Ver Marketing
              </Button>
            </CardContent>
          </Card>

          {/* RH */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-[#4F46E5]" /> RH & Equipe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-[#71717a]">Presentes Hoje</span>
                <span className="text-sm font-bold text-[#10b981]">{presentesHoje}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-[#71717a]">Equipes Ativas</span>
                <span className="text-sm font-bold">{teams.length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.05]">
                <span className="text-[11px] text-[#71717a]">Total Corretores</span>
                <span className="text-sm font-bold">{corretoresRank.length}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full text-xs text-[#4F46E5] border-[#4F46E5]/20" onClick={() => navigate("/rh")}>
                Ver RH
              </Button>
            </CardContent>
          </Card>

          {/* Alertas & Info */}
          <Card className="bg-[#f7f7fb] dark:bg-[#141e30] border-[#e8e8f0] dark:border-white/[0.07] shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-[#4F46E5]" /> Alertas & Atenção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertas.length > 0 ? alertas.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-[11px] ${
                  a.tipo === "red" ? "bg-[#ef4444]/5 text-[#ef4444]" :
                  a.tipo === "yellow" ? "bg-[#f59e0b]/5 text-[#f59e0b]" :
                  "bg-[#10b981]/5 text-[#10b981]"
                }`}>
                  <div className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                    a.tipo === "red" ? "bg-[#ef4444]" : a.tipo === "yellow" ? "bg-[#f59e0b]" : "bg-[#10b981]"
                  }`} />
                  <span>{a.mensagem}</span>
                </div>
              )) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[#10b981]/5 text-[#10b981] text-[11px]">
                  <CheckCircle2 className="h-4 w-4" /> Operação saudável
                </div>
              )}
              {vgvEmRisco > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#f59e0b]/5 text-[#f59e0b] text-[11px]">
                  <div className="h-2 w-2 rounded-full mt-1 shrink-0 bg-[#f59e0b]" />
                  <span>VGV em risco (parados &gt;15d): {formatBRLCompact(vgvEmRisco)}</span>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full text-xs text-[#4F46E5] border-[#4F46E5]/20 mt-2" onClick={() => navigate("/relatorio-semanal")}>
                Ver Relatório Geral
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

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
