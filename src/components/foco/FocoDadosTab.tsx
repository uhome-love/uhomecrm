import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Download } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  useCorretoresComAlocacao,
  useEmpreendimentosCanonicos,
  useFocoPerformance,
} from "@/hooks/useFocoCorretores";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

type Preset = "7d" | "30d" | "90d" | "mes";

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from = new Date(to);
  if (p === "7d") from.setDate(to.getDate() - 6);
  else if (p === "30d") from.setDate(to.getDate() - 29);
  else if (p === "90d") from.setDate(to.getDate() - 89);
  else if (p === "mes") from = new Date(to.getFullYear(), to.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

interface Cell {
  leads: number;
  visitasAgendadas: number;
  visitasRealizadas: number;
  noShow: number;
  vendas: number;
}

const emptyCell: Cell = { leads: 0, visitasAgendadas: 0, visitasRealizadas: 0, noShow: 0, vendas: 0 };

function CellView({ c }: { c: Cell }) {
  const empty = c.leads + c.visitasAgendadas + c.visitasRealizadas + c.noShow + c.vendas === 0;
  if (empty) return <span className="text-muted-foreground/40">—</span>;
  return (
    <div className="text-[11px] leading-tight" title={`Leads: ${c.leads} · Ag: ${c.visitasAgendadas} · Real: ${c.visitasRealizadas} · No-show: ${c.noShow} · Vendas: ${c.vendas}`}>
      <div>{c.leads}L · {c.visitasAgendadas}A · {c.visitasRealizadas}R</div>
      <div className="text-muted-foreground">{c.noShow} n-s · <b className={c.vendas > 0 ? "text-emerald-600" : ""}>{c.vendas}V</b></div>
    </div>
  );
}

export function FocoDadosTab() {
  const { user } = useAuth();
  const { isAdmin, isDiretor } = useUserRole();
  const scope: "all" | "gerente" = isAdmin || isDiretor ? "all" : "gerente";
  const [preset, setPreset] = useState<Preset>("30d");
  const [empFilter, setEmpFilter] = useState("");

  const { from, to } = useMemo(() => presetRange(preset), [preset]);
  const empQ = useEmpreendimentosCanonicos();
  const corrQ = useCorretoresComAlocacao(scope, user?.id);
  const perfQ = useFocoPerformance(from, to);

  const empreendimentos = useMemo(() => {
    const list = empQ.data || [];
    const s = empFilter.trim().toLowerCase();
    return s ? list.filter((e) => e.nome.toLowerCase().includes(s)) : list;
  }, [empQ.data, empFilter]);

  // Constrói matriz corretor -> empreendimento -> cell
  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, Cell>>();
    for (const r of perfQ.data || []) {
      if (!r.empreendimento_id) continue;
      let byEmp = m.get(r.auth_user_id);
      if (!byEmp) {
        byEmp = new Map();
        m.set(r.auth_user_id, byEmp);
      }
      const cur = byEmp.get(r.empreendimento_id) || { ...emptyCell };
      cur.leads += r.leads;
      cur.visitasAgendadas += r.visitas_agendadas;
      cur.visitasRealizadas += r.visitas_realizadas;
      cur.noShow += r.no_shows;
      cur.vendas += r.vendas;
      byEmp.set(r.empreendimento_id, cur);
    }
    return m;
  }, [perfQ.data]);

  const corretores = corrQ.data || [];

  // Totais
  const totalByEmp = useMemo(() => {
    const t = new Map<string, Cell>();
    for (const emp of empreendimentos) t.set(emp.id, { ...emptyCell });
    for (const c of corretores) {
      const byEmp = matrix.get(c.user_id);
      if (!byEmp) continue;
      for (const emp of empreendimentos) {
        const cell = byEmp.get(emp.id);
        if (!cell) continue;
        const cur = t.get(emp.id)!;
        cur.leads += cell.leads;
        cur.visitasAgendadas += cell.visitasAgendadas;
        cur.visitasRealizadas += cell.visitasRealizadas;
        cur.noShow += cell.noShow;
        cur.vendas += cell.vendas;
      }
    }
    return t;
  }, [matrix, corretores, empreendimentos]);

  const totalByCorretor = useMemo(() => {
    const t = new Map<string, Cell>();
    for (const c of corretores) {
      const cur: Cell = { ...emptyCell };
      const byEmp = matrix.get(c.user_id);
      if (byEmp) {
        for (const emp of empreendimentos) {
          const cell = byEmp.get(emp.id);
          if (!cell) continue;
          cur.leads += cell.leads;
          cur.visitasAgendadas += cell.visitasAgendadas;
          cur.visitasRealizadas += cell.visitasRealizadas;
          cur.noShow += cell.noShow;
          cur.vendas += cell.vendas;
        }
      }
      t.set(c.user_id, cur);
    }
    return t;
  }, [matrix, corretores, empreendimentos]);

  const exportCsv = () => {
    const header = ["Corretor", "Equipe", ...empreendimentos.map((e) => e.nome), "TOTAL Leads", "TOTAL Vis.Real.", "TOTAL Vendas"];
    const rows = corretores.map((c) => {
      const byEmp = matrix.get(c.user_id) || new Map<string, Cell>();
      const t = totalByCorretor.get(c.user_id)!;
      const cells = empreendimentos.map((e) => {
        const cell = byEmp.get(e.id) || emptyCell;
        return `${cell.leads}L/${cell.visitasAgendadas}A/${cell.visitasRealizadas}R/${cell.noShow}NS/${cell.vendas}V`;
      });
      return [c.nome, c.equipe || "", ...cells, String(t.leads), String(t.visitasRealizadas), String(t.vendas)];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `foco-corretores-${from}-a-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (empQ.isLoading || corrQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <CardTitle className="text-sm">Performance corretor × empreendimento</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border overflow-hidden">
                {(["7d", "30d", "90d", "mes"] as Preset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className={cn(
                      "px-2.5 py-1 text-xs transition",
                      preset === p ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                    )}
                  >
                    {p === "mes" ? "Mês" : p}
                  </button>
                ))}
              </div>
              <Input
                value={empFilter}
                onChange={(e) => setEmpFilter(e.target.value)}
                placeholder="Filtrar empreendimento…"
                className="h-8 w-48 text-xs"
              />
              <Button variant="outline" size="sm" onClick={exportCsv} className="h-8 text-xs gap-1">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Período: {from} a {to} · Legenda: <b>L</b>eads · <b>A</b>gendadas · <b>R</b>ealizadas · <b>NS</b> no-show · <b>V</b>endas
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {perfQ.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <table className="text-xs w-max">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 sticky left-0 bg-muted/60 z-10 min-w-[180px]">Corretor</th>
                      {empreendimentos.map((e) => (
                        <th key={e.id} className="text-left px-2 py-2 whitespace-nowrap font-medium">
                          <div>{e.nome}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">{e.segmento_nome || "—"}</div>
                        </th>
                      ))}
                      <th className="text-left px-3 py-2 bg-primary/5 whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corretores.map((c) => {
                      const byEmp = matrix.get(c.user_id) || new Map<string, Cell>();
                      const t = totalByCorretor.get(c.user_id)!;
                      return (
                        <tr key={c.user_id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-1.5 sticky left-0 bg-background z-10 whitespace-nowrap">
                            <div className="font-medium">{c.nome}</div>
                            <div className="text-[10px] text-muted-foreground">{c.equipe || "—"}</div>
                          </td>
                          {empreendimentos.map((e) => (
                            <td key={e.id} className="px-2 py-1.5 border-l">
                              <CellView c={byEmp.get(e.id) || emptyCell} />
                            </td>
                          ))}
                          <td className="px-3 py-1.5 border-l bg-primary/5 whitespace-nowrap">
                            <div className="font-semibold">{t.leads}L · {t.visitasRealizadas}R</div>
                            <div className="text-[10px] text-muted-foreground">
                              <b className={t.vendas > 0 ? "text-emerald-600" : ""}>{t.vendas}V</b>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totais */}
                    <tr className="border-t bg-muted/50 font-semibold">
                      <td className="px-3 py-2 sticky left-0 bg-muted/70 z-10">Total</td>
                      {empreendimentos.map((e) => {
                        const t = totalByEmp.get(e.id) || emptyCell;
                        return (
                          <td key={e.id} className="px-2 py-2 border-l">
                            <CellView c={t} />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 border-l bg-primary/10" />
                    </tr>
                  </tbody>
                </table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
