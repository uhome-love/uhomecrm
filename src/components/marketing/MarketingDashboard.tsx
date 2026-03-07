import { useState, useRef } from "react";
import { useMarketing, getCanalLabel } from "@/hooks/useMarketing";
import { useMetaAdsSync } from "@/hooks/useMetaAdsSync";
import IaCoreAction from "@/components/IaCoreAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, TrendingUp, DollarSign, Users, MousePointerClick, BarChart3, Trophy, Trash2, Plus, FileDown, Loader2, RefreshCw, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const CANAL_COLORS: Record<string, string> = {
  meta_ads: "#3b82f6",
  tiktok_ads: "#06b6d4",
  portal_zap: "#f59e0b",
  portal_imovelweb: "#ef4444",
  portal_vivareal: "#8b5cf6",
  site_uhome: "#10b981",
  google_ads: "#f97316",
  outros: "#6b7280",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function formatNum(v: number) {
  return v.toLocaleString("pt-BR");
}

export default function MarketingDashboard() {
  const {
    entries, reports, loading, importing, channelStats, totals,
    importReport, addManualEntry, updateEntry, deleteEntry, deleteReport, reload,
  } = useMarketing();
  const { syncing, syncNow } = useMetaAdsSync();

  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    let csvData = "";

    if (ext === "csv") {
      csvData = await file.text();
    } else if (ext === "xlsx" || ext === "xls") {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      csvData = XLSX.utils.sheet_to_csv(ws);
    } else if (ext === "pdf") {
      toast.error("Para PDFs, copie os dados e cole em CSV. Upload direto de PDF será suportado em breve.");
      return;
    } else {
      toast.error("Formato não suportado. Use CSV ou XLSX.");
      return;
    }

    await importReport(csvData, file.name);
    if (fileRef.current) fileRef.current.value = "";
  };

  const cplTotal = totals.leads > 0 ? totals.investimento / totals.leads : 0;
  const cpcTotal = totals.cliques > 0 ? totals.investimento / totals.cliques : 0;
  const vgvPerReal = totals.investimento > 0
    ? channelStats.reduce((s, c) => s + (c.vendas || 0), 0) // placeholder — will be VGV when available
    : 0;

  const chartData = channelStats.map(s => ({
    name: getCanalLabel(s.canal),
    investimento: s.investimento,
    leads: s.leads,
    cpl: s.cpl ? Math.round(s.cpl) : 0,
    fill: CANAL_COLORS[s.canal] || "#6b7280",
  }));

  const pieData = channelStats.filter(s => s.leads > 0).map(s => ({
    name: getCanalLabel(s.canal),
    value: s.leads,
    fill: CANAL_COLORS[s.canal] || "#6b7280",
  }));

  const iaContext = {
    totals,
    cpl_medio: Math.round(cplTotal),
    canais: channelStats.map(s => ({
      canal: getCanalLabel(s.canal),
      investimento: s.investimento,
      leads: s.leads,
      cpl: s.cpl ? Math.round(s.cpl) : null,
      visitas: s.visitas,
      propostas: s.propostas,
      vendas: s.vendas,
      custo_venda: s.custoVenda ? Math.round(s.custoVenda) : null,
    })),
    campanhas: entries.slice(0, 50).map(e => ({
      campanha: e.campanha,
      canal: getCanalLabel(e.canal),
      investimento: e.investimento,
      leads: e.leads_gerados,
      cpl: e.cpl ? Math.round(e.cpl) : null,
    })),
  };

  const handleExportPdf = () => {
    const html = `<html><head><title>Inteligência de Marketing</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        h1 { font-size: 20px; } h2 { font-size: 14px; color: #666; }
        .stats { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
        .stat { border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; min-width: 120px; }
        .stat b { display: block; font-size: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
        th { background: #f5f5f5; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>📊 Inteligência de Marketing — Uhome</h1>
      <h2>${entries.length} registros · ${channelStats.length} canais</h2>
      <div class="stats">
        <div class="stat"><b>${formatBRL(totals.investimento)}</b>Investido</div>
        <div class="stat"><b>${formatNum(totals.leads)}</b>Leads</div>
        <div class="stat"><b>${formatBRL(cplTotal)}</b>CPL Médio</div>
        <div class="stat"><b>${formatNum(totals.vendas)}</b>Vendas</div>
      </div>
      <h2>Performance por Canal</h2>
      <table>
        <thead><tr><th>Canal</th><th>Investimento</th><th>Leads</th><th>CPL</th><th>CPC</th><th>Visitas</th><th>Vendas</th><th>Custo/Venda</th></tr></thead>
        <tbody>${channelStats.map(s => `<tr>
          <td>${getCanalLabel(s.canal)}</td>
          <td>${formatBRL(s.investimento)}</td>
          <td>${s.leads}</td>
          <td>${s.cpl ? formatBRL(s.cpl) : "—"}</td>
          <td>${s.cpc ? formatBRL(s.cpc) : "—"}</td>
          <td>${s.visitas}</td>
          <td>${s.vendas}</td>
          <td>${s.custoVenda ? formatBRL(s.custoVenda) : "—"}</td>
        </tr>`).join("")}</tbody>
      </table>
      <h2>Detalhamento por Campanha</h2>
      <table>
        <thead><tr><th>Campanha</th><th>Canal</th><th>Empreend.</th><th>Investimento</th><th>Leads</th><th>CPL</th></tr></thead>
        <tbody>${entries.slice(0, 100).map(e => `<tr>
          <td>${e.campanha || "—"}</td>
          <td>${getCanalLabel(e.canal)}</td>
          <td>${e.empreendimento || "—"}</td>
          <td>${formatBRL(e.investimento)}</td>
          <td>${e.leads_gerados}</td>
          <td>${e.cpl ? formatBRL(e.cpl) : "—"}</td>
        </tr>`).join("")}</tbody>
      </table>
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando dados de marketing...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Inteligência de Marketing
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Análise de campanhas, portais e canais de marketing</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={async () => { await syncNow(); reload(); }}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Sincronizando..." : "Sincronizar Meta Ads"}
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importando..." : "Importar Relatório"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExportPdf}>
            <FileDown className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{formatBRL(totals.investimento)}</p>
            <p className="text-[10px] text-muted-foreground">Total Investido</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <Users className="h-4 w-4 mx-auto text-green-500 mb-1" />
            <p className="text-lg font-bold">{formatNum(totals.leads)}</p>
            <p className="text-[10px] text-muted-foreground">Leads Gerados</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
            <p className="text-lg font-bold">{cplTotal > 0 ? formatBRL(cplTotal) : "—"}</p>
            <p className="text-[10px] text-muted-foreground">CPL Médio</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <MousePointerClick className="h-4 w-4 mx-auto text-blue-500 mb-1" />
            <p className="text-lg font-bold">{formatNum(totals.cliques)}</p>
            <p className="text-[10px] text-muted-foreground">Cliques</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <Trophy className="h-4 w-4 mx-auto text-red-500 mb-1" />
            <p className="text-lg font-bold">{formatNum(totals.vendas)}</p>
            <p className="text-[10px] text-muted-foreground">Vendas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="channels">Por Canal</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Leads by Channel Chart */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Leads por Canal</CardTitle></CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                        {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center py-12 text-muted-foreground text-sm">Importe relatórios para ver os gráficos</p>}
              </CardContent>
            </Card>

            {/* Investment vs CPL Chart */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Investimento × CPL por Canal</CardTitle></CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                      <Bar dataKey="investimento" fill="hsl(var(--primary))" name="Investimento" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cpl" fill="hsl(var(--warning))" name="CPL" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center py-12 text-muted-foreground text-sm">Sem dados</p>}
              </CardContent>
            </Card>
          </div>

          {/* Ranking */}
          {channelStats.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" /> Ranking de Canais</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {channelStats.map((s, i) => (
                    <div key={s.canal} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border">
                      <span className="text-lg font-bold text-muted-foreground w-8 text-center">{i + 1}º</span>
                      <div className="h-3 w-3 rounded-full" style={{ background: CANAL_COLORS[s.canal] || "#6b7280" }} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{getCanalLabel(s.canal)}</p>
                      </div>
                      <div className="text-right text-xs space-y-0.5">
                        <p><span className="text-muted-foreground">Leads:</span> <span className="font-semibold">{s.leads}</span></p>
                      </div>
                      <div className="text-right text-xs space-y-0.5">
                        <p><span className="text-muted-foreground">CPL:</span> <span className="font-semibold">{s.cpl ? formatBRL(s.cpl) : "—"}</span></p>
                      </div>
                      <div className="text-right text-xs space-y-0.5">
                        <p><span className="text-muted-foreground">Invest.:</span> <span className="font-semibold">{formatBRL(s.investimento)}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* IA Analysis */}
          <div className="flex flex-wrap gap-2">
            <IaCoreAction
              module="general"
              prompt={`Analise os dados de marketing da Uhome e gere um DIAGNÓSTICO DE MARKETING completo:
A) Resumo do período (investimento total, leads, CPL médio)
B) Canal mais eficiente (menor CPL com bom volume)
C) Campanha com melhor performance
D) Campanha com pior performance (maior CPL ou menor conversão)
E) Sugestões de otimização (3-5 ações práticas)
F) Recomendação de redistribuição de orçamento

