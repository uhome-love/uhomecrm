import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCeoData, pct, type CeoPeriod } from "@/hooks/useCeoData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MapPin, Target, FileText, DollarSign, TrendingUp, Zap, BarChart3, Activity, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import SaudeOperacao from "./SaudeOperacao";
import { cn } from "@/lib/utils";

const fmtCurrency = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
};

const progressColor = (p: number) =>
  p >= 70 ? "bg-success" : p >= 30 ? "bg-warning" : "bg-destructive";

const progressTextColor = (p: number) =>
  p >= 70 ? "text-success" : p >= 30 ? "text-warning" : "text-destructive";

const semaphore = (p: number) =>
  p >= 70 ? "🟢" : p >= 30 ? "🟡" : "🔴";

export default function CeoOverview() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<CeoPeriod>("semana");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const { gerentes, companyTotals: t, loading, dateRange } = useCeoData(period, customStart, customEnd);

  const overallPct = t.meta_vgv_assinado > 0
    ? Math.round((t.real_vgv_assinado / t.meta_vgv_assinado) * 100)
    : 0;

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedPct = Math.round((dayOfMonth / daysInMonth) * 100);
  const gap = overallPct - expectedPct;

  // Executive summary chips
  const summary = useMemo(() => {
    const items: { text: string; type: "success" | "warning" | "danger"; link?: string }[] = [];
    const ligPct = pct(t.real_ligacoes, t.meta_ligacoes);
    const vmarcPct = pct(t.real_visitas_marcadas, t.meta_visitas_marcadas);

    if (ligPct >= 80) items.push({ text: "Ligações em bom ritmo", type: "success", link: "/oferta-ativa" });
    else if (ligPct >= 50) items.push({ text: "Ligações em ritmo moderado", type: "warning", link: "/oferta-ativa" });
    else items.push({ text: "Ligações abaixo do esperado", type: "danger", link: "/oferta-ativa" });

    if (vmarcPct >= 80) items.push({ text: "Visitas marcadas no alvo", type: "success", link: "/agenda-visitas" });
    else if (vmarcPct < 50) items.push({ text: "Visitas abaixo da meta", type: "danger", link: "/agenda-visitas" });

    if (gerentes.length > 0) {
      const worst = [...gerentes].sort((a, b) => a.totals.score - b.totals.score)[0];
      if (worst.totals.score < 40) {
        items.push({ text: `Equipe ${worst.gerente_nome.split(" ")[0]} com menor conversão`, type: "danger" });
      }
    }

    return items;
  }, [t, gerentes]);

  // 2-row KPI grid
  const processCards = [
    { label: "Ligações", icon: Phone, meta: t.meta_ligacoes, real: t.real_ligacoes },
    { label: "Visitas Marcadas", icon: MapPin, meta: t.meta_visitas_marcadas, real: t.real_visitas_marcadas },
    { label: "Visitas Realizadas", icon: Target, meta: t.meta_visitas_realizadas, real: t.real_visitas_realizadas },
    { label: "Propostas", icon: FileText, meta: t.meta_propostas, real: t.real_propostas },
  ];

  const ticketMedio = t.real_vgv_assinado > 0 && t.real_propostas > 0
    ? Math.round(t.real_vgv_assinado / Math.max(t.real_propostas, 1))
    : 0;
  const conversaoGeral = t.real_ligacoes > 0
    ? ((t.real_propostas / t.real_ligacoes) * 100).toFixed(1)
    : "0";

  const resultCards = [
    { label: "VGV Gerado", value: fmtCurrency(t.real_vgv_gerado), meta: null },
    { label: "VGV Assinado", value: fmtCurrency(t.real_vgv_assinado), meta: t.meta_vgv_assinado, pctVal: overallPct },
    { label: "Ticket Médio", value: fmtCurrency(ticketMedio), meta: null },
    { label: "Conversão Geral", value: `${conversaoGeral}%`, meta: null },
  ];

  const renderKpiCard = (c: { label: string; icon: any; meta: number; real: number }) => {
    const p = pct(c.real, c.meta);
    const noMeta = c.meta === 0;
    return (
      <div key={c.label} className="rounded-xl border border-border bg-card p-3 shadow-card">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
          <c.icon className="h-3.5 w-3.5" />
          <span className="text-[10px] font-medium uppercase">{c.label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-display font-bold text-foreground">{c.real.toLocaleString("pt-BR")}</span>
          {!noMeta && (
            <span className={cn("text-xs font-semibold", progressTextColor(p))}>{p}%</span>
          )}
        </div>
        {noMeta ? (
          <p className="text-[10px] text-muted-foreground/50 mt-1">Meta não definida</p>
        ) : (
          <>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
              <div className={cn("h-full rounded-full transition-all", progressColor(p))} style={{ width: `${Math.min(p, 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Meta: {c.meta.toLocaleString("pt-BR")}</p>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Period selector */}
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
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Resumo Executivo</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.map((s, i) => (
                <button
                  key={i}
                  onClick={() => s.link && navigate(s.link)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
                    s.link && "cursor-pointer hover:opacity-80",
                    s.type === "success" ? "bg-success/5 border-success/20 text-success" :
                    s.type === "warning" ? "bg-warning/5 border-warning/20 text-warning" :
                    "bg-destructive/5 border-destructive/20 text-destructive"
                  )}
                >
                  {s.type === "success" ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {s.text}
                  {s.link && <span className="text-[9px] opacity-60">→</span>}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Dia {dayOfMonth}/{daysInMonth} do mês · Esperado: {expectedPct}% · Realizado: {overallPct}% · Gap: {gap > 0 ? "+" : ""}{gap}pp
            </p>
          </div>

          {/* ═══ LINHA 1 — MÉTRICAS DE PROCESSO ═══ */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-2">Processo</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {processCards.map(renderKpiCard)}
            </div>
          </div>

          {/* ═══ LINHA 2 — MÉTRICAS DE RESULTADO ═══ */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-2">Resultado</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {resultCards.map(c => (
                <div key={c.label} className="rounded-xl border border-border bg-card p-3 shadow-card">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1.5">{c.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-display font-bold text-foreground">{c.value}</span>
                    {c.pctVal !== undefined && (
                      <span className={cn("text-xs font-semibold", progressTextColor(c.pctVal))}>{c.pctVal}%</span>
                    )}
                  </div>
                  {c.meta !== null && c.meta > 0 ? (
                    <>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
                        <div className={cn("h-full rounded-full transition-all", progressColor(c.pctVal || 0))} style={{ width: `${Math.min(c.pctVal || 0, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Meta: {fmtCurrency(c.meta)}</p>
                    </>
                  ) : c.meta === 0 ? (
                    <p className="text-[10px] text-muted-foreground/50 mt-1">Meta não definida</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* ═══ COMPARATIVO DE EQUIPES ═══ */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Performance por Equipe</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-3 py-2 font-semibold w-6"></th>
                  <th className="text-left px-2 py-2 font-semibold">Equipe</th>
                  <th className="px-2 py-2 text-center font-semibold">Ligações</th>
                  <th className="px-2 py-2 text-center font-semibold">V.Marc</th>
                  <th className="px-2 py-2 text-center font-semibold">V.Real</th>
                  <th className="px-2 py-2 text-center font-semibold">VGV</th>
                  <th className="px-2 py-2 text-center font-semibold">Ating.</th>
                </tr>
              </thead>
              <tbody>
                {gerentes.map(g => {
                  const gPct = pct(g.totals.real_vgv_assinado, g.totals.meta_vgv_assinado);
                  const isExpanded = expandedTeam === g.gerente_id;
                  return (
                    <>
                      <tr
                        key={g.gerente_id}
                        className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => setExpandedTeam(isExpanded ? null : g.gerente_id)}
                      >
                        <td className="px-3 py-2">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </td>
                        <td className="px-2 py-2 font-medium">{g.gerente_nome}</td>
                        <td className="px-2 py-2 text-center">{g.totals.real_ligacoes.toLocaleString("pt-BR")}</td>
                        <td className="px-2 py-2 text-center">{g.totals.real_visitas_marcadas}</td>
                        <td className="px-2 py-2 text-center">{g.totals.real_visitas_realizadas}</td>
                        <td className="px-2 py-2 text-center font-medium">{fmtCurrency(g.totals.real_vgv_assinado)}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={cn("font-semibold", progressTextColor(gPct))}>
                            {semaphore(gPct)} {gPct}%
                          </span>
                        </td>
                      </tr>
                      {isExpanded && g.corretores.map(c => {
                        const cPct = pct(c.real_vgv_assinado, c.meta_vgv_assinado);
                        return (
                          <tr key={c.corretor_id} className="border-b border-border/50 bg-muted/10">
                            <td className="px-3 py-1.5"></td>
                            <td className="px-2 py-1.5 text-muted-foreground pl-6">{c.corretor_nome}</td>
                            <td className="px-2 py-1.5 text-center text-muted-foreground">{c.real_ligacoes}</td>
                            <td className="px-2 py-1.5 text-center text-muted-foreground">{c.real_visitas_marcadas}</td>
                            <td className="px-2 py-1.5 text-center text-muted-foreground">{c.real_visitas_realizadas}</td>
                            <td className="px-2 py-1.5 text-center text-muted-foreground">{fmtCurrency(c.real_vgv_assinado)}</td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={cn("text-[10px]", progressTextColor(cPct))}>{cPct}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ═══ CONVERSÃO DO FUNIL ═══ */}
          <FunnelSection t={t} />

          {/* ═══ SAÚDE DA OPERAÇÃO ═══ */}
          <div className="rounded-xl border border-border bg-card shadow-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Saúde da Operação</h3>
            </div>
            <SaudeOperacao />
          </div>
        </>
      )}
    </div>
  );
}

function FunnelSection({ t }: { t: any }) {
  const funnel = useMemo(() => {
    const leads = t.real_ligacoes;
    const contatos = Math.round(t.real_ligacoes * 0.68);
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

  return (
    <div className="rounded-xl border border-border bg-card shadow-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="font-display font-semibold text-sm">Conversão do Funil</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {funnel.map((step) => {
          const convRate = step.next !== null && step.value > 0 ? Math.round((step.next / step.value) * 100) : null;
          const isBottleneck = convRate !== null && convRate < 20;
          return (
            <div key={step.label} className={cn("rounded-lg border p-3 text-center", isBottleneck ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/20")}>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">{step.label}</p>
              <p className="text-lg font-display font-bold text-foreground mt-1">{step.value}</p>
              {convRate !== null && (
                <div className={cn("mt-1 text-[10px] font-semibold", isBottleneck ? "text-destructive" : convRate >= 50 ? "text-success" : "text-warning")}>
                  → {convRate}%{isBottleneck && " ⚠️"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {funnel.some((s) => s.next !== null && s.value > 0 && Math.round((s.next! / s.value) * 100) < 20) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Gargalo detectado em etapas com conversão abaixo de 20%</span>
        </div>
      )}
    </div>
  );
}
