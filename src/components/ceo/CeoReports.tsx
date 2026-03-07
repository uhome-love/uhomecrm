import { useState, useMemo } from "react";
import { useCeoData, pct, type CeoPeriod } from "@/hooks/useCeoData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ArrowRight } from "lucide-react";

type ReportView = "gerente" | "corretor" | "funil" | "eficiencia";

export default function CeoReports() {
  const [period, setPeriod] = useState<CeoPeriod>("semana");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [filterGerente, setFilterGerente] = useState("");
  const [view, setView] = useState<ReportView>("gerente");
  const { gerentes, allCorretores, companyTotals, loading, dateRange } = useCeoData(period, customStart, customEnd, filterGerente || undefined);

  const filteredCorretores = useMemo(() => {
    if (!filterGerente) return allCorretores;
    return allCorretores.filter(c => c.gerente_id === filterGerente);
  }, [allCorretores, filterGerente]);

  const exportCSV = () => {
    const data = view === "gerente"
      ? gerentes.map(g => ({
          Gerente: g.gerente_nome, Score: g.totals.score,
          "Lig Meta": g.totals.meta_ligacoes, "Lig Real": g.totals.real_ligacoes,
          "VMar Meta": g.totals.meta_visitas_marcadas, "VMar Real": g.totals.real_visitas_marcadas,
          "VRea Meta": g.totals.meta_visitas_realizadas, "VRea Real": g.totals.real_visitas_realizadas,
          "Prop Meta": g.totals.meta_propostas, "Prop Real": g.totals.real_propostas,
          "VGV Ger": g.totals.real_vgv_gerado, "VGV Ass": g.totals.real_vgv_assinado,
        }))
      : filteredCorretores.map(c => ({
          Corretor: c.corretor_nome, Gerente: c.gerente_nome, Score: c.score,
          "Lig Meta": c.meta_ligacoes, "Lig Real": c.real_ligacoes,
          "VMar Meta": c.meta_visitas_marcadas, "VMar Real": c.real_visitas_marcadas,
          "VRea Meta": c.meta_visitas_realizadas, "VRea Real": c.real_visitas_realizadas,
          "Prop Meta": c.meta_propostas, "Prop Real": c.real_propostas,
          "VGV Ger": c.real_vgv_gerado, "VGV Ass": c.real_vgv_assinado,
        }));

    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(r => headers.map(h => (r as any)[h]).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-ceo-${view}-${dateRange.start}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const funnelData = useMemo(() => {
    const t = companyTotals;
    return [
      { label: "Ligações", value: t.real_ligacoes },
      { label: "Visitas Marcadas", value: t.real_visitas_marcadas },
      { label: "Visitas Realizadas", value: t.real_visitas_realizadas },
      { label: "Propostas", value: t.real_propostas },
      { label: "VGV Assinado", value: t.real_vgv_assinado, currency: true },
    ];
  }, [companyTotals]);

  const efficiencyData = useMemo(() => {
    return filteredCorretores.map(c => ({
      nome: c.corretor_nome,
      gerente: c.gerente_nome,
      lig_vmarc: c.real_ligacoes > 0 ? Math.round((c.real_visitas_marcadas / c.real_ligacoes) * 100) : 0,
      vmarc_vreal: c.real_visitas_marcadas > 0 ? Math.round((c.real_visitas_realizadas / c.real_visitas_marcadas) * 100) : 0,
      vreal_prop: c.real_visitas_realizadas > 0 ? Math.round((c.real_propostas / c.real_visitas_realizadas) * 100) : 0,
      prop_vgv: c.real_propostas > 0 ? Math.round((c.real_vgv_assinado / c.real_propostas) * 100) : 0,
    }));
  }, [filteredCorretores]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onValueChange={v => setPeriod(v as CeoPeriod)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dia">Hoje</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {period === "custom" && (
          <>
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-36" />
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-36" />
          </>
        )}
        <Select value={filterGerente || "__all__"} onValueChange={v => setFilterGerente(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos gerentes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos gerentes</SelectItem>
            {gerentes.map(g => <SelectItem key={g.gerente_id} value={g.gerente_id}>{g.gerente_nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={view} onValueChange={v => setView(v as ReportView)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gerente">Por Gerente</SelectItem>
            <SelectItem value="corretor">Por Corretor</SelectItem>
            <SelectItem value="funil">Funil Operacional</SelectItem>
            <SelectItem value="eficiencia">Eficiência</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : view === "funil" ? (
        <div className="rounded-xl border border-border bg-card shadow-card p-6">
          <h3 className="font-display font-semibold text-sm mb-4">Funil Operacional</h3>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {funnelData.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="text-center p-4 rounded-xl bg-muted/30 min-w-[120px]">
                  <p className="text-xs text-muted-foreground mb-1">{step.label}</p>
                  <p className="text-lg font-display font-bold">{step.currency ? `R$ ${step.value.toLocaleString("pt-BR")}` : step.value}</p>
                </div>
                {i < funnelData.length - 1 && (
                  <div className="flex flex-col items-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    {funnelData[i + 1] && !funnelData[i + 1].currency && step.value > 0 && (
                      <span className="text-[10px] text-muted-foreground">{Math.round((funnelData[i + 1].value / step.value) * 100)}%</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : view === "eficiencia" ? (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display font-semibold text-sm">Eficiência por Corretor (Conversão %)</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2">Corretor</th>
                <th className="text-left px-3 py-2">Gerente</th>
                <th className="px-2 py-2 text-center">Lig → VMar</th>
                <th className="px-2 py-2 text-center">VMar → VReal</th>
                <th className="px-2 py-2 text-center">VReal → Prop</th>
                <th className="px-2 py-2 text-center">Prop → VGV</th>
              </tr>
            </thead>
            <tbody>
              {efficiencyData.map((e, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/10">
                  <td className="px-3 py-2 font-medium">{e.nome}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.gerente}</td>
                  {[e.lig_vmarc, e.vmarc_vreal, e.vreal_prop, e.prop_vgv].map((v, j) => (
                    <td key={j} className="px-2 py-2 text-center">
                      <span className={`font-semibold ${v >= 50 ? "text-success" : v >= 25 ? "text-warning" : "text-destructive"}`}>{v}%</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display font-semibold text-sm">
              {view === "gerente" ? "Performance por Gerente" : "Performance por Corretor"}
            </h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2">{view === "gerente" ? "Gerente" : "Corretor"}</th>
                {view === "corretor" && <th className="text-left px-2 py-2">Gerente</th>}
                <th className="px-2 py-2 text-center">Score</th>
                <th className="px-2 py-2 text-center">Lig %</th>
                <th className="px-2 py-2 text-center">VMar %</th>
                <th className="px-2 py-2 text-center">VReal %</th>
                <th className="px-2 py-2 text-center">Prop %</th>
                <th className="px-2 py-2 text-center">VGV Ass</th>
              </tr>
            </thead>
            <tbody>
              {view === "gerente"
                ? gerentes.map(g => (
                    <tr key={g.gerente_id} className="border-b border-border hover:bg-muted/10">
                      <td className="px-3 py-2 font-medium">{g.gerente_nome}</td>
                      <td className="px-2 py-2 text-center"><span className={`font-bold ${g.totals.score >= 70 ? "text-success" : g.totals.score >= 40 ? "text-warning" : "text-destructive"}`}>{g.totals.score}</span></td>
                      {[
                        pct(g.totals.real_ligacoes, g.totals.meta_ligacoes),
                        pct(g.totals.real_visitas_marcadas, g.totals.meta_visitas_marcadas),
                        pct(g.totals.real_visitas_realizadas, g.totals.meta_visitas_realizadas),
                        pct(g.totals.real_propostas, g.totals.meta_propostas),
                      ].map((p, i) => (
                        <td key={i} className="px-2 py-2 text-center">
                          <span className={`font-semibold ${p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive"}`}>{p}%</span>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-medium">R$ {g.totals.real_vgv_assinado.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))
                : filteredCorretores.map(c => (
                    <tr key={c.corretor_id} className="border-b border-border hover:bg-muted/10">
                      <td className="px-3 py-2 font-medium">{c.corretor_nome}</td>
                      <td className="px-2 py-2 text-muted-foreground">{c.gerente_nome}</td>
                      <td className="px-2 py-2 text-center"><span className={`font-bold ${c.score >= 70 ? "text-success" : c.score >= 40 ? "text-warning" : "text-destructive"}`}>{c.score}</span></td>
                      {[
                        pct(c.real_ligacoes, c.meta_ligacoes),
                        pct(c.real_visitas_marcadas, c.meta_visitas_marcadas),
                        pct(c.real_visitas_realizadas, c.meta_visitas_realizadas),
                        pct(c.real_propostas, c.meta_propostas),
                      ].map((p, i) => (
                        <td key={i} className="px-2 py-2 text-center">
                          <span className={`font-semibold ${p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive"}`}>{p}%</span>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-medium">R$ {c.real_vgv_assinado.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
