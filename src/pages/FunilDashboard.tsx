import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Copy, Sparkles, TrendingUp, TrendingDown, Minus, BarChart3, History } from "lucide-react";
import ReactMarkdown from "react-markdown";

type FunnelEntry = {
  id: string;
  gerente_id: string;
  periodo_tipo: string;
  periodo_inicio: string;
  periodo_fim: string;
  leads_gerados: number;
  propostas_geradas: number;
  vendas_fechadas: number;
  vgv_vendido: number;
  investimento_midia: number;
  custo_medio_lead: number;
  observacoes: string | null;
  taxa_proposta: number;
  taxa_venda: number;
  taxa_fechamento: number;
  cpl_real: number;
  cac_estimado: number;
  analise_ia: string | null;
  created_at: string;
};

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

function TrendIcon({ current, previous }: { current: number; previous: number }) {
  if (current > previous) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (current < previous) return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function variacao(atual: number, anterior: number) {
  if (anterior === 0) return atual > 0 ? "+∞%" : "—";
  const pct = ((atual - anterior) / anterior * 100).toFixed(1);
  return `${Number(pct) > 0 ? "+" : ""}${pct}%`;
}

export default function FunilDashboard() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [tab, setTab] = useState("checkin");
  const [periodoTipo, setPeriodoTipo] = useState("diario");
  const [periodoInicio, setPeriodoInicio] = useState(new Date().toISOString().split("T")[0]);
  const [periodoFim, setPeriodoFim] = useState(new Date().toISOString().split("T")[0]);
  const [leadsGerados, setLeadsGerados] = useState(0);
  const [propostasGeradas, setPropostasGeradas] = useState(0);
  const [vendasFechadas, setVendasFechadas] = useState(0);
  const [vgvVendido, setVgvVendido] = useState(0);
  const [investimentoMidia, setInvestimentoMidia] = useState(0);
  const [custoMedioLead, setCustoMedioLead] = useState(25);
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [entries, setEntries] = useState<FunnelEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [currentAnalysis, setCurrentAnalysis] = useState<string | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  // Auto-set period dates
  useEffect(() => {
    if (periodoTipo === "diario") {
      setPeriodoFim(periodoInicio);
    } else if (periodoTipo === "semanal") {
      const { start, end } = getWeekRange(new Date(periodoInicio + "T12:00:00"));
      setPeriodoInicio(start);
      setPeriodoFim(end);
    } else if (periodoTipo === "mensal") {
      const d = new Date(periodoInicio + "T12:00:00");
      const { start, end } = getMonthRange(d.getFullYear(), d.getMonth());
      setPeriodoInicio(start);
      setPeriodoFim(end);
    }
  }, [periodoTipo, periodoInicio]);

  // Load entries
  const loadEntries = useCallback(async () => {
    if (!user) return;
    setLoadingEntries(true);
    const { data } = await supabase
      .from("funnel_entries")
      .select("*")
      .order("periodo_inicio", { ascending: false })
      .limit(50);
    setEntries((data as FunnelEntry[]) || []);
    setLoadingEntries(false);
  }, [user]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Previous entry for comparison
  const previousEntry = useMemo(() => {
    if (entries.length < 2) return null;
    // Find entry before current period
    return entries.find(e => e.periodo_fim < periodoInicio) || null;
  }, [entries, periodoInicio]);

  // Calculated metrics
  const metrics = useMemo(() => {
    const taxaProposta = leadsGerados > 0 ? ((propostasGeradas / leadsGerados) * 100) : 0;
    const taxaVenda = leadsGerados > 0 ? ((vendasFechadas / leadsGerados) * 100) : 0;
    const taxaFechamento = propostasGeradas > 0 ? ((vendasFechadas / propostasGeradas) * 100) : 0;
    const cplReal = leadsGerados > 0 ? investimentoMidia / leadsGerados : 0;
    const cacEstimado = vendasFechadas > 0 ? investimentoMidia / vendasFechadas : 0;
    const leadsEstimados = custoMedioLead > 0 ? Math.floor(investimentoMidia / custoMedioLead) : 0;
    const invPorProposta = propostasGeradas > 0 ? investimentoMidia / propostasGeradas : 0;
    return { taxaProposta, taxaVenda, taxaFechamento, cplReal, cacEstimado, leadsEstimados, invPorProposta };
  }, [leadsGerados, propostasGeradas, vendasFechadas, investimentoMidia, custoMedioLead]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        gerente_id: user.id,
        periodo_tipo: periodoTipo,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        leads_gerados: leadsGerados,
        propostas_geradas: propostasGeradas,
        vendas_fechadas: vendasFechadas,
        vgv_vendido: vgvVendido,
        investimento_midia: investimentoMidia,
        custo_medio_lead: custoMedioLead,
        observacoes: observacoes || null,
      };

      if (currentEntryId) {
        const { error } = await supabase.from("funnel_entries").update(payload).eq("id", currentEntryId);
        if (error) throw error;
        toast.success("Registro atualizado!");
      } else {
        const { data, error } = await supabase.from("funnel_entries").insert(payload).select().single();
        if (error) throw error;
        setCurrentEntryId(data.id);
        toast.success("Registro salvo!");
      }
      await loadEntries();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally { setSaving(false); }
  }, [user, periodoTipo, periodoInicio, periodoFim, leadsGerados, propostasGeradas, vendasFechadas, vgvVendido, investimentoMidia, custoMedioLead, observacoes, currentEntryId, loadEntries]);

  const handleDuplicate = useCallback(() => {
    if (entries.length === 0) { toast.warning("Sem registros anteriores."); return; }
    const prev = entries[0];
    setLeadsGerados(prev.leads_gerados);
    setPropostasGeradas(prev.propostas_geradas);
    setVendasFechadas(prev.vendas_fechadas);
    setVgvVendido(prev.vgv_vendido);
    setInvestimentoMidia(prev.investimento_midia);
    setCustoMedioLead(prev.custo_medio_lead);
    setObservacoes("");
    setCurrentEntryId(null);
    toast.info("Dados do período anterior duplicados. Ajuste e salve.");
  }, [entries]);

  const handleAnalyze = useCallback(async () => {
    if (leadsGerados === 0 && propostasGeradas === 0) {
      toast.warning("Preencha ao menos leads ou propostas.");
      return;
    }
    // Save first if needed
    if (!currentEntryId) await handleSave();

    setAnalyzing(true);
    try {
      const entryData = {
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        leads_gerados: leadsGerados,
        propostas_geradas: propostasGeradas,
        vendas_fechadas: vendasFechadas,
        vgv_vendido: vgvVendido,
        investimento_midia: investimentoMidia,
        custo_medio_lead: custoMedioLead,
        observacoes,
      };

      const { data, error } = await supabase.functions.invoke("funnel-coach", {
        body: { entry: entryData, previousEntry },
      });
      if (error) throw error;
      const analysis = data.analysis;
      setCurrentAnalysis(analysis);

      // Save analysis to entry
      if (currentEntryId) {
        await supabase.from("funnel_entries").update({ analise_ia: analysis }).eq("id", currentEntryId);
      }
      await loadEntries();
      toast.success("Análise gerada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar análise.");
    } finally { setAnalyzing(false); }
  }, [leadsGerados, propostasGeradas, vendasFechadas, vgvVendido, investimentoMidia, custoMedioLead, observacoes, periodoInicio, periodoFim, previousEntry, currentEntryId, handleSave, loadEntries]);

  const loadEntry = useCallback((entry: FunnelEntry) => {
    setPeriodoTipo(entry.periodo_tipo);
    setPeriodoInicio(entry.periodo_inicio);
    setPeriodoFim(entry.periodo_fim);
    setLeadsGerados(entry.leads_gerados);
    setPropostasGeradas(entry.propostas_geradas);
    setVendasFechadas(entry.vendas_fechadas);
    setVgvVendido(entry.vgv_vendido);
    setInvestimentoMidia(entry.investimento_midia);
    setCustoMedioLead(entry.custo_medio_lead);
    setObservacoes(entry.observacoes || "");
    setCurrentAnalysis(entry.analise_ia || null);
    setCurrentEntryId(entry.id);
    setTab("checkin");
  }, []);

  const fmtCurrency = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Funil <span className="text-primary">Leads → Propostas → Vendas</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Painel macro de gestão do funil comercial
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="checkin" className="gap-1.5 text-xs py-2">
            <Save className="h-3.5 w-3.5" /> Check-in
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs py-2">
            <BarChart3 className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs py-2">
            <History className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ===== CHECK-IN TAB ===== */}
        <TabsContent value="checkin" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Registro do Funil</CardTitle>
                <CardDescription>Preencha os dados macro do período</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Period selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Tipo de período</Label>
                    <Select value={periodoTipo} onValueChange={setPeriodoTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diario">Diário</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="customizado">Customizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data início</Label>
                    <Input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data fim</Label>
                    <Input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} disabled={periodoTipo !== "customizado"} />
                  </div>
                </div>

                {/* Main fields */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Leads gerados</Label>
                    <Input type="number" min={0} value={leadsGerados} onChange={e => setLeadsGerados(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Propostas geradas</Label>
                    <Input type="number" min={0} value={propostasGeradas} onChange={e => setPropostasGeradas(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Vendas fechadas</Label>
                    <Input type="number" min={0} value={vendasFechadas} onChange={e => setVendasFechadas(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>VGV vendido (R$)</Label>
                    <Input type="number" min={0} value={vgvVendido} onChange={e => setVgvVendido(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Investimento mídia (R$)</Label>
                    <Input type="number" min={0} value={investimentoMidia} onChange={e => setInvestimentoMidia(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>CPL médio (R$)</Label>
                    <Input type="number" min={0} value={custoMedioLead} onChange={e => setCustoMedioLead(Number(e.target.value))} />
                  </div>
                </div>

                <div>
                  <Label>Observações do gerente</Label>
                  <Textarea placeholder="Ex.: campanha pausada, time com faltas, evento especial..." value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {currentEntryId ? "Atualizar" : "Salvar"}
                  </Button>
                  <Button variant="outline" onClick={handleDuplicate} className="gap-1.5">
                    <Copy className="h-4 w-4" /> Duplicar anterior
                  </Button>
                  <Button variant="secondary" onClick={handleAnalyze} disabled={analyzing} className="gap-1.5">
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {analyzing ? "Analisando..." : "Gerar análise com IA"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setCurrentEntryId(null); setLeadsGerados(0); setPropostasGeradas(0); setVendasFechadas(0); setVgvVendido(0); setInvestimentoMidia(0); setCustoMedioLead(25); setObservacoes(""); setCurrentAnalysis(null); }}>
                    Novo registro
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Live metrics sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Taxas do Funil</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Lead → Proposta</span><span className="font-semibold">{fmtPct(metrics.taxaProposta)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Lead → Venda</span><span className="font-semibold">{fmtPct(metrics.taxaVenda)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Proposta → Venda</span><span className="font-semibold">{fmtPct(metrics.taxaFechamento)}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Métricas Financeiras</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">CPL real</span><span className="font-semibold">{metrics.cplReal > 0 ? fmtCurrency(metrics.cplReal) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">CAC estimado</span><span className="font-semibold">{metrics.cacEstimado > 0 ? fmtCurrency(metrics.cacEstimado) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Inv/Proposta</span><span className="font-semibold">{metrics.invPorProposta > 0 ? fmtCurrency(metrics.invPorProposta) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Leads estimados</span><span className="font-semibold">{metrics.leadsEstimados}</span></div>
                </CardContent>
              </Card>

              {/* Funnel visual */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Funil Visual</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="bg-primary/20 rounded-t-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">Leads</p>
                      <p className="text-lg font-bold text-foreground">{leadsGerados}</p>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">↓ {fmtPct(metrics.taxaProposta)}</div>
                    <div className="bg-warning/20 p-3 text-center mx-4">
                      <p className="text-xs text-muted-foreground">Propostas</p>
                      <p className="text-lg font-bold text-foreground">{propostasGeradas}</p>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">↓ {fmtPct(metrics.taxaFechamento)}</div>
                    <div className="bg-emerald-500/20 rounded-b-lg p-3 text-center mx-8">
                      <p className="text-xs text-muted-foreground">Vendas</p>
                      <p className="text-lg font-bold text-foreground">{vendasFechadas}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* AI Analysis */}
          {currentAnalysis && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Análise do Funil Coach
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{currentAnalysis}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* ===== DASHBOARD TAB ===== */}
        <TabsContent value="dashboard" className="mt-4 space-y-6">
          {entries.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum registro ainda. Faça seu primeiro check-in!</CardContent></Card>
          ) : (
            <>
              {/* Latest entry cards */}
              {(() => {
                const latest = entries[0];
                const prev = entries[1] || null;
                const cards = [
                  { label: "Leads", value: latest.leads_gerados, prev: prev?.leads_gerados },
                  { label: "Propostas", value: latest.propostas_geradas, prev: prev?.propostas_geradas },
                  { label: "Vendas", value: latest.vendas_fechadas, prev: prev?.vendas_fechadas },
                  { label: "VGV", value: latest.vgv_vendido, prev: prev?.vgv_vendido, currency: true },
                  { label: "Investimento", value: latest.investimento_midia, prev: prev?.investimento_midia, currency: true },
                  { label: "CPL Real", value: latest.cpl_real, prev: prev?.cpl_real, currency: true },
                  { label: "CAC Estimado", value: latest.cac_estimado, prev: prev?.cac_estimado, currency: true },
                ];
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {cards.map(c => (
                      <Card key={c.label}>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">{c.label}</p>
                          <p className="text-lg font-bold">{c.currency ? fmtCurrency(c.value) : c.value}</p>
                          {c.prev !== undefined && c.prev !== null && (
                            <div className="flex items-center gap-1 mt-1">
                              <TrendIcon current={c.value} previous={c.prev} />
                              <span className="text-xs text-muted-foreground">{variacao(c.value, c.prev)}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}

              {/* Comparison table */}
              {entries.length >= 2 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Comparativo: Último vs Anterior</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Métrica</th>
                            <th className="text-right py-2 font-medium">Anterior</th>
                            <th className="text-right py-2 font-medium">Atual</th>
                            <th className="text-right py-2 font-medium">Variação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: "Leads", k: "leads_gerados" },
                            { label: "Propostas", k: "propostas_geradas" },
                            { label: "Vendas", k: "vendas_fechadas" },
                            { label: "VGV", k: "vgv_vendido", currency: true },
                            { label: "Investimento", k: "investimento_midia", currency: true },
                            { label: "Taxa Proposta", k: "taxa_proposta", pct: true },
                            { label: "Taxa Fechamento", k: "taxa_fechamento", pct: true },
                          ].map(row => {
                            const atual = (entries[0] as any)[row.k] ?? 0;
                            const anterior = (entries[1] as any)[row.k] ?? 0;
                            return (
                              <tr key={row.k} className="border-b last:border-0">
                                <td className="py-2">{row.label}</td>
                                <td className="text-right">{row.currency ? fmtCurrency(anterior) : row.pct ? fmtPct(anterior) : anterior}</td>
                                <td className="text-right font-semibold">{row.currency ? fmtCurrency(atual) : row.pct ? fmtPct(atual) : atual}</td>
                                <td className="text-right">
                                  <span className="flex items-center justify-end gap-1">
                                    <TrendIcon current={atual} previous={anterior} />
                                    {variacao(atual, anterior)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Funnel visual from latest */}
              <Card>
                <CardHeader><CardTitle className="text-base">Funil do Último Período</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center gap-2">
                    <div className="bg-primary/20 rounded-lg p-4 text-center min-w-[100px]">
                      <p className="text-xs text-muted-foreground">Leads</p>
                      <p className="text-2xl font-bold">{entries[0].leads_gerados}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-muted-foreground">→ {fmtPct(entries[0].taxa_proposta)}</span>
                    </div>
                    <div className="bg-warning/20 rounded-lg p-4 text-center min-w-[100px]">
                      <p className="text-xs text-muted-foreground">Propostas</p>
                      <p className="text-2xl font-bold">{entries[0].propostas_geradas}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-muted-foreground">→ {fmtPct(entries[0].taxa_fechamento)}</span>
                    </div>
                    <div className="bg-emerald-500/20 rounded-lg p-4 text-center min-w-[100px]">
                      <p className="text-xs text-muted-foreground">Vendas</p>
                      <p className="text-2xl font-bold">{entries[0].vendas_fechadas}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== HISTÓRICO TAB ===== */}
        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico do Funil</CardTitle>
              <CardDescription>Todos os registros salvos</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEntries ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : entries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Período</th>
                        <th className="text-right py-2 font-medium">Leads</th>
                        <th className="text-right py-2 font-medium">Propostas</th>
                        <th className="text-right py-2 font-medium">Vendas</th>
                        <th className="text-right py-2 font-medium">VGV</th>
                        <th className="text-right py-2 font-medium">Invest.</th>
                        <th className="text-right py-2 font-medium">CPL</th>
                        <th className="text-right py-2 font-medium">CAC</th>
                        <th className="text-center py-2 font-medium">IA</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(e => (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => loadEntry(e)}>
                          <td className="py-2">
                            <span className="text-xs uppercase text-muted-foreground">{e.periodo_tipo}</span><br />
                            <span className="text-xs">{e.periodo_inicio} → {e.periodo_fim}</span>
                          </td>
                          <td className="text-right">{e.leads_gerados}</td>
                          <td className="text-right">{e.propostas_geradas}</td>
                          <td className="text-right">{e.vendas_fechadas}</td>
                          <td className="text-right">{fmtCurrency(e.vgv_vendido)}</td>
                          <td className="text-right">{fmtCurrency(e.investimento_midia)}</td>
                          <td className="text-right">{fmtCurrency(e.cpl_real)}</td>
                          <td className="text-right">{fmtCurrency(e.cac_estimado)}</td>
                          <td className="text-center">{e.analise_ia ? "✅" : "—"}</td>
                          <td><Button size="sm" variant="ghost" className="text-xs">Abrir</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
