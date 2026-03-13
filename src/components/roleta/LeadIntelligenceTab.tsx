import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, TrendingUp, Users, Target, BarChart3, Brain, Clock, Building2, Megaphone, FileText, Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useLeadIntelligence } from "@/hooks/useLeadIntelligence";
import LeadInsightsAI from "./LeadInsightsAI";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#8b5cf6", "#f59e0b", "#06b6d4"];

function KpiCard({ icon: Icon, label, value, suffix, color }: { icon: any; label: string; value: number | string; suffix?: string; color?: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${color || "bg-primary/10"}`}>
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}{suffix}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h, i) => (
              <th key={i} className={`py-2 px-3 font-semibold text-muted-foreground ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`py-2 px-3 ${j === 0 ? "text-left font-medium" : "text-right"}`}>
                  {typeof cell === "number" && j > 0 && headers[j]?.includes("Taxa") ? (
                    <Badge variant={cell >= 50 ? "default" : cell >= 25 ? "secondary" : "outline"} className="text-[10px]">{cell}%</Badge>
                  ) : cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="py-6 text-center text-muted-foreground">Sem dados para o período</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function LeadIntelligenceTab() {
  const [periodo, setPeriodo] = useState("30d");
  const { loading, kpis, campanhas, formularios, segmentoPerf, corretorPerf, origemPerf, empreendimentoPerf, hourlyData, reload } = useLeadIntelligence(periodo);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando inteligência...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Central de Inteligência de Leads</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="mes">Mês atual</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={reload} className="h-8 gap-1 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={TrendingUp} label="Leads hoje" value={kpis.leadsHoje} />
        <KpiCard icon={Users} label="Leads no período" value={kpis.leadsMes} />
        <KpiCard icon={Target} label="Taxa de contato" value={kpis.taxaContato} suffix="%" color="bg-blue-500/10" />
        <KpiCard icon={Building2} label="Taxa de visita" value={kpis.taxaVisita} suffix="%" color="bg-amber-500/10" />
        <KpiCard icon={BarChart3} label="Taxa de venda" value={kpis.taxaVenda} suffix="%" color="bg-emerald-500/10" />
      </div>

      {/* Performance por campanha + formulário */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><Megaphone className="h-4 w-4" /> Performance por Campanha</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <DataTable
                headers={["Campanha", "Leads", "Taxa Contato", "Visitas", "Vendas"]}
                rows={campanhas.slice(0, 20).map(c => [c.campanha, c.leads, c.taxaContato, c.visitas, c.vendas])}
              />
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><FileText className="h-4 w-4" /> Performance por Formulário</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <DataTable
                headers={["Formulário", "Leads", "Taxa Contato", "Visitas", "Vendas"]}
                rows={formularios.slice(0, 15).map(f => [f.campanha, f.leads, f.taxaContato, f.visitas, f.vendas])}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Segmento + Corretor */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><Layers className="h-4 w-4" /> Performance por Segmento</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["Segmento", "Leads", "Taxa Contato", "Visitas", "Vendas"]}
              rows={segmentoPerf.map(s => [s.segmento, s.leads, s.taxaContato, s.visitas, s.vendas])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><Users className="h-4 w-4" /> Ranking por Corretor</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <DataTable
                headers={["Corretor", "Leads", "Taxa Contato", "Visitas"]}
                rows={corretorPerf.slice(0, 20).map((c, i) => [`${i + 1}. ${c.nome}`, c.leadsRecebidos, c.taxaContato, c.visitas])}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos: Origem + Horário */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><BarChart3 className="h-4 w-4" /> Origem dos Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {origemPerf.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={origemPerf.slice(0, 8)}
                    dataKey="count"
                    nameKey="origem"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ origem, percent }) => `${origem} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {origemPerf.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, "Leads"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8 text-sm">Sem dados de origem</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><Clock className="h-4 w-4" /> Leads por Horário</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyData.filter(h => h.hour >= 6 && h.hour <= 23)}>
                <XAxis dataKey="hour" tickFormatter={(h: number) => `${h}h`} fontSize={10} />
                <YAxis fontSize={10} allowDecimals={false} />
                <Tooltip labelFormatter={(h: number) => `${h}:00 - ${h}:59`} formatter={(v: number) => [v, "Leads"]} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ranking empreendimentos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Building2 className="h-4 w-4" /> Ranking de Empreendimentos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, empreendimentoPerf.length * 30)}>
            <BarChart data={empreendimentoPerf} layout="vertical" margin={{ left: 120 }}>
              <XAxis type="number" fontSize={10} allowDecimals={false} />
              <YAxis type="category" dataKey="empreendimento" fontSize={10} width={110} />
              <Tooltip formatter={(v: number) => [v, "Leads"]} />
              <Bar dataKey="leads" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <LeadInsightsAI
        kpis={kpis}
        campanhas={campanhas}
        formularios={formularios}
        segmentoPerf={segmentoPerf}
        corretorPerf={corretorPerf}
        periodo={periodo}
      />
    </div>
  );
}
