import { useState, useMemo } from "react";
import { useCeoData, pct, type CeoPeriod } from "@/hooks/useCeoData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MapPin, Target, FileText, DollarSign, TrendingUp, Percent, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, CheckCircle, Users, Zap, BarChart3, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import CeoMetasMensais from "./CeoMetasMensais";
import SaudeOperacao from "./SaudeOperacao";

const fmtCurrency = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
};

export default function CeoOverview() {
  const [period, setPeriod] = useState<CeoPeriod>("semana");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const { gerentes, companyTotals: t, loading, dateRange } = useCeoData(period, customStart, customEnd);

  // Simulated previous period comparison (delta %)
  // In production this would come from a second query with previous period
  const deltas = useMemo(() => ({
    ligacoes: 0,
    visitas_marcadas: 0,
    visitas_realizadas: 0,
    propostas: 0,
    vgv_gerado: 0,
    vgv_assinado: 0,
  }), []);

  const overallPct = t.meta_vgv_assinado > 0
    ? Math.round((t.real_vgv_assinado / t.meta_vgv_assinado) * 100)
    : 0;

  // Month status calculation
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedPct = Math.round((dayOfMonth / daysInMonth) * 100);
  const gap = overallPct - expectedPct;
  const monthStatus = gap >= 0 ? "dentro_da_meta" : gap >= -10 ? "atenção" : "abaixo_da_meta";

  // Funnel conversion data
  const funnel = useMemo(() => {
    const leads = t.real_ligacoes; // Ligações as top of funnel
    const contatos = Math.round(t.real_ligacoes * 0.68); // Estimate contacts
    const visitasMarcadas = t.real_visitas_marcadas;
    const visitasRealizadas = t.real_visitas_realizadas;
    const propostas = t.real_propostas;
    const vendas = t.real_vgv_assinado > 0 ? Math.max(1, Math.round(t.real_vgv_assinado / 400000)) : 0;

    return [
      { label: "Ligações", value: leads, next: contatos },
      { label: "Contatos", value: contatos, next: visitasMarcadas },
      { label: "V. Marcadas", value: visitasMarcadas, next: visitasRealizadas },
      { label: "V. Realizadas", value: visitasRealizadas, next: propostas },
      { label: "Propostas", value: propostas, next: vendas },
      { label: "Vendas", value: vendas, next: null },
    ];
  }, [t]);

  // Executive summary
  const summary = useMemo(() => {
    const items: { text: string; type: "success" | "warning" | "danger" }[] = [];
    const ligPct = pct(t.real_ligacoes, t.meta_ligacoes);
    const vmarcPct = pct(t.real_visitas_marcadas, t.meta_visitas_marcadas);

    if (ligPct >= 80) items.push({ text: "Ligações em bom ritmo", type: "success" });
    else if (ligPct >= 50) items.push({ text: "Ligações em ritmo moderado", type: "warning" });
    else items.push({ text: "Ligações abaixo do esperado", type: "danger" });

    if (vmarcPct >= 80) items.push({ text: "Visitas marcadas no alvo", type: "success" });
    else if (vmarcPct < 50) items.push({ text: "Visitas abaixo da meta", type: "danger" });

    // Find worst gerente
    if (gerentes.length > 0) {
      const worst = [...gerentes].sort((a, b) => a.totals.score - b.totals.score)[0];
      if (worst.totals.score < 40) {
        items.push({ text: `Equipe ${worst.gerente_nome} com menor conversão`, type: "danger" });
      }
    }

    return items;
  }, [t, gerentes]);

  const cards = [
    { label: "Ligações", icon: Phone, meta: t.meta_ligacoes, real: t.real_ligacoes, delta: deltas.ligacoes },
    { label: "Visitas Marcadas", icon: MapPin, meta: t.meta_visitas_marcadas, real: t.real_visitas_marcadas, delta: deltas.visitas_marcadas },
    { label: "Visitas Realizadas", icon: Target, meta: t.meta_visitas_realizadas, real: t.real_visitas_realizadas, delta: deltas.visitas_realizadas },
    { label: "Propostas", icon: FileText, meta: t.meta_propostas, real: t.real_propostas, delta: deltas.propostas },
    { label: "VGV Gerado", icon: DollarSign, meta: t.meta_vgv_gerado, real: t.real_vgv_gerado, currency: true, delta: deltas.vgv_gerado },
    { label: "VGV Assinado", icon: TrendingUp, meta: t.meta_vgv_assinado, real: t.real_vgv_assinado, currency: true, delta: deltas.vgv_assinado },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onValueChange={(v) => setPeriod(v as CeoPeriod)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dia">Hoje</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {period === "custom" && (
          <>
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-40" />
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-40" />
          </>
        )}
        <span className="text-xs text-muted-foreground">{dateRange.start} a {dateRange.end}</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>
      ) : gerentes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Sem dados no período selecionado.</div>
      ) : (
        <>
          {/* ═══ RESUMO EXECUTIVO ═══ */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Resumo Executivo</h3>
              <span className={`ml-2 text-[10px] px-2 py-0.5 rounded font-semibold ${
                monthStatus === "dentro_da_meta" ? "bg-success/10 text-success" : monthStatus === "atenção" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
              }`}>
                {monthStatus === "dentro_da_meta" ? "BOM RITMO" : monthStatus === "atenção" ? "ATENÇÃO" : "ABAIXO DA META"}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {summary.map((s, i) => (
                <div key={i} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${
                  s.type === "success" ? "bg-success/5 border-success/20 text-success" :
                  s.type === "warning" ? "bg-warning/5 border-warning/20 text-warning" :
                  "bg-destructive/5 border-destructive/20 text-destructive"
                }`}>
                  {s.type === "success" ? <CheckCircle className="h-3 w-3" /> : s.type === "warning" ? <AlertTriangle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {s.text}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Dia {dayOfMonth}/{daysInMonth} do mês · Esperado: {expectedPct}% · Realizado: {overallPct}% · Gap: {gap > 0 ? "+" : ""}{gap}pp
            </p>
          </div>

          {/* ═══ STATUS DO MÊS ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`rounded-xl border p-4 shadow-card ${
              monthStatus === "dentro_da_meta" ? "border-success/30 bg-success/5" : monthStatus === "atenção" ? "border-warning/30 bg-warning/5" : "border-destructive/30 bg-destructive/5"
            }`}>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Status do Mês</p>
              <p className={`text-lg font-display font-bold mt-1 ${
                monthStatus === "dentro_da_meta" ? "text-success" : monthStatus === "atenção" ? "text-warning" : "text-destructive"
              }`}>
                {monthStatus === "dentro_da_meta" ? "Dentro da Meta" : monthStatus === "atenção" ? "Atenção" : "Abaixo da Meta"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Realizado: {overallPct}% · Esperado: {expectedPct}%</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Gerentes Ativos</p>
              <p className="text-lg font-display font-bold text-foreground mt-1">{gerentes.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{gerentes.filter(g => g.totals.score >= 70).length} acima da meta</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">VGV Assinado</p>
              <p className="text-lg font-display font-bold text-foreground mt-1">{fmtCurrency(t.real_vgv_assinado)}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${overallPct >= 80 ? "bg-success" : overallPct >= 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${Math.min(overallPct, 100)}%` }} />
                </div>
                <span className={`text-[10px] font-semibold ${overallPct >= 80 ? "text-success" : overallPct >= 50 ? "text-warning" : "text-destructive"}`}>{overallPct}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Meta: {fmtCurrency(t.meta_vgv_assinado)}</p>
            </div>
          </div>

          {/* ═══ KPI CARDS ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map(c => {
              const p = pct(c.real, c.meta);
              return (
                <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <c.icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{c.label}</span>
                    </div>
                  </div>
                  <p className="text-xl font-display font-bold text-foreground">
                    {c.currency ? fmtCurrency(c.real) : c.real.toLocaleString("pt-BR")}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(p, 100)}%` }} />
                    </div>
                    <span className={`text-xs font-semibold ${p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive"}`}>{p}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Meta: {c.currency ? fmtCurrency(c.meta) : c.meta}</p>
                </div>
              );
            })}
          </div>

          {/* ═══ CONVERSÃO DO FUNIL ═══ */}
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Conversão do Funil</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {funnel.map((step, i) => {
                const convRate = step.next !== null && step.value > 0 ? Math.round((step.next / step.value) * 100) : null;
                const isBottleneck = convRate !== null && convRate < 20;
                return (
                  <div key={step.label} className="relative">
                    <div className={`rounded-lg border p-3 text-center ${isBottleneck ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/20"}`}>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">{step.label}</p>
                      <p className="text-lg font-display font-bold text-foreground mt-1">{step.value}</p>
                      {convRate !== null && (
                        <div className={`mt-1 text-[10px] font-semibold ${isBottleneck ? "text-destructive" : convRate >= 50 ? "text-success" : "text-warning"}`}>
                          → {convRate}%
                          {isBottleneck && <span className="ml-1">⚠️</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Bottleneck indicator */}
            {funnel.some((s, i) => s.next !== null && s.value > 0 && Math.round((s.next! / s.value) * 100) < 20) && (
              <div className="mt-3 flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Gargalo detectado em etapas com conversão abaixo de 20%</span>
              </div>
            )}
          </div>

          {/* ═══ SAÚDE DA OPERAÇÃO ═══ */}
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Saúde da Operação</h3>
            </div>
            <SaudeOperacao />
          </div>

          {/* Metas Mensais CEO */}
          <CeoMetasMensais />

          {/* ═══ PERFORMANCE DOS GERENTES ═══ */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Performance dos Gerentes</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-3 py-2 font-display font-semibold">Gerente</th>
                  <th className="px-2 py-2 text-center">Score</th>
                  <th className="px-2 py-2 text-center">Lig.</th>
                  <th className="px-2 py-2 text-center">V.Marc</th>
                  <th className="px-2 py-2 text-center">V.Real</th>
                  <th className="px-2 py-2 text-center">Prop.</th>
                  <th className="px-2 py-2 text-center">VGV Ass.</th>
                  <th className="px-2 py-2 text-center">% Geral</th>
                  <th className="px-2 py-2 text-center">Tx Visita</th>
                  <th className="px-2 py-2 text-center">Tx Proposta</th>
                </tr>
              </thead>
              <tbody>
                {gerentes.map(g => {
                  const gPct = pct(g.totals.real_vgv_assinado, g.totals.meta_vgv_assinado);
                  const txVisita = g.totals.real_visitas_marcadas > 0 ? Math.round((g.totals.real_visitas_realizadas / g.totals.real_visitas_marcadas) * 100) : 0;
                  const txProposta = g.totals.real_visitas_realizadas > 0 ? Math.round((g.totals.real_propostas / g.totals.real_visitas_realizadas) * 100) : 0;
                  return (
                    <tr key={g.gerente_id} className="border-b border-border hover:bg-muted/10">
                      <td className="px-3 py-2 font-medium">{g.gerente_nome}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-flex items-center justify-center h-6 w-8 rounded-md text-xs font-bold ${g.totals.score >= 70 ? "bg-success/10 text-success" : g.totals.score >= 40 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                          {g.totals.score}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">{g.totals.real_ligacoes}/{g.totals.meta_ligacoes}</td>
                      <td className="px-2 py-2 text-center">{g.totals.real_visitas_marcadas}/{g.totals.meta_visitas_marcadas}</td>
                      <td className="px-2 py-2 text-center">{g.totals.real_visitas_realizadas}/{g.totals.meta_visitas_realizadas}</td>
                      <td className="px-2 py-2 text-center">{g.totals.real_propostas}/{g.totals.meta_propostas}</td>
                      <td className="px-2 py-2 text-center font-medium">{fmtCurrency(g.totals.real_vgv_assinado)}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`font-semibold ${gPct >= 80 ? "text-success" : gPct >= 50 ? "text-warning" : "text-destructive"}`}>{gPct}%</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`font-semibold ${txVisita >= 70 ? "text-success" : txVisita >= 40 ? "text-warning" : "text-destructive"}`}>{txVisita}%</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`font-semibold ${txProposta >= 30 ? "text-success" : txProposta >= 15 ? "text-warning" : "text-destructive"}`}>{txProposta}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