Dados: ${JSON.stringify(iaContext)}`}
              context={iaContext}
              label="🧠 Gerar Diagnóstico IA de Marketing"
              variant="default"
            />
            <IaCoreAction
              module="ceo"
              prompt={`Gere um RELATÓRIO EXECUTIVO DE MARKETING para o CEO da Uhome:
A) Resumo macro: investimento total, leads, CPL médio, vendas
B) Performance por canal com ranking
C) ROI por canal (quando dados de venda disponíveis)
D) Canais com desperdício de investimento
E) Recomendações estratégicas (onde investir mais, onde cortar)
F) Tendências e insights

Dados: ${JSON.stringify(iaContext)}`}
              context={iaContext}
              label="📄 Gerar Relatório CEO"
            />
          </div>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          <div className="rounded border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-3 py-2 text-left font-semibold">Canal</th>
                  <th className="px-3 py-2 text-right font-semibold">Investimento</th>
                  <th className="px-3 py-2 text-right font-semibold">Leads</th>
                  <th className="px-3 py-2 text-right font-semibold">CPL</th>
                  <th className="px-3 py-2 text-right font-semibold">Cliques</th>
                  <th className="px-3 py-2 text-right font-semibold">CPC</th>
                  <th className="px-3 py-2 text-right font-semibold">CTR</th>
                  <th className="px-3 py-2 text-right font-semibold">Visitas</th>
                  <th className="px-3 py-2 text-right font-semibold">Propostas</th>
                  <th className="px-3 py-2 text-right font-semibold">Vendas</th>
                  <th className="px-3 py-2 text-right font-semibold">Custo/Venda</th>
                </tr>
              </thead>
              <tbody>
                {channelStats.map((s, i) => (
                  <tr key={s.canal} className={`border-b border-border ${i % 2 ? "bg-muted/5" : ""}`}>
                    <td className="px-3 py-2 font-medium flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: CANAL_COLORS[s.canal] || "#6b7280" }} />
                      {getCanalLabel(s.canal)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatBRL(s.investimento)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{s.leads}</td>
                    <td className="px-3 py-2 text-right">{s.cpl ? formatBRL(s.cpl) : "—"}</td>
                    <td className="px-3 py-2 text-right">{formatNum(s.cliques)}</td>
                    <td className="px-3 py-2 text-right">{s.cpc ? formatBRL(s.cpc) : "—"}</td>
                    <td className="px-3 py-2 text-right">{s.ctr ? `${s.ctr.toFixed(1)}%` : "—"}</td>
                    <td className="px-3 py-2 text-right">{s.visitas}</td>
                    <td className="px-3 py-2 text-right">{s.propostas}</td>
                    <td className="px-3 py-2 text-right font-semibold">{s.vendas}</td>
                    <td className="px-3 py-2 text-right">{s.custoVenda ? formatBRL(s.custoVenda) : "—"}</td>
                  </tr>
                ))}
                {channelStats.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Importe relatórios para ver dados por canal.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => addManualEntry({})}>
              <Plus className="h-3 w-3" /> Entrada Manual
            </Button>
          </div>
          <div className="rounded border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-2 py-2 text-left font-semibold">Campanha</th>
                  <th className="px-2 py-2 text-left font-semibold">Canal</th>
                  <th className="px-2 py-2 text-left font-semibold">Empreend.</th>
                  <th className="px-2 py-2 text-right font-semibold">Invest.</th>
                  <th className="px-2 py-2 text-right font-semibold">Impress.</th>
                  <th className="px-2 py-2 text-right font-semibold">Cliques</th>
                  <th className="px-2 py-2 text-right font-semibold">Leads</th>
                  <th className="px-2 py-2 text-right font-semibold">CPL</th>
                  <th className="px-2 py-2 text-right font-semibold">CTR</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} className={`border-b border-border hover:bg-muted/20 group ${i % 2 ? "bg-muted/5" : ""}`}>
                    <td className="px-2 py-1.5">{e.campanha || "—"}</td>
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: CANAL_COLORS[e.canal] || "#6b7280" }} />
                        {getCanalLabel(e.canal)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">{e.empreendimento || "—"}</td>
                    <td className="px-2 py-1.5 text-right">{formatBRL(e.investimento)}</td>
                    <td className="px-2 py-1.5 text-right">{formatNum(e.impressoes)}</td>
                    <td className="px-2 py-1.5 text-right">{formatNum(e.cliques)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{e.leads_gerados}</td>
                    <td className="px-2 py-1.5 text-right">{e.cpl ? formatBRL(e.cpl) : "—"}</td>
                    <td className="px-2 py-1.5 text-right">{e.ctr ? `${e.ctr.toFixed(1)}%` : "—"}</td>
                    <td className="px-2 py-1.5">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive opacity-0 group-hover:opacity-100" onClick={() => deleteEntry(e.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma campanha registrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="space-y-2">
            {reports.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.nome_arquivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {getCanalLabel(r.canal)} · Importado em {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteReport(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum relatório importado</p>
                <p className="text-xs mt-1">Clique em "Importar Relatório" para começar</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
