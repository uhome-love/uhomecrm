import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCeoData, pct, type CeoPeriod } from "@/hooks/useCeoData";
import { Phone, MapPin, Target, FileText, DollarSign, TrendingUp, Zap, BarChart3, Activity, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SaudeOperacao from "./SaudeOperacao";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { cn, formatBRLCompact } from "@/lib/utils";

const fmtCurrency = formatBRLCompact;

const progressColor = (p: number) =>
  p >= 70 ? "bg-success" : p >= 30 ? "bg-warning" : "bg-destructive";

const progressTextColor = (p: number) =>
  p >= 70 ? "text-success" : p >= 30 ? "text-warning" : "text-destructive";

const semaphore = (p: number) =>
  p >= 70 ? "🟢" : p >= 30 ? "🟡" : "🔴";

const PERIOD_TABS = [
  { label: "Hoje",    value: "dia"    },
  { label: "Semana",  value: "semana" },
  { label: "Mês",     value: "mes"    },
  { label: "Personalizado", value: "custom" },
];

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

  const ticketMedio = t.real_vgv_assinado > 0 && t.real_propostas > 0
    ? Math.round(t.real_vgv_assinado / Math.max(t.real_propostas, 1))
    : 0;
  const conversaoGeral = t.real_ligacoes > 0
    ? ((t.real_propostas / t.real_ligacoes) * 100).toFixed(1)
    : "0";

  const ligPct = pct(t.real_ligacoes, t.meta_ligacoes);
  const vmarcPct = pct(t.real_visitas_marcadas, t.meta_visitas_marcadas);
  const vrealPct = pct(t.real_visitas_realizadas, t.meta_visitas_realizadas);
  const propPct = pct(t.real_propostas, t.meta_propostas);

  return (
    <div className="space-y-4 bg-[#f7f7f8] dark:bg-[#0f0f12] p-6 -m-6 min-h-full">
      {/* PageHeader with tabs */}
      <PageHeader
        title="Dashboard CEO"
        subtitle={`${dateRange.start} a ${dateRange.end} · Dia ${dayOfMonth}/${daysInMonth} do mês`}
        activeTab={period}
        onTabChange={(v) => setPeriod(v as CeoPeriod)}
        tabs={PERIOD_TABS}
        actions={
          period === "custom" ? (
            <div className="flex items-center gap-2">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-36 h-8 text-xs" />
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-36 h-8 text-xs" />
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>
      ) : gerentes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Sem dados no período selecionado.</div>
      ) : (
        <>
          {/* Resumo Executivo */}
          <div className="rounded-[14px] border border-[#f0f0f0] dark:border-white/[0.07] bg-white dark:bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-[#4F46E5]" />
              <h3 className="font-semibold text-sm text-[#0a0a0a] dark:text-[#fafafa]">Resumo executivo</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.map((s, i) => (
                <button
                  key={i}
                  onClick={() => s.link && navigate(s.link)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
                    s.link && "cursor-pointer hover:opacity-80",
                    s.type === "success" ? "bg-[#10b981]/5 border-[#10b981]/20 text-[#10b981]" :
                    s.type === "warning" ? "bg-[#f59e0b]/5 border-[#f59e0b]/20 text-[#f59e0b]" :
                    "bg-[#ef4444]/5 border-[#ef4444]/20 text-[#ef4444]"
                  )}
                >
                  {s.type === "success" ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {s.text}
                  {s.link && <span className="text-[9px] opacity-60">→</span>}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#a1a1aa] mt-2">
              Esperado: {expectedPct}% · Realizado: {overallPct}% · Gap: {gap > 0 ? "+" : ""}{gap}pp
            </p>
          </div>

          {/* KPIs Processo */}
          <KpiGrid cols={4}>
            <KpiCard
              label="Ligações"
              value={t.real_ligacoes.toLocaleString("pt-BR")}
              icon={<Phone size={14} strokeWidth={1.5} />}
              hint={t.meta_ligacoes > 0 ? `${ligPct}% da meta · meta: ${t.meta_ligacoes.toLocaleString("pt-BR")}` : "meta não definida"}
              variant={ligPct >= 70 ? "success" : ligPct >= 30 ? "warning" : "danger"}
            />
            <KpiCard
              label="Visitas marcadas"
              value={t.real_visitas_marcadas.toLocaleString("pt-BR")}
              icon={<MapPin size={14} strokeWidth={1.5} />}
              hint={t.meta_visitas_marcadas > 0 ? `${vmarcPct}% da meta · meta: ${t.meta_visitas_marcadas.toLocaleString("pt-BR")}` : "meta não definida"}
              variant={vmarcPct >= 70 ? "success" : vmarcPct >= 30 ? "warning" : "danger"}
            />
            <KpiCard
              label="Visitas realizadas"
              value={t.real_visitas_realizadas.toLocaleString("pt-BR")}
              icon={<Target size={14} strokeWidth={1.5} />}
              hint={t.meta_visitas_realizadas > 0 ? `${vrealPct}% da meta · meta: ${t.meta_visitas_realizadas.toLocaleString("pt-BR")}` : "meta não definida"}
              variant={vrealPct >= 70 ? "success" : vrealPct >= 30 ? "warning" : "danger"}
            />
            <KpiCard
              label="Propostas"
              value={t.real_propostas.toLocaleString("pt-BR")}
              icon={<FileText size={14} strokeWidth={1.5} />}
              hint={t.meta_propostas > 0 ? `${propPct}% da meta · meta: ${t.meta_propostas.toLocaleString("pt-BR")}` : "meta não definida"}
              variant={propPct >= 70 ? "success" : propPct >= 30 ? "warning" : "danger"}
            />
          </KpiGrid>

          {/* KPIs Resultado */}
          <KpiGrid cols={4}>
            <KpiCard
              label="VGV gerado"
              value={fmtCurrency(t.real_vgv_gerado)}
              icon={<DollarSign size={14} strokeWidth={1.5} />}
            />
            <KpiCard
              label="VGV assinado"
              value={fmtCurrency(t.real_vgv_assinado)}
              icon={<TrendingUp size={14} strokeWidth={1.5} />}
              variant={overallPct >= 70 ? "success" : overallPct >= 30 ? "warning" : "danger"}
              hint={t.meta_vgv_assinado > 0 ? `${overallPct}% da meta · meta: ${fmtCurrency(t.meta_vgv_assinado)}` : "meta não definida"}
            />
            <KpiCard
              label="Ticket médio"
              value={fmtCurrency(ticketMedio)}
              variant="highlight"
            />
            <KpiCard
              label="Conversão geral"
              value={`${conversaoGeral}%`}
            />
          </KpiGrid>

          {/* Comparativo de Equipes */}
          <TeamComparisonTable gerentes={gerentes} expandedTeam={expandedTeam} setExpandedTeam={setExpandedTeam} />

          {/* Conversão do Funil */}
          <FunnelSection t={t} />

          {/* Saúde da Operação */}
          <div className="rounded-[14px] border border-[#f0f0f0] dark:border-white/[0.07] bg-white dark:bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-[#4F46E5]" />
              <h3 className="font-semibold text-sm text-[#0a0a0a] dark:text-[#fafafa]">Saúde da operação</h3>
            </div>
            <SaudeOperacao />
          </div>
        </>
      )}
    </div>
  );
}

function TeamComparisonTable({ gerentes, expandedTeam, setExpandedTeam }: { gerentes: any[]; expandedTeam: string | null; setExpandedTeam: (v: string | null) => void }) {
  return (
    <div className="rounded-[14px] border border-[#f0f0f0] dark:border-white/[0.07] bg-white dark:bg-white/[0.04] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#f0f0f0] dark:border-white/[0.07] flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#4F46E5]" />
        <h3 className="font-semibold text-sm text-[#0a0a0a] dark:text-[#fafafa]">Performance por equipe</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#f0f0f0] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02]">
            <th className="text-left px-3 py-2 font-semibold w-6"></th>
            <th className="text-left px-2 py-2 font-semibold text-[#71717a]">Equipe</th>
            <th className="px-2 py-2 text-center font-semibold text-[#71717a]">Ligações</th>
            <th className="px-2 py-2 text-center font-semibold text-[#71717a]">V.Marc</th>
            <th className="px-2 py-2 text-center font-semibold text-[#71717a]">V.Real</th>
            <th className="px-2 py-2 text-center font-semibold text-[#71717a]">VGV</th>
            <th className="px-2 py-2 text-center font-semibold text-[#71717a]">Ating.</th>
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
                  className="border-b border-[#f0f0f0] dark:border-white/[0.07] hover:bg-[#fafafa] dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setExpandedTeam(isExpanded ? null : g.gerente_id)}
                >
                  <td className="px-3 py-2">
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-[#a1a1aa]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#a1a1aa]" />}
                  </td>
                  <td className="px-2 py-2 font-medium text-[#0a0a0a] dark:text-[#fafafa]">{g.gerente_nome}</td>
                  <td className="px-2 py-2 text-center text-[#71717a]">{g.totals.real_ligacoes.toLocaleString("pt-BR")}</td>
                  <td className="px-2 py-2 text-center text-[#71717a]">{g.totals.real_visitas_marcadas}</td>
                  <td className="px-2 py-2 text-center text-[#71717a]">{g.totals.real_visitas_realizadas}</td>
                  <td className="px-2 py-2 text-center font-medium text-[#0a0a0a] dark:text-[#fafafa]">{formatBRLCompact(g.totals.real_vgv_assinado)}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={cn("font-semibold", gPct >= 70 ? "text-[#10b981]" : gPct >= 30 ? "text-[#f59e0b]" : "text-[#ef4444]")}>
                      {gPct}%
                    </span>
                  </td>
                </tr>
                {isExpanded && g.corretores.map((c: any) => {
                  const cPct = pct(c.real_vgv_assinado, c.meta_vgv_assinado);
                  return (
                    <tr key={c.corretor_id} className="border-b border-[#f0f0f0]/50 dark:border-white/[0.04] bg-[#fafafa]/50 dark:bg-white/[0.01]">
                      <td className="px-3 py-1.5"></td>
                      <td className="px-2 py-1.5 text-[#a1a1aa] pl-6">{c.corretor_nome}</td>
                      <td className="px-2 py-1.5 text-center text-[#a1a1aa]">{c.real_ligacoes}</td>
                      <td className="px-2 py-1.5 text-center text-[#a1a1aa]">{c.real_visitas_marcadas}</td>
                      <td className="px-2 py-1.5 text-center text-[#a1a1aa]">{c.real_visitas_realizadas}</td>
                      <td className="px-2 py-1.5 text-center text-[#a1a1aa]">{formatBRLCompact(c.real_vgv_assinado)}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={cn("text-[10px]", cPct >= 70 ? "text-[#10b981]" : cPct >= 30 ? "text-[#f59e0b]" : "text-[#ef4444]")}>{cPct}%</span>
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
    <div className="rounded-[14px] border border-[#f0f0f0] dark:border-white/[0.07] bg-white dark:bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-[#4F46E5]" />
        <h3 className="font-semibold text-sm text-[#0a0a0a] dark:text-[#fafafa]">Conversão do funil</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {funnel.map((step) => {
          const convRate = step.next !== null && step.value > 0 ? Math.round((step.next / step.value) * 100) : null;
          const isBottleneck = convRate !== null && convRate < 20;
          return (
            <div key={step.label} className={cn(
              "rounded-[10px] border p-3 text-center",
              isBottleneck ? "border-[#ef4444]/30 bg-[#ef4444]/5" : "border-[#f0f0f0] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02]"
            )}>
              <p className="text-[10px] text-[#a1a1aa] font-medium">{step.label}</p>
              <p className="text-lg font-[800] text-[#0a0a0a] dark:text-[#fafafa] mt-1">{step.value}</p>
              {convRate !== null && (
                <div className={cn("mt-1 text-[10px] font-semibold",
                  isBottleneck ? "text-[#ef4444]" : convRate >= 50 ? "text-[#10b981]" : "text-[#f59e0b]"
                )}>
                  → {convRate}%
                </div>
              )}
            </div>
          );
        })}
      </div>
      {funnel.some((s) => s.next !== null && s.value > 0 && Math.round((s.next! / s.value) * 100) < 20) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[#ef4444]">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Gargalo detectado em etapas com conversão abaixo de 20%</span>
        </div>
      )}
    </div>
  );
}