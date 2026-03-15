import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft, ChevronRight, Download, Loader2, Users, ThumbsUp,
  ArrowUpDown, CalendarCheck, Briefcase, DollarSign, ArrowUp, ArrowDown,
  Trophy, Target, TrendingUp, AlertTriangle, Lightbulb, RefreshCw
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatBRLCompact } from "@/lib/utils";
import {
  getWeekRange,
  useWeeklyKpis,
  useLeadsByOrigin,
  useLeadsByEmpreendimento,
  useFunnelData,
  useVisitsByDay,
  useWeeklyDeals,
  useWeeklyRankings,
  type WeekRange,
} from "@/hooks/useRelatorioSemanal";

// ── Variation badge ──
function Var({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-destructive"}`}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct)}% vs semana passada
    </span>
  );
}

// ── KPI Card ──
const KPI_CONFIG = [
  { key: "novosLeads", label: "Novos Leads", icon: Users, bg: "bg-blue-500/10", iconColor: "text-blue-500" },
  { key: "aproveitadosOA", label: "Aproveitados OA", icon: ThumbsUp, bg: "bg-emerald-500/10", iconColor: "text-emerald-500" },
  { key: "avancosPipeline", label: "Avanços Pipeline", icon: ArrowUpDown, bg: "bg-violet-500/10", iconColor: "text-violet-500" },
  { key: "visitasRealizadas", label: "Visitas Realizadas", icon: CalendarCheck, bg: "bg-amber-500/10", iconColor: "text-amber-500" },
  { key: "negociosAbertos", label: "Negócios Abertos", icon: Briefcase, bg: "bg-pink-500/10", iconColor: "text-pink-500" },
  { key: "assinados", label: "Assinados", icon: DollarSign, bg: "bg-emerald-600/10", iconColor: "text-emerald-600" },
] as const;

