import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCeoDashboard, type DashPeriod } from "@/hooks/useCeoDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, RefreshCw, CheckCircle2, XCircle, Phone, ThumbsUp, CalendarDays, CalendarCheck, DollarSign, Trophy, FileText, TrendingDown, Target, AlertTriangle, Users, BarChart3, Brain, ArrowUp, ArrowDown, Rocket, Inbox } from "lucide-react";
import { format, getWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import FilaCeoDispatchModal from "@/components/pipeline/FilaCeoDispatchModal";

// ─── Greeting ───
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const FRASES = [
  "Liderar é servir com propósito.",
  "Dados guiam, pessoas executam.",
  "Cada número esconde uma história.",
  "A disciplina do processo gera resultado.",
  "O melhor dashboard é aquele que provoca ação.",
  "Quem mede, melhora. Quem acompanha, transforma.",
];

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function Variation({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-destructive"}`}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct)}%{suffix}
    </span>
  );
}

// ─── KPI Card ───
function KpiCard({ icon: Icon, label, value, displayValue, meta, prev, iconColor }: {
  icon: any; label: string; value: number; displayValue?: string; meta?: number; prev?: number; iconColor?: string;
}) {
  const pct = meta && meta > 0 ? Math.min(Math.round((value / meta) * 100), 100) : null;
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${iconColor || "text-primary"}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          {prev !== undefined && <Variation current={value} previous={prev} />}
        </div>
        <p className="text-2xl font-bold">{displayValue || value}</p>
        {pct !== null && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{pct}% da meta</span>
              <span>{meta}</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───
export default function CeoDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<DashPeriod>("hoje");
  const [frase] = useState(() => FRASES[Math.floor(Math.random() * FRASES.length)]);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [filaCeoCount, setFilaCeoCount] = useState(0);
  const [lastDispatch, setLastDispatch] = useState<{ at: string; count: number } | null>(null);

  const {
    loading, lastUpdate, profile, roletaPendentes, kpis, prevKpis,
    pipelineStages, campanhas, alertas, negocioFases, vgvEmRisco, topCorretoresVgv,
    teams, origens, leadsPorEmpreendimento, visitasPorEmp,
    reload, reloadRoleta,
  } = useCeoDashboard(period);

  // Build dashboard data for HOMI
  const dashboardData = useMemo(() => ({
    kpis, prevKpis, alertas, teams, campanhas, pipelineStages,
    filaCeoCount, origens, leadsPorEmpreendimento, visitasPorEmp,
    negocioFases, vgvEmRisco, topCorretoresVgv, period,
  }), [kpis, prevKpis, alertas, teams, campanhas, pipelineStages, filaCeoCount, origens, leadsPorEmpreendimento, visitasPorEmp, negocioFases, vgvEmRisco, topCorretoresVgv, period]);

  const now = new Date();
  const weekNum = Math.ceil(now.getDate() / 7);

  // Load Fila CEO count + last dispatch
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

  // Approve credenciamento — optimistic
  const [localPendentes, setLocalPendentes] = useState<any[]>([]);
  useEffect(() => { setLocalPendentes(roletaPendentes); }, [roletaPendentes]);

  // Get profile.id (FK target) instead of auth user.id
  const getProfileId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    return data?.id || null;
  }, [user]);

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const insertFilaForCred = useCallback(async (cred: any) => {
    const segmentoIds = [cred.segmento_1_id, cred.segmento_2_id].filter(Boolean) as string[];
    for (const segId of segmentoIds) {
      const { data: existing } = await supabase.from("roleta_fila")
        .select("posicao")
        .eq("data", hoje)
        .eq("segmento_id", segId)
        .eq("janela", cred.janela)
        .eq("ativo", true)
        .order("posicao", { ascending: false })
        .limit(1);
      const nextPos = (existing?.[0]?.posicao || 0) + 1;
      await supabase.from("roleta_fila").insert({
        corretor_id: cred.corretor_id,
        segmento_id: segId,
        janela: cred.janela,
        posicao: nextPos,
        data: hoje,
        ativo: true,
        credenciamento_id: cred.id,
      });
    }
  }, [hoje]);

  const aprovar = useCallback(async (id: string) => {
    if (!user) return;
    const profileId = await getProfileId();
    if (!profileId) { toast.error("Perfil não encontrado"); return; }
    const item = localPendentes.find((c: any) => c.id === id);
    setLocalPendentes(prev => prev.filter((c: any) => c.id !== id));

    // Get full credenciamento data for fila insertion
    const { data: cred, error } = await supabase.from("roleta_credenciamentos")
      .update({ status: "aprovado", aprovado_por: profileId, aprovado_em: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !cred) {
      console.error("Erro aprovar roleta:", error);
      toast.error("Erro ao aprovar: " + (error?.message || ""));
      setLocalPendentes(prev => [...prev, item].filter(Boolean));
      return;
    }

    // Insert into fila
    await insertFilaForCred(cred);
    toast.success(`✅ ${item?.corretor_nome || "Corretor"} aprovado(a) na Roleta!`);
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

    if (error) {
      toast.error("Erro ao recusar");
      setLocalPendentes(prev => [...prev, item].filter(Boolean));
      return;
    }
    toast.success(`❌ ${item?.corretor_nome || "Corretor"} recusado(a) da Roleta.`);
    reloadRoleta();
  }, [user, localPendentes, getProfileId, reloadRoleta]);

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
        .eq("id", c.id)
        .select()
        .single();
      if (!error && cred) {
        await insertFilaForCred(cred);
        ok++;
      }
    }
    toast.success(`✅ ${ok} corretor(es) aprovado(s) na Roleta!`);
    reloadRoleta();
  }, [user, localPendentes, getProfileId, insertFilaForCred, reloadRoleta]);



  if (loading && !profile) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const totalTeam = teams.reduce((acc, t) => ({
    ligacoes: acc.ligacoes + t.ligacoes, aproveitados: acc.aproveitados + t.aproveitados,
    visitasMarcadas: acc.visitasMarcadas + t.visitasMarcadas, visitasRealizadas: acc.visitasRealizadas + t.visitasRealizadas,
    propostas: acc.propostas + t.propostas, vgv: acc.vgv + t.vgv,
  }), { ligacoes: 0, aproveitados: 0, visitasMarcadas: 0, visitasRealizadas: 0, propostas: 0, vgv: 0 });

  return (
    <div className="space-y-4 sm:space-y-6 max-w-[1440px] mx-auto">
      {/* ─── HEADER ─── */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-5 text-white">
        <div className="flex items-center gap-3 sm:gap-4">
          <Avatar className="h-12 w-12 sm:h-16 sm:w-16 border-2 border-white/20 shrink-0">
            {(profile?.avatar_gamificado_url || profile?.avatar_url) ? (
              <AvatarImage src={(profile.avatar_gamificado_url || profile.avatar_url)!} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-base sm:text-lg">
              {(profile?.nome || "C").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: "#FFFFFF" }}>{getGreeting()}, {profile?.nome?.split(" ")[0] || "CEO"} 👋</h1>
            <p className="text-xs sm:text-sm italic mt-0.5 truncate" style={{ color: "#94A3B8" }}>"{frase}"</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#64748B" }}>
              {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })} — Semana {weekNum}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <div className="text-right text-[10px] text-white/40">
              <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Atualizado {format(lastUpdate, "HH:mm")}</div>
              <button onClick={reload} className="flex items-center gap-1 text-white/50 hover:text-white mt-0.5">
                <RefreshCw className="h-3 w-3" /> Atualizar
              </button>
            </div>
          </div>
        </div>
        {/* Period pills — always visible */}
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex rounded-lg p-0.5 gap-1">
            {(["hoje", "semana", "mes"] as DashPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p
                    ? "bg-[#1e293b] text-white border border-[#3B82F6]"
                    : "text-[#94A3B8] hover:text-white border border-transparent"
                }`}
              >
                {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <button onClick={reload} className="sm:hidden flex items-center gap-1 text-[10px] text-white/50 hover:text-white">
            <RefreshCw className="h-3 w-3" /> {format(lastUpdate, "HH:mm")}
          </button>
        </div>
      </div>


      {/* ─── SEÇÃO 1: ROLETA PENDENTES ─── */}
      <Card className={`${localPendentes.length > 0 ? "border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)] animate-pulse-border" : "border-emerald-500/30"}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              🎯 Roleta — Aprovações Pendentes
              {localPendentes.length > 0 && <Badge variant="destructive" className="text-xs">{localPendentes.length}</Badge>}
            </CardTitle>
            {localPendentes.length > 1 && (
              <Button size="sm" onClick={aprovarTodos} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {localPendentes.length === 0 ? (
            <p className="text-sm text-emerald-600 flex items-center gap-2 py-2">✅ Nenhuma aprovação pendente</p>
          ) : (
            <div className="space-y-2">
              {localPendentes.map((c: any) => (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {c.avatar && <AvatarImage src={c.avatar} />}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(c.corretor_nome || "C").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{c.corretor_nome}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">{c.janela}</Badge>
                        <Badge className="text-[10px] bg-primary/10 text-primary border-0">{c.seg1_nome}</Badge>
                        {c.seg2_nome && <Badge className="text-[10px] bg-accent text-accent-foreground border-0">{c.seg2_nome}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button size="sm" onClick={() => aprovar(c.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex-1 sm:flex-none">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => recusar(c.id)} className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs flex-1 sm:flex-none">
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── FILA CEO ─── */}
      <Card className={filaCeoCount > 0 ? "border-purple-500/40 shadow-[0_0_0_1px_rgba(124,58,237,0.15)]" : ""}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <Inbox className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-semibold whitespace-nowrap">📥 Fila CEO</span>
              {filaCeoCount > 0 && <Badge className="bg-purple-600 text-white border-none text-xs">{filaCeoCount}</Badge>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {filaCeoCount > 0 ? `${filaCeoCount} leads aguardando distribuição` : "Nenhum lead na fila"}
            {lastDispatch && (
              <span className="hidden sm:inline ml-2">• Último disparo: {format(new Date(lastDispatch.at), "dd/MM HH:mm")} ({lastDispatch.count} leads)</span>
            )}
          </p>
          <Button
            size="sm"
            onClick={() => setDispatchOpen(true)}
            disabled={filaCeoCount === 0}
            className="w-full sm:w-auto gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Rocket className="h-3.5 w-3.5" />
            Disparar para Roleta
          </Button>
        </CardContent>
      </Card>

      {/* ─── SEÇÃO 2: KPIs ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">📊 Processo</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Phone} label="Ligações" value={kpis.ligacoes} prev={prevKpis?.ligacoes} iconColor="text-blue-600" />
          <KpiCard icon={ThumbsUp} label="Aproveitados" value={kpis.aproveitados} displayValue={`${kpis.aproveitados} (${kpis.taxaConversao}%)`} prev={prevKpis?.aproveitados} iconColor="text-emerald-600" />
          <KpiCard icon={CalendarDays} label="Visitas Marcadas" value={kpis.visitasMarcadas} prev={prevKpis?.visitasMarcadas} iconColor="text-amber-600" />
          <KpiCard icon={CalendarCheck} label="Visitas Realizadas" value={kpis.visitasRealizadas} displayValue={`${kpis.visitasRealizadas} (${kpis.taxaRealizacao}%)`} prev={prevKpis?.visitasRealizadas} iconColor="text-emerald-600" />
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">💰 Resultado</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={DollarSign} label="VGV Gerado" value={kpis.vgvGerado} displayValue={formatCurrency(kpis.vgvGerado)} prev={prevKpis?.vgvGerado} iconColor="text-emerald-600" />
          <KpiCard icon={Trophy} label="VGV Assinado" value={kpis.vgvAssinado} displayValue={formatCurrency(kpis.vgvAssinado)} prev={prevKpis?.vgvAssinado} iconColor="text-amber-600" />
          <KpiCard icon={FileText} label="Propostas" value={kpis.propostas} prev={prevKpis?.propostas} iconColor="text-blue-600" />
          <KpiCard icon={TrendingDown} label="Negócios Perdidos" value={kpis.negociosPerdidos} prev={prevKpis?.negociosPerdidos} iconColor="text-destructive" />
        </div>
      </div>

      {/* ─── SEÇÃO 3: GESTÃO DE LEADS ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
          <Target className="h-4 w-4" /> Gestão de Leads — Funil e Gargalos
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
          {/* Funil (40%) */}
          <Card className="lg:col-span-4">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Funil do Pipeline</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {pipelineStages.map((s, idx) => {
                const maxCount = Math.max(...pipelineStages.map(x => x.count), 1);
                const pct = Math.round((s.count / maxCount) * 100);
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-24 truncate">{s.nome}</span>
                    <div className="flex-1 h-5 rounded bg-muted/40 relative overflow-hidden">
                      <div className="h-full rounded bg-primary/20 transition-all" style={{ width: `${pct}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{s.count}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Campanhas (30%) */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Leads por Campanha</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {campanhas.slice(0, 8).map(c => (
                  <div key={c.empreendimento} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/30">
                    <div className="truncate flex-1 mr-2">
                      <p className="font-medium truncate">{c.empreendimento}</p>
                      <p className="text-muted-foreground">{c.leads} leads</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${c.pctParados > 50 ? "border-destructive/50 text-destructive" : c.pctParados > 25 ? "border-amber-500/50 text-amber-600" : "border-emerald-500/50 text-emerald-600"}`}>
                        {c.pctAvancou}% avançou
                      </Badge>
                    </div>
                  </div>
                ))}
                {campanhas.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
              </div>
            </CardContent>
          </Card>

          {/* Alertas (30%) */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alertas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alertas.map((a, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded-md text-xs ${a.tipo === "red" ? "bg-destructive/5 text-destructive" : a.tipo === "yellow" ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700" : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700"}`}>
                    <span>{a.tipo === "red" ? "🔴" : a.tipo === "yellow" ? "🟡" : "🟢"}</span>
                    <span>{a.mensagem}</span>
                  </div>
                ))}
                {alertas.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── SEÇÃO 4: VISITAS ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Visitas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2"><CalendarDays className="h-4 w-4 text-blue-600" /><span className="text-sm font-medium">Marcadas</span></div>
              <p className="text-3xl font-bold">{kpis.visitasMarcadas}</p>
              {prevKpis && <Variation current={kpis.visitasMarcadas} previous={prevKpis.visitasMarcadas} suffix=" vs anterior" />}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2"><CalendarCheck className="h-4 w-4 text-emerald-600" /><span className="text-sm font-medium">Realizadas</span></div>
              <p className="text-3xl font-bold">{kpis.visitasRealizadas} <span className="text-sm text-muted-foreground">({kpis.taxaRealizacao}%)</span></p>
              {prevKpis && <Variation current={kpis.visitasRealizadas} previous={prevKpis.visitasRealizadas} />}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="text-sm font-medium">No-shows</span></div>
              <p className="text-3xl font-bold">{kpis.noShows} <span className="text-sm text-muted-foreground">({kpis.visitasMarcadas > 0 ? Math.round((kpis.noShows / kpis.visitasMarcadas) * 100) : 0}%)</span></p>
            </CardContent>
          </Card>
        </div>
        {visitasPorEmp.length > 0 && (
          <Card className="mt-3">
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Visitas por empreendimento</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-muted-foreground"><th className="text-left pb-1.5">Empreendimento</th><th className="text-right pb-1.5">Marcadas</th><th className="text-right pb-1.5">Realizadas</th><th className="text-right pb-1.5">Taxa</th></tr></thead>
                  <tbody>
                    {visitasPorEmp.slice(0, 8).map(v => (
                      <tr key={v.emp} className="border-b last:border-0">
                        <td className="py-1.5 font-medium">{v.emp}</td>
                        <td className="py-1.5 text-right">{v.marcadas}</td>
                        <td className="py-1.5 text-right">{v.realizadas}</td>
                        <td className="py-1.5 text-right">{v.marcadas > 0 ? Math.round((v.realizadas / v.marcadas) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── SEÇÃO 5: NEGÓCIOS E PROPOSTAS ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Negócios e Propostas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Negócios por Fase</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {negocioFases.map(f => (
                  <div key={f.fase} className="flex items-center justify-between text-xs">
                    <span className="capitalize">{f.fase}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{f.count}</Badge>
                      <span className="text-muted-foreground">{formatCurrency(f.vgv)}</span>
                    </div>
                  </div>
                ))}
                {negocioFases.length === 0 && <p className="text-xs text-muted-foreground">Sem negócios</p>}
              </div>
            </CardContent>
          </Card>

          <Card className={vgvEmRisco > 0 ? "border-destructive/30" : ""}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">VGV em Risco</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${vgvEmRisco > 0 ? "text-destructive" : ""}`}>{formatCurrency(vgvEmRisco)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Negócios parados &gt;15 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Top 5 Corretores VGV</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {topCorretoresVgv.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className={`font-bold ${i === 0 ? "text-amber-500" : "text-muted-foreground"}`}>{i + 1}.</span>
                      {c.nome}
                    </span>
                    <span className="font-semibold">{formatCurrency(c.vgv)}</span>
                  </div>
                ))}
                {topCorretoresVgv.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Leads por Empreendimento</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {leadsPorEmpreendimento.slice(0, 5).map(l => (
                  <div key={l.emp} className="flex items-center justify-between text-xs">
                    <span className="truncate mr-2">{l.emp}</span>
                    <Badge variant="outline" className="text-[10px]">{l.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── SEÇÃO 6: PERFORMANCE POR EQUIPE ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
          <Users className="h-4 w-4" /> Performance por Equipe
        </h2>
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left pb-2 font-medium">Equipe</th>
                    <th className="text-right pb-2 font-medium">Ligações</th>
                    <th className="text-right pb-2 font-medium">Aproveitados</th>
                    <th className="text-right pb-2 font-medium">Taxa%</th>
                    <th className="text-right pb-2 font-medium">V. Marcadas</th>
                    <th className="text-right pb-2 font-medium">V. Realizadas</th>
                    <th className="text-right pb-2 font-medium">Propostas</th>
                    <th className="text-right pb-2 font-medium">VGV</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(t => {
                    const avgLig = totalTeam.ligacoes / Math.max(teams.length, 1);
                    const avgAprov = totalTeam.aproveitados / Math.max(teams.length, 1);
                    return (
                      <tr key={t.gerente_id} className="border-b">
                        <td className="py-2 font-medium">{t.gerente_nome}</td>
                        <td className={`py-2 text-right ${t.ligacoes >= avgLig ? "text-emerald-600" : "text-destructive"}`}>{t.ligacoes}</td>
                        <td className={`py-2 text-right ${t.aproveitados >= avgAprov ? "text-emerald-600" : "text-destructive"}`}>{t.aproveitados}</td>
                        <td className="py-2 text-right">{t.taxa}%</td>
                        <td className="py-2 text-right">{t.visitasMarcadas}</td>
                        <td className="py-2 text-right">{t.visitasRealizadas}</td>
                        <td className="py-2 text-right">{t.propostas}</td>
                        <td className="py-2 text-right font-semibold">{formatCurrency(t.vgv)}</td>
                      </tr>
                    );
                  })}
                  {teams.length > 0 && (
                    <tr className="bg-muted/30 font-semibold">
                      <td className="py-2">Total</td>
                      <td className="py-2 text-right">{totalTeam.ligacoes}</td>
                      <td className="py-2 text-right">{totalTeam.aproveitados}</td>
                      <td className="py-2 text-right">{totalTeam.ligacoes > 0 ? Math.round((totalTeam.aproveitados / totalTeam.ligacoes) * 100) : 0}%</td>
                      <td className="py-2 text-right">{totalTeam.visitasMarcadas}</td>
                      <td className="py-2 text-right">{totalTeam.visitasRealizadas}</td>
                      <td className="py-2 text-right">{totalTeam.propostas}</td>
                      <td className="py-2 text-right">{formatCurrency(totalTeam.vgv)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── SEÇÃO 7: MARKETING ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Marketing e Origem
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Leads por Origem</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {origens.slice(0, 8).map(o => {
                  const maxO = Math.max(...origens.map(x => x.count), 1);
                  return (
                    <div key={o.origem} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="truncate">{o.origem}</span>
                        <span className="font-semibold">{o.count}</span>
                      </div>
                      <div className="h-2 rounded bg-muted/40 overflow-hidden">
                        <div className="h-full rounded bg-primary/60 transition-all" style={{ width: `${(o.count / maxO) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {origens.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Leads por Empreendimento</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leadsPorEmpreendimento.slice(0, 8).map(l => {
                  const maxL = Math.max(...leadsPorEmpreendimento.map(x => x.count), 1);
                  return (
                    <div key={l.emp} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="truncate">{l.emp}</span>
                        <span className="font-semibold">{l.count}</span>
                      </div>
                      <div className="h-2 rounded bg-muted/40 overflow-hidden">
                        <div className="h-full rounded bg-amber-500/60 transition-all" style={{ width: `${(l.count / maxL) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fila CEO Dispatch Modal */}
      <FilaCeoDispatchModal
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        onDispatched={() => { reload(); loadFilaCeo(); }}
      />
    </div>
  );
}
