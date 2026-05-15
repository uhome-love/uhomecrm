import { useState, useMemo, useCallback } from "react";
import { useCeoData, pct, type CeoPeriod, type GerenteAgg } from "@/hooks/useCeoData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// @ts-ignore - recharts type compatibility with @types/react
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { ChevronDown, ChevronRight, Users, Bot, Loader2, Trophy, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(142 76% 36%)",
  "hsl(45 93% 47%)",
  "hsl(280 67% 55%)",
];

import { formatBRLCompact } from "@/lib/utils";
const fmtCurrency = formatBRLCompact;

interface MetricRow {
  key: string;
  label: string;
  getValue: (g: GerenteAgg) => number;
  format?: (v: number) => string;
  meta?: number;
  higherIsBetter?: boolean;
}

const homiMascot = "/images/homi-mascot-opt.png";

export default function CeoTeamComparison() {
  const [period, setPeriod] = useState<CeoPeriod>("semana");
  const { gerentes, loading } = useCeoData(period);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const metrics: MetricRow[] = useMemo(() => [
    { key: "corretores", label: "Corretores ativos", getValue: g => g.corretores.length },
    { key: "ligacoes", label: "Ligações OA", getValue: g => g.totals.real_ligacoes, higherIsBetter: true },
    { key: "visitas_m", label: "Visitas marcadas", getValue: g => g.totals.real_visitas_marcadas, higherIsBetter: true },
    { key: "visitas_r", label: "Visitas realizadas", getValue: g => g.totals.real_visitas_realizadas, higherIsBetter: true },
    { key: "conv_visita", label: "Conv. lead→visita", getValue: g => g.totals.real_ligacoes > 0 ? Math.round((g.totals.real_visitas_marcadas / g.totals.real_ligacoes) * 100) : 0, format: v => `${v}%`, meta: 15, higherIsBetter: true },
    { key: "propostas", label: "Propostas", getValue: g => g.totals.real_propostas, higherIsBetter: true },
    { key: "vgv_gerado", label: "VGV Gerado", getValue: g => g.totals.real_vgv_gerado, format: fmtCurrency, higherIsBetter: true },
    { key: "vgv_assinado", label: "VGV Assinado", getValue: g => g.totals.real_vgv_assinado, format: fmtCurrency, higherIsBetter: true },
    { key: "atingimento", label: "Atingimento meta", getValue: g => g.totals.meta_vgv_assinado > 0 ? Math.round((g.totals.real_vgv_assinado / g.totals.meta_vgv_assinado) * 100) : 0, format: v => `${v}%`, meta: 100, higherIsBetter: true },
    { key: "score", label: "Score geral", getValue: g => g.totals.score, higherIsBetter: true },
  ], []);

  const getCellColor = useCallback((metric: MetricRow, value: number, allValues: number[]) => {
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
    if (metric.meta !== undefined) {
      if (value >= metric.meta) return "text-success font-bold";
      if (value < metric.meta * 0.5) return "text-destructive font-bold";
      return "text-foreground";
    }
    if (allValues.length <= 1) return "text-foreground";
    if (metric.higherIsBetter) {
      if (value === max && max > 0) return "text-primary font-bold";
      if (value === min && max > min) return "text-destructive";
    }
    return "text-foreground";
  }, []);

  // Radar chart data
  const radarData = useMemo(() => {
    if (gerentes.length === 0) return [];
    const radarMetrics = ["ligacoes", "visitas_m", "visitas_r", "propostas", "vgv_assinado", "score"];
    return radarMetrics.map(key => {
      const m = metrics.find(mm => mm.key === key)!;
      const values = gerentes.map(g => m.getValue(g));
      const maxVal = Math.max(...values, 1);
      const point: any = { metric: m.label };
      gerentes.forEach((g, i) => {
        point[g.gerente_nome] = Math.round((m.getValue(g) / maxVal) * 100);
      });
      return point;
    });
  }, [gerentes, metrics]);

  // Bar chart data for VGV
  const barData = useMemo(() => {
    return gerentes.map(g => ({
      name: g.gerente_nome.split(" ")[0],
      "VGV Gerado": g.totals.real_vgv_gerado,
      "VGV Assinado": g.totals.real_vgv_assinado,
    }));
  }, [gerentes]);

  const analyzeWithAI = async () => {
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const context = gerentes.map(g => ({
        gerente: g.gerente_nome,
        corretores: g.corretores.length,
        ligacoes: g.totals.real_ligacoes,
        visitas_marcadas: g.totals.real_visitas_marcadas,
        visitas_realizadas: g.totals.real_visitas_realizadas,
        propostas: g.totals.real_propostas,
        vgv_gerado: g.totals.real_vgv_gerado,
        vgv_assinado: g.totals.real_vgv_assinado,
        score: g.totals.score,
        meta_vgv: g.totals.meta_vgv_assinado,
      }));

      const resp = await supabase.functions.invoke("homi-ceo", {
        body: {
          action: "comparar_equipes",
          context: JSON.stringify(context),
          periodo: period,
        },
      });

      if (resp.error) throw resp.error;
      setAiAnalysis(resp.data?.resposta || resp.data?.response || "Análise indisponível no momento.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar análise. Tente novamente.");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando dados comparativos...</div>;
  }

  if (gerentes.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">Nenhum dado de equipe encontrado para o período.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4.5 w-4.5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Comparar Equipes</h2>
          <Badge variant="secondary" className="text-[10px]">{gerentes.length} equipes</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={v => setPeriod(v as CeoPeriod)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowCharts(!showCharts)}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {showCharts ? "Ocultar Gráficos" : "Ver Gráficos"}
          </Button>
        </div>
      </div>

      {/* Comparison Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider w-44">
                    Métrica
                  </th>
                  {gerentes.map((g, i) => (
                    <th key={g.gerente_id} className="text-center px-3 py-3 min-w-[120px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs font-bold text-foreground">{g.gerente_nome.split(" ")[0]}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{g.corretores.length} corretores</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, mi) => {
                  const values = gerentes.map(g => m.getValue(g));
                  return (
                    <tr key={m.key} className={`border-b border-border/50 ${mi % 2 === 0 ? "bg-card" : "bg-muted/10"}`}>
                      <td className="px-4 py-2.5 text-xs font-medium text-muted-foreground">{m.label}</td>
                      {gerentes.map((g, i) => {
                        const val = m.getValue(g);
                        const formatted = m.format ? m.format(val) : val.toLocaleString("pt-BR");
                        const color = getCellColor(m, val, values);
                        return (
                          <td key={g.gerente_id} className={`text-center px-3 py-2.5 text-xs ${color}`}>
                            {formatted}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Drill-down per team */}
      <div className="space-y-2">
        {gerentes.map(g => (
          <Collapsible
            key={g.gerente_id}
            open={expandedTeam === g.gerente_id}
            onOpenChange={open => setExpandedTeam(open ? g.gerente_id : null)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between h-10 text-xs font-semibold"
              >
                <span className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  Equipe {g.gerente_nome} ({g.corretores.length} corretores)
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{g.totals.score} pts</Badge>
                  {expandedTeam === g.gerente_id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card className="mt-1 border-primary/10">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left px-3 py-2 font-bold text-muted-foreground">Corretor</th>
                              <th className="text-center px-2 py-2 font-bold text-muted-foreground">Ligações</th>
                              <th className="text-center px-2 py-2 font-bold text-muted-foreground">Vis. Marc.</th>
                              <th className="text-center px-2 py-2 font-bold text-muted-foreground">Vis. Real.</th>
                              <th className="text-center px-2 py-2 font-bold text-muted-foreground">Propostas</th>
                              <th className="text-center px-2 py-2 font-bold text-muted-foreground">VGV Gerado</th>
                              <th className="text-center px-2 py-2 font-bold text-muted-foreground">VGV Assinado</th>
                              <th className="text-center px-2 py-2 font-bold text-muted-foreground">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.corretores.sort((a, b) => b.score - a.score).map((c, ci) => (
                              <tr key={c.corretor_id} className={`border-b border-border/30 ${ci % 2 === 0 ? "" : "bg-muted/10"}`}>
                                <td className="px-3 py-2 font-medium text-foreground flex items-center gap-1.5">
                                  {ci === 0 && <Trophy className="h-3 w-3 text-primary" />}
                                  {c.corretor_nome}
                                </td>
                                <td className="text-center px-2 py-2">{c.real_ligacoes}</td>
                                <td className="text-center px-2 py-2">{c.real_visitas_marcadas}</td>
                                <td className="text-center px-2 py-2">{c.real_visitas_realizadas}</td>
                                <td className="text-center px-2 py-2">{c.real_propostas}</td>
                                <td className="text-center px-2 py-2">{fmtCurrency(c.real_vgv_gerado)}</td>
                                <td className="text-center px-2 py-2">{fmtCurrency(c.real_vgv_assinado)}</td>
                                <td className="text-center px-2 py-2 font-bold">{c.score}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </AnimatePresence>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* Charts */}
      <AnimatePresence>
        {showCharts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {/* Radar Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Radar de Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                    {gerentes.map((g, i) => (
                      <Radar
                        key={g.gerente_id}
                        name={g.gerente_nome.split(" ")[0]}
                        dataKey={g.gerente_nome}
                        stroke={COLORS[i % COLORS.length]}
                        fill={COLORS[i % COLORS.length]}
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bar Chart - VGV */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">VGV por Equipe</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => fmtCurrency(v)} />
                    <Tooltip
                      formatter={(value: number) => fmtCurrency(value)}
                      contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="VGV Gerado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="VGV Assinado" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Analysis */}
      <Card className="border-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <img src={homiMascot} alt="Homi" className="h-6 w-6 object-contain" />
              <span className="text-sm font-bold text-foreground">Análise HOMI CEO</span>
            </div>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={analyzeWithAI}
              disabled={aiLoading}
            >
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
              {aiLoading ? "Analisando..." : "Analisar com HOMI CEO"}
            </Button>
          </div>
          {aiAnalysis ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-muted/30 rounded-lg p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap"
            >
              {aiAnalysis}
            </motion.div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Clique em "Analisar" para receber insights sobre o desempenho comparativo das equipes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
