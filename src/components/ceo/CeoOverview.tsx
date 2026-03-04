import { useState } from "react";
import { useCeoData, pct, type CeoPeriod } from "@/hooks/useCeoData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MapPin, Target, FileText, DollarSign, TrendingUp, Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import CeoMetasMensais from "./CeoMetasMensais";

export default function CeoOverview() {
  const [period, setPeriod] = useState<CeoPeriod>("semana");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const { gerentes, companyTotals: t, loading, dateRange } = useCeoData(period, customStart, customEnd);

  const overallPct = (() => {
    const totalMeta = t.meta_ligacoes + t.meta_visitas_marcadas + t.meta_visitas_realizadas + t.meta_propostas;
    const totalReal = t.real_ligacoes + t.real_visitas_marcadas + t.real_visitas_realizadas + t.real_propostas;
    return totalMeta > 0 ? Math.round((totalReal / totalMeta) * 100) : 0;
  })();

  const cards = [
    { label: "Ligações", icon: Phone, meta: t.meta_ligacoes, real: t.real_ligacoes },
    { label: "Visitas Marcadas", icon: MapPin, meta: t.meta_visitas_marcadas, real: t.real_visitas_marcadas },
    { label: "Visitas Realizadas", icon: Target, meta: t.meta_visitas_realizadas, real: t.real_visitas_realizadas },
    { label: "Propostas", icon: FileText, meta: t.meta_propostas, real: t.real_propostas },
    { label: "VGV Gerado", icon: DollarSign, meta: t.meta_vgv_gerado, real: t.real_vgv_gerado, currency: true },
    { label: "VGV Assinado", icon: TrendingUp, meta: t.meta_vgv_assinado, real: t.real_vgv_assinado, currency: true },
    { label: "% Atingimento", icon: Percent, meta: 100, real: overallPct, isPercent: true },
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
          {/* Company KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map(c => {
              const p = c.isPercent ? c.real : pct(c.real, c.meta);
              return (
                <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <c.icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{c.label}</span>
                  </div>
                  <p className="text-xl font-display font-bold text-foreground">
                    {c.isPercent ? `${c.real}%` : c.currency ? `R$ ${c.real.toLocaleString("pt-BR")}` : c.real}
                  </p>
                  {!c.isPercent && (
                    <>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(p, 100)}%` }} />
                        </div>
                        <span className={`text-xs font-semibold ${p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive"}`}>{p}%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Meta: {c.currency ? `R$ ${c.meta.toLocaleString("pt-BR")}` : c.meta}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Metas Mensais CEO */}
          <CeoMetasMensais />

          {/* Comparativo por Gerente */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display font-semibold text-sm">Comparativo por Gerente</h3>
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
                  <th className="px-2 py-2 text-center">VGV Ger.</th>
                  <th className="px-2 py-2 text-center">VGV Ass.</th>
                  <th className="px-2 py-2 text-center">% Geral</th>
                </tr>
              </thead>
              <tbody>
                {gerentes.map(g => {
                  const gPct = pct(
                    g.totals.real_ligacoes + g.totals.real_visitas_realizadas + g.totals.real_propostas,
                    g.totals.meta_ligacoes + g.totals.meta_visitas_realizadas + g.totals.meta_propostas
                  );
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
                      <td className="px-2 py-2 text-center">R$ {g.totals.real_vgv_gerado.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2 text-center">R$ {g.totals.real_vgv_assinado.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`font-semibold ${gPct >= 80 ? "text-success" : gPct >= 50 ? "text-warning" : "text-destructive"}`}>{gPct}%</span>
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