// ── Section 7 - AI Analysis ──
function AIAnalysisSection({ week }: { week: WeekRange }) {
  const { session } = useAuth();
  const [analysis, setAnalysis] = useState<{ atencao: string[]; oportunidades: string[]; recomendacao: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const generate = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const weekKey = format(week.start, "yyyy-MM-dd");
      // Check cache
      const { data: cached } = await supabase
        .from("homi_briefing_diario")
        .select("*")
        .eq("data", weekKey)
        .eq("status_geral", "weekly_ceo")
        .maybeSingle();

      if (cached?.dados_contexto && !loaded) {
        const ctx = cached.dados_contexto as any;
        if (ctx.atencao) {
          setAnalysis({ atencao: ctx.atencao, oportunidades: ctx.oportunidades, recomendacao: ctx.recomendacao });
          setLoading(false);
          setLoaded(true);
          return;
        }
      }

      const periodo = `${format(week.start, "dd/MM")} a ${format(week.end, "dd/MM/yyyy")}`;
      const { data, error } = await supabase.functions.invoke("homi-ceo", {
        body: {
          messages: [{
            role: "user",
            content: `Analise os dados da semana ${periodo} do sistema UHome Sales e gere:\n1. Os 3 principais pontos de atenção operacional\n2. As 2 maiores oportunidades identificadas nos dados\n3. Uma recomendação estratégica prioritária para a próxima semana\nSeja direto, use dados reais, máximo 200 palavras. Retorne em JSON com as chaves: atencao (array de 3 strings), oportunidades (array de 2 strings), recomendacao (string).`
          }]
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      let parsed: any;
      try {
        const text = typeof data === "string" ? data : data?.content || data?.message || JSON.stringify(data);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { atencao: ["Dados insuficientes"], oportunidades: ["—"], recomendacao: "Acompanhe os indicadores" };
      } catch {
        parsed = { atencao: ["Análise gerada com sucesso"], oportunidades: ["—"], recomendacao: typeof data === "string" ? data.slice(0, 200) : "Acompanhe os indicadores" };
      }

      setAnalysis(parsed);
      setLoaded(true);

      // Cache
      await supabase.from("homi_briefing_diario").upsert({
        user_id: session.user.id,
        data: weekKey,
        status_geral: "weekly_ceo",
        dados_contexto: parsed,
        gerado_em: new Date().toISOString(),
      }, { onConflict: "user_id,data" }).select();
    } catch (e) {
      console.error("AI analysis error:", e);
      toast.error("Erro ao gerar análise IA");
    } finally {
      setLoading(false);
    }
  }, [week, session, loaded]);

  // Auto-load on mount
  useEffect(() => { generate(); }, []);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">🤖 Análise HOMI da Semana</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => { setLoaded(false); generate(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Regenerar
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !analysis ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : analysis ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-destructive/10 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" /> Pontos de Atenção
              </div>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {(analysis.atencao || []).map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-600 text-sm">
                <Lightbulb className="h-4 w-4" /> Oportunidades
              </div>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {(analysis.oportunidades || []).map((o, i) => <li key={i}>• {o}</li>)}
              </ul>
            </div>
            <div className="rounded-lg bg-primary/10 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-primary text-sm">
                <Target className="h-4 w-4" /> Recomendação da Semana
              </div>
              <p className="text-xs text-muted-foreground">{analysis.recomendacao}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Briefing indisponível — acesse o HOMI CEO para análise manual.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──
export default function RelatorioSemanal() {
  const { user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const week = getWeekRange(weekOffset);
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: kpis, isLoading: kpisLoading } = useWeeklyKpis(week);
  const { data: leadsOrigin, isLoading: originLoading } = useLeadsByOrigin(week);
  const { data: leadsEmp, isLoading: empLoading } = useLeadsByEmpreendimento(week);
  const { data: funnel, isLoading: funnelLoading } = useFunnelData(week);
  const { data: visitDays, isLoading: visitsLoading } = useVisitsByDay(week);
  const { data: deals, isLoading: dealsLoading } = useWeeklyDeals(week);
  const { data: rankings, isLoading: rankingsLoading } = useWeeklyRankings(week);

  const profileName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "CEO";

  const handlePDF = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const mod = await import("html2pdf.js");
      const html2pdfFn = (mod.default || mod) as any;
      await html2pdfFn().set({
        margin: [8, 8, 8, 8],
        filename: `relatorio-semanal-${format(week.start, "yyyy-MM-dd")}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      }).from(reportRef.current.cloneNode(true)).save();
    } catch (e) {
      console.error("PDF error:", e);
      toast.error("Erro ao gerar PDF");
    } finally {
      setDownloading(false);
    }
  };

  const maxFunnel = funnel ? Math.max(...funnel.map(f => f.count), 1) : 1;
  const maxOrigin = leadsOrigin ? Math.max(...leadsOrigin.map(o => o.value), 1) : 1;
  const maxEmp = leadsEmp ? Math.max(...leadsEmp.map(e => e.value), 1) : 1;

  // Visit highlights
  const bestDay = visitDays ? [...visitDays].sort((a, b) => b.realizadas - a.realizadas)[0] : null;
  const worstDay = visitDays ? [...visitDays].filter(d => d.marcadas > 0).sort((a, b) => a.taxa - b.taxa)[0] : null;
  const totalVisits = visitDays ? visitDays.reduce((acc, d) => ({
    marcadas: acc.marcadas + d.marcadas,
    confirmadas: acc.confirmadas + d.confirmadas,
    realizadas: acc.realizadas + d.realizadas,
    noShow: acc.noShow + d.noShow,
    canceladas: acc.canceladas + d.canceladas,
  }), { marcadas: 0, confirmadas: 0, realizadas: 0, noShow: 0, canceladas: 0 }) : null;
  const totalTaxa = totalVisits && totalVisits.marcadas > 0 ? Math.round((totalVisits.realizadas / totalVisits.marcadas) * 100) : 0;

  const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">📊 Relatório Semanal</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada da semana operacional</p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePDF} disabled={downloading}>
          {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
          Baixar PDF
        </Button>
      </div>

      {/* Week selector */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Badge variant="secondary" className="text-sm px-4 py-1.5">{week.label}</Badge>
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div ref={reportRef} className="space-y-6">
        {/* SECTION 1 — KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {KPI_CONFIG.map(({ key, label, icon: Icon, bg, iconColor }) => {
            const val = kpis?.[key as keyof typeof kpis] as any;
            return (
              <Card key={key} className="overflow-hidden">
                <CardContent className={`pt-4 pb-3 px-4 ${bg}`}>
                  {kpisLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`h-4 w-4 ${iconColor}`} />
                        <span className="text-xs text-muted-foreground truncate">{label}</span>
                      </div>
                      <p className="text-2xl font-bold">{val?.current ?? 0}</p>
                      {key === "assinados" && val?.vgv > 0 && (
                        <p className="text-xs text-emerald-600 font-medium">{formatBRLCompact(val.vgv)}</p>
                      )}
                      <Var current={val?.current ?? 0} prev={val?.prev ?? 0} />
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* SECTION 2 — Leads */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Entradas por Origem</CardTitle></CardHeader>
            <CardContent>
              {originLoading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={leadsOrigin} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
                    <RTooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {(leadsOrigin || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Leads por Empreendimento (Top 8)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {empLoading ? <Skeleton className="h-48 w-full" /> : (leadsEmp || []).map((emp, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="truncate max-w-[200px]">{emp.name}</span>
                    <span className="font-semibold">{emp.value}</span>
                  </div>
                  <Progress value={(emp.value / maxEmp) * 100} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* SECTION 3 — Funnel */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Funil da Semana</CardTitle></CardHeader>
          <CardContent>
            {funnelLoading ? <Skeleton className="h-48 w-full" /> : (
              <div className="space-y-2">
                {(funnel || []).map((stage, i) => {
                  const width = Math.max((stage.count / maxFunnel) * 100, 5);
                  const lowConversion = stage.conversionRate < 40 && i < (funnel?.length || 0) - 1;
                  return (
                    <div key={stage.id} className="flex items-center gap-3">
                      <span className="text-xs w-28 truncate text-muted-foreground">{stage.nome}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="h-6 rounded bg-primary/80 flex items-center justify-end px-2 transition-all" style={{ width: `${width}%` }}>
                          <span className="text-[10px] text-primary-foreground font-bold">{stage.count}</span>
                        </div>
                        {i < (funnel?.length || 0) - 1 && (
                          <span className={`text-[10px] font-medium ${lowConversion ? "text-destructive" : "text-muted-foreground"}`}>
                            → {stage.conversionRate}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECTION 4 — Visits */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Visitas da Semana</CardTitle></CardHeader>
          <CardContent>
            {visitsLoading ? <Skeleton className="h-48 w-full" /> : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-2">Dia</th>
                        <th className="text-center py-2 px-1">Marc.</th>
                        <th className="text-center py-2 px-1">Conf.</th>
                        <th className="text-center py-2 px-1">Realiz.</th>
                        <th className="text-center py-2 px-1">No Show</th>
                        <th className="text-center py-2 px-1">Cancel.</th>
                        <th className="text-center py-2 px-1">Taxa%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(visitDays || []).map((d, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 pr-2 capitalize font-medium">{d.dia}</td>
                          <td className="text-center">{d.marcadas}</td>
                          <td className="text-center">{d.confirmadas}</td>
                          <td className="text-center font-semibold">{d.realizadas}</td>
                          <td className="text-center text-destructive">{d.noShow}</td>
                          <td className="text-center text-muted-foreground">{d.canceladas}</td>
                          <td className={`text-center font-semibold ${d.taxa >= 60 ? "text-emerald-600" : d.taxa >= 40 ? "text-amber-500" : "text-destructive"}`}>{d.taxa}%</td>
                        </tr>
                      ))}
                      {totalVisits && (
                        <tr className="font-bold border-t-2">
                          <td className="py-1.5">Total</td>
                          <td className="text-center">{totalVisits.marcadas}</td>
                          <td className="text-center">{totalVisits.confirmadas}</td>
                          <td className="text-center">{totalVisits.realizadas}</td>
                          <td className="text-center">{totalVisits.noShow}</td>
                          <td className="text-center">{totalVisits.canceladas}</td>
                          <td className={`text-center ${totalTaxa >= 60 ? "text-emerald-600" : "text-amber-500"}`}>{totalTaxa}%</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {bestDay && (
                  <div className="mt-3 space-y-1 text-xs">
                    <p>🏆 <strong>Melhor dia:</strong> {bestDay.diaShort} com {bestDay.realizadas} visitas realizadas ({bestDay.taxa}%)</p>
                    {worstDay && <p>⚠️ <strong>Pior dia:</strong> {worstDay.diaShort} com {worstDay.taxa}% de realização</p>}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* SECTION 5 — Deals */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Negócios da Semana</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {dealsLoading ? <Skeleton className="h-32 w-full" /> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {(deals?.pipeline || []).map(p => {
                    const isGreen = ["assinado", "vendido"].includes(p.fase);
                    return (
                      <div key={p.fase} className={`rounded-lg p-3 text-center ${isGreen ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-muted/50"}`}>
                        <p className="text-xs text-muted-foreground capitalize">{p.fase}</p>
                        <p className="text-lg font-bold">{p.count}</p>
                        <p className={`text-[10px] font-medium ${isGreen ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {formatBRLCompact(p.vgv)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <h4 className="text-xs font-semibold mb-2">Assinados na Semana</h4>
                  {(deals?.assinados?.length || 0) > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-1.5">Cliente</th>
                            <th className="text-left py-1.5">Empreendimento</th>
                            <th className="text-right py-1.5">VGV</th>
                            <th className="text-left py-1.5">Corretor</th>
                            <th className="text-left py-1.5">Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deals!.assinados.map((d: any) => (
                            <tr key={d.id} className="border-b border-border/50">
                              <td className="py-1.5">{d.nome_cliente || "—"}</td>
                              <td className="py-1.5">{d.empreendimento || "—"}</td>
                              <td className="py-1.5 text-right font-semibold text-emerald-600">{formatBRLCompact(d.vgv_final || 0)}</td>
                              <td className="py-1.5">{d.corretor_nome}</td>
                              <td className="py-1.5">{d.data_assinatura ? format(new Date(d.data_assinatura), "dd/MM") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma assinatura ainda — a semana ainda não acabou! 💪</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* SECTION 6 — Rankings */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Melhores Desempenhos</CardTitle></CardHeader>
          <CardContent>
            {rankingsLoading ? <Skeleton className="h-48 w-full" /> : (
              <Tabs defaultValue="geral" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="equipe">Por Equipe</TabsTrigger>
                  <TabsTrigger value="corretor">Por Corretor</TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="mt-4 space-y-4">
                  {[
                    { title: "🏆 Prospecção OA", data: rankings?.topProspeccao, metric: (c: any) => `${c.aproveitados} aproveitados` },
                    { title: "🏆 Gestão de Leads", data: rankings?.topGestao, metric: (c: any) => `${c.avancos} avanços` },
                    { title: "🏆 Visitas", data: rankings?.topVisitas, metric: (c: any) => `${c.taxaVisitas}% taxa` },
                    { title: "🏆 Vendas", data: rankings?.topVendas, metric: (c: any) => formatBRLCompact(c.vgv) },
                  ].map(cat => (
                    <div key={cat.title}>
                      <p className="text-xs font-semibold mb-1">{cat.title}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(cat.data || []).map((c: any, i: number) => (
                          <div key={c.id} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                            <span className="text-sm font-bold text-muted-foreground">{i + 1}º</span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{c.nome}</p>
                              <p className="text-[10px] text-muted-foreground">{c.equipe} · {cat.metric(c)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="equipe" className="mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2">Equipe</th>
                          <th className="text-center py-2">Aproveit.</th>
                          <th className="text-center py-2">V. Realizadas</th>
                          <th className="text-center py-2">VGV</th>
                          <th className="text-center py-2">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rankings?.teams || []).map((t: any, i: number) => (
                          <tr key={t.equipe} className={`border-b border-border/50 ${i === 0 ? "bg-emerald-500/5" : ""}`}>
                            <td className="py-1.5 font-medium flex items-center gap-1">
                              {i === 0 && <span>🥇</span>}{t.equipe}
                            </td>
                            <td className="text-center">{t.aproveitados}</td>
                            <td className="text-center">{t.visitasRealizadas}</td>
                            <td className="text-center">{formatBRLCompact(t.vgv)}</td>
                            <td className="text-center font-semibold">{t.score.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="corretor" className="mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2">#</th>
                          <th className="text-left py-2">Nome</th>
                          <th className="text-left py-2">Equipe</th>
                          <th className="text-center py-2">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rankings?.top10 || []).map((c: any, i: number) => (
                          <tr key={c.id} className="border-b border-border/50">
                            <td className="py-1.5 font-bold text-muted-foreground">{i + 1}</td>
                            <td className="py-1.5 font-medium">{c.nome}</td>
                            <td className="py-1.5 text-muted-foreground">{c.equipe}</td>
                            <td className="text-center font-semibold">{c.score.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* SECTION 7 — AI Analysis */}
        <AIAnalysisSection week={week} />
      </div>
    </div>
  );
}
