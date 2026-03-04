import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUhomeIa } from "@/hooks/useUhomeIa";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, TrendingDown, Minus, Sparkles, Users } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";

type PeriodoTipo = "semanal" | "mensal";

function fmtCurrency(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number) {
  if (!isFinite(v) || isNaN(v)) return "—";
  return `${v.toFixed(1)}%`;
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

interface AggregatedData {
  leads: number;
  ligacoes: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  propostas: number;
  vgv_gerado: number;
  vgv_assinado: number;
  pdn_negocios: number;
  pdn_vgv: number;
  by_corretor: Record<string, {
    nome: string;
    leads: number;
    ligacoes: number;
    visitas_marcadas: number;
    visitas_realizadas: number;
    propostas: number;
    vgv_gerado: number;
    vgv_assinado: number;
  }>;
}

export default function FunilContent() {
  const { user } = useAuth();
  const { analyze, loading: iaLoading } = useUhomeIa();
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("semanal");
  const [refDate, setRefDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AggregatedData | null>(null);
  const [prevData, setPrevData] = useState<AggregatedData | null>(null);
  const [filterCorretor, setFilterCorretor] = useState("all");
  const [iaReport, setIaReport] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; nome: string }[]>([]);

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const d = new Date(refDate + "T12:00:00");
    if (periodoTipo === "semanal") {
      const s = startOfWeek(d, { weekStartsOn: 1 });
      const e = endOfWeek(d, { weekStartsOn: 1 });
      const ps = startOfWeek(subWeeks(d, 1), { weekStartsOn: 1 });
      const pe = endOfWeek(subWeeks(d, 1), { weekStartsOn: 1 });
      return { startDate: format(s, "yyyy-MM-dd"), endDate: format(e, "yyyy-MM-dd"), prevStartDate: format(ps, "yyyy-MM-dd"), prevEndDate: format(pe, "yyyy-MM-dd") };
    } else {
      const s = startOfMonth(d);
      const e = endOfMonth(d);
      const ps = startOfMonth(subMonths(d, 1));
      const pe = endOfMonth(subMonths(d, 1));
      return { startDate: format(s, "yyyy-MM-dd"), endDate: format(e, "yyyy-MM-dd"), prevStartDate: format(ps, "yyyy-MM-dd"), prevEndDate: format(pe, "yyyy-MM-dd") };
    }
  }, [periodoTipo, refDate]);

  const aggregateCheckpoint = useCallback(async (start: string, end: string): Promise<AggregatedData> => {
    if (!user) return { leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0, pdn_negocios: 0, pdn_vgv: 0, by_corretor: {} };

    const { data: cps } = await supabase.from("checkpoints").select("id, data").eq("gerente_id", user.id).gte("data", start).lte("data", end);
    const cpIds = (cps || []).map((c: any) => c.id);

    let lines: any[] = [];
    if (cpIds.length > 0) {
      const { data: linesData } = await supabase.from("checkpoint_lines").select("corretor_id, real_leads, real_ligacoes, real_visitas_marcadas, real_visitas_realizadas, real_propostas").in("checkpoint_id", cpIds);
      lines = linesData || [];
    }

    const { data: team } = await supabase.from("team_members").select("id, nome").eq("gerente_id", user.id);
    const teamMap = new Map((team || []).map((t: any) => [t.id, t.nome]));

    const by_corretor: AggregatedData["by_corretor"] = {};
    let totals = { leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };

    for (const l of lines) {
      const nome = teamMap.get(l.corretor_id) || "Desconhecido";
      if (!by_corretor[l.corretor_id]) {
        by_corretor[l.corretor_id] = { nome, leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };
      }
      const c = by_corretor[l.corretor_id];
      const vals = { leads: l.real_leads || 0, ligacoes: l.real_ligacoes || 0, visitas_marcadas: l.real_visitas_marcadas || 0, visitas_realizadas: l.real_visitas_realizadas || 0, propostas: l.real_propostas || 0 };
      for (const k of Object.keys(vals) as (keyof typeof vals)[]) { c[k] += vals[k]; totals[k] += vals[k]; }
    }

    const mesKey = `${start.slice(0, 7)}`;
    const { data: pdns } = await supabase.from("pdn_entries").select("id, vgv, situacao, corretor").eq("gerente_id", user.id).eq("mes", mesKey);

    const pdn_negocios = (pdns || []).length;
    const pdn_vgv = (pdns || []).reduce((sum: number, p: any) => sum + Number(p.vgv || 0), 0);
    const vgv_gerado = (pdns || []).filter((p: any) => p.situacao === "gerado").reduce((s: number, p: any) => s + Number(p.vgv || 0), 0);
    const vgv_assinado = (pdns || []).filter((p: any) => p.situacao === "assinado").reduce((s: number, p: any) => s + Number(p.vgv || 0), 0);
    totals.vgv_gerado = vgv_gerado;
    totals.vgv_assinado = vgv_assinado;

    for (const p of (pdns || [])) {
      if (!p.corretor || !p.vgv) continue;
      const match = Object.entries(by_corretor).find(([_, c]) => c.nome === p.corretor);
      if (match) {
        if (p.situacao === "gerado") match[1].vgv_gerado += Number(p.vgv);
        if (p.situacao === "assinado") match[1].vgv_assinado += Number(p.vgv);
      }
    }

    return { ...totals, pdn_negocios, pdn_vgv, by_corretor };
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [current, prev] = await Promise.all([aggregateCheckpoint(startDate, endDate), aggregateCheckpoint(prevStartDate, prevEndDate)]);
    setData(current);
    setPrevData(prev);
    if (user) {
      const { data: team } = await supabase.from("team_members").select("id, nome").eq("gerente_id", user.id).eq("status", "ativo").order("nome");
      setTeamMembers((team as any[]) || []);
    }
    setLoading(false);
  }, [aggregateCheckpoint, startDate, endDate, prevStartDate, prevEndDate, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleIaAnalysis = async () => {
    if (!data) return;
    const report = await analyze({
      module: "funil",
      prompt: `Analise o funil comercial do período ${startDate} a ${endDate}:\n\nDADOS DO CHECKPOINT:\n- Leads: ${data.leads}\n- Ligações: ${data.ligacoes}\n- Visitas Marcadas: ${data.visitas_marcadas}\n- Visitas Realizadas: ${data.visitas_realizadas}\n- Propostas: ${data.propostas}\n- VGV Gerado: R$ ${data.vgv_gerado}\n- VGV Assinado: R$ ${data.vgv_assinado}\n\nDADOS DO PDN:\n- Negócios ativos: ${data.pdn_negocios}\n- VGV potencial PDN: R$ ${data.pdn_vgv}\n\nPOR CORRETOR:\n${Object.values(data.by_corretor).map(c => `${c.nome}: ${c.leads} leads, ${c.ligacoes} lig, ${c.visitas_realizadas} vis, ${c.propostas} prop, VGV ger R$${c.vgv_gerado}, VGV ass R$${c.vgv_assinado}`).join("\n")}\n\n${prevData ? `PERÍODO ANTERIOR: Leads ${prevData.leads}, Propostas ${prevData.propostas}, VGV Gerado R$ ${prevData.vgv_gerado}` : ""}\n\nFaça análise de gargalos, taxas de conversão, destaque corretores com melhor e pior performance, e dê ações concretas.`,
      context: data,
    });
    setIaReport(report);
  };

  const displayData = useMemo(() => {
    if (!data) return null;
    if (filterCorretor === "all") return data;
    const c = data.by_corretor[filterCorretor];
    if (!c) return data;
    return { ...data, leads: c.leads, ligacoes: c.ligacoes, visitas_marcadas: c.visitas_marcadas, visitas_realizadas: c.visitas_realizadas, propostas: c.propostas, vgv_gerado: c.vgv_gerado, vgv_assinado: c.vgv_assinado };
  }, [data, filterCorretor]);

  const metrics = useMemo(() => {
    if (!displayData) return { taxaProposta: 0, taxaFechamento: 0 };
    const taxaProposta = displayData.leads > 0 ? (displayData.propostas / displayData.leads) * 100 : 0;
    const taxaFechamento = displayData.propostas > 0 ? (displayData.vgv_assinado / displayData.vgv_gerado) * 100 : 0;
    return { taxaProposta, taxaFechamento };
  }, [displayData]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const corretores = data ? Object.entries(data.by_corretor) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Select value={periodoTipo} onValueChange={(v) => setPeriodoTipo(v as PeriodoTipo)}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="w-40 h-9" />
          {corretores.length > 0 && (
            <Select value={filterCorretor} onValueChange={setFilterCorretor}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Filtrar corretor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {corretores.map(([id, c]) => <SelectItem key={id} value={id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="secondary" size="sm" onClick={handleIaAnalysis} disabled={iaLoading || !data} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            {iaLoading ? "Analisando..." : "Análise IA"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Período: <strong>{format(new Date(startDate + "T12:00:00"), "dd/MM/yyyy")} — {format(new Date(endDate + "T12:00:00"), "dd/MM/yyyy")}</strong>
      </p>

      {displayData && (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="corretores">Por Corretor</TabsTrigger>
            <TabsTrigger value="pdn">PDN</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "Leads", value: displayData.leads, prev: prevData?.leads },
                { label: "Ligações", value: displayData.ligacoes, prev: prevData?.ligacoes },
                { label: "V. Marcadas", value: displayData.visitas_marcadas, prev: prevData?.visitas_marcadas },
                { label: "V. Realizadas", value: displayData.visitas_realizadas, prev: prevData?.visitas_realizadas },
                { label: "Propostas", value: displayData.propostas, prev: prevData?.propostas },
                { label: "VGV Gerado", value: displayData.vgv_gerado, prev: prevData?.vgv_gerado, currency: true },
                { label: "VGV Assinado", value: displayData.vgv_assinado, prev: prevData?.vgv_assinado, currency: true },
              ].map((c) => (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Funil Visual</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="bg-primary/20 rounded-t-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">Leads</p>
                      <p className="text-lg font-bold">{displayData.leads}</p>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">↓ {fmtPct(metrics.taxaProposta)}</div>
                    <div className="bg-warning/20 p-3 text-center mx-4">
                      <p className="text-xs text-muted-foreground">Propostas</p>
                      <p className="text-lg font-bold">{displayData.propostas}</p>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">↓</div>
                    <div className="bg-success/20 rounded-b-lg p-3 text-center mx-8">
                      <p className="text-xs text-muted-foreground">VGV Assinado</p>
                      <p className="text-lg font-bold">{fmtCurrency(displayData.vgv_assinado)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Taxas de Conversão</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Lead → Proposta</span>
                    <span className="font-semibold">{fmtPct(metrics.taxaProposta)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">VGV Assinado / Gerado</span>
                    <span className="font-semibold">{fmtPct(metrics.taxaFechamento)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Visitas Realizadas / Marcadas</span>
                    <span className="font-semibold">{fmtPct(displayData.visitas_marcadas > 0 ? (displayData.visitas_realizadas / displayData.visitas_marcadas) * 100 : 0)}</span>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Negócios PDN</span>
                      <span className="font-semibold">{displayData.pdn_negocios}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm text-muted-foreground">VGV PDN (potencial)</span>
                      <span className="font-semibold">{fmtCurrency(displayData.pdn_vgv)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="corretores" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Performance por Corretor
                </CardTitle>
                <CardDescription>Dados agregados do checkpoint no período</CardDescription>
              </CardHeader>
              <CardContent>
                {corretores.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Sem dados de checkpoint no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Corretor</TableHead>
                          <TableHead className="text-xs text-right">Leads</TableHead>
                          <TableHead className="text-xs text-right">Ligações</TableHead>
                          <TableHead className="text-xs text-right">V. Marc</TableHead>
                          <TableHead className="text-xs text-right">V. Real</TableHead>
                          <TableHead className="text-xs text-right">Propostas</TableHead>
                          <TableHead className="text-xs text-right">VGV Ger.</TableHead>
                          <TableHead className="text-xs text-right">VGV Ass.</TableHead>
                          <TableHead className="text-xs text-right">Taxa L→P</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {corretores.map(([id, c]) => (
                          <TableRow key={id}>
                            <TableCell className="font-medium text-xs">{c.nome}</TableCell>
                            <TableCell className="text-right text-xs">{c.leads}</TableCell>
                            <TableCell className="text-right text-xs">{c.ligacoes}</TableCell>
                            <TableCell className="text-right text-xs">{c.visitas_marcadas}</TableCell>
                            <TableCell className="text-right text-xs">{c.visitas_realizadas}</TableCell>
                            <TableCell className="text-right text-xs">{c.propostas}</TableCell>
                            <TableCell className="text-right text-xs">{fmtCurrency(c.vgv_gerado)}</TableCell>
                            <TableCell className="text-right text-xs">{fmtCurrency(c.vgv_assinado)}</TableCell>
                            <TableCell className="text-right text-xs">{fmtPct(c.leads > 0 ? (c.propostas / c.leads) * 100 : 0)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell className="text-xs">TOTAL</TableCell>
                          <TableCell className="text-right text-xs">{data!.leads}</TableCell>
                          <TableCell className="text-right text-xs">{data!.ligacoes}</TableCell>
                          <TableCell className="text-right text-xs">{data!.visitas_marcadas}</TableCell>
                          <TableCell className="text-right text-xs">{data!.visitas_realizadas}</TableCell>
                          <TableCell className="text-right text-xs">{data!.propostas}</TableCell>
                          <TableCell className="text-right text-xs">{fmtCurrency(data!.vgv_gerado)}</TableCell>
                          <TableCell className="text-right text-xs">{fmtCurrency(data!.vgv_assinado)}</TableCell>
                          <TableCell className="text-right text-xs">{fmtPct(data!.leads > 0 ? (data!.propostas / data!.leads) * 100 : 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdn" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados do PDN</CardTitle>
                <CardDescription>Negócios em andamento no mês de referência</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-6 rounded-lg bg-primary/10">
                    <p className="text-3xl font-bold text-primary">{displayData.pdn_negocios}</p>
                    <p className="text-sm text-muted-foreground mt-1">Negócios ativos</p>
                  </div>
                  <div className="text-center p-6 rounded-lg bg-success/10">
                    <p className="text-3xl font-bold text-success">{fmtCurrency(displayData.pdn_vgv)}</p>
                    <p className="text-sm text-muted-foreground mt-1">VGV potencial</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {iaReport && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Análise do Funil Coach
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{iaReport}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
