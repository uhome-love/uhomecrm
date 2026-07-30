import { useMemo, useState } from "react";
import { fmtMoney } from "@/lib/fmtMoney";
import { cn } from "@/lib/utils";
import type { MetricaOrigem } from "@/hooks/useMetricasOrigem";
import { useCustoCampanha } from "@/hooks/useCustoCampanha";

interface Props {
  dados: MetricaOrigem[];
  loading?: boolean;
  start: string;
  end: string;
}

type Modo = "origem" | "campanha";

interface Linha {
  chave: string;
  leads: number;
  visitas_realizadas: number;
  vendas: number;
  vgv_assinado: number;
  investimento?: number;
}

export default function PerfOrigem({ dados, loading, start, end }: Props) {
  const [modo, setModo] = useState<Modo>("origem");
  const { data: custos = {}, isLoading: custoLoading } = useCustoCampanha(start, end, modo === "campanha");

  const linhas = useMemo<Linha[]>(() => {
    const mapa = new Map<string, Linha>();
    for (const d of dados) {
      const chave = modo === "origem" ? d.origem : `${d.campanha}`;
      const atual = mapa.get(chave) ?? { chave, leads: 0, visitas_realizadas: 0, vendas: 0, vgv_assinado: 0 };
      atual.leads += d.leads;
      atual.visitas_realizadas += d.visitas_realizadas;
      atual.vendas += d.vendas;
      atual.vgv_assinado += d.vgv_assinado;
      mapa.set(chave, atual);
    }
    const lista = [...mapa.values()];
    if (modo === "campanha") {
      for (const l of lista) l.investimento = custos[l.chave] ?? 0;
    }
    return lista.sort((a, b) => b.vgv_assinado - a.vgv_assinado || b.leads - a.leads);
  }, [dados, modo, custos]);

  const maxLeads = Math.max(1, ...linhas.map((l) => l.leads));
  const comCusto = modo === "campanha";
  const investTotal = comCusto ? linhas.reduce((s, l) => s + (l.investimento ?? 0), 0) : 0;
  const cols = comCusto ? 9 : 6;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 md:p-6 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-lg text-foreground">Funil por {comCusto ? "campanha" : "origem"}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Coorte: leads que entraram no período, acompanhados até visita e venda
            {comCusto && ` · investimento do período: ${fmtMoney(investTotal, "short")}`}
          </p>
        </div>
        <div className="flex bg-muted/60 p-1 rounded-lg border border-border">
          {(["origem", "campanha"] as Modo[]).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-colors capitalize",
                modo === m ? "bg-card shadow-sm text-primary font-semibold" : "text-muted-foreground hover:text-foreground font-medium"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border bg-muted/40">
              <th className="text-left font-semibold py-2.5 pl-6 capitalize">{modo}</th>
              <th className="text-right font-semibold py-2.5">Leads</th>
              <th className="text-right font-semibold py-2.5">Visitas</th>
              <th className="text-right font-semibold py-2.5">Lead→visita</th>
              <th className="text-right font-semibold py-2.5">Vendas</th>
              {comCusto && <th className="text-right font-semibold py-2.5">Investido</th>}
              {comCusto && <th className="text-right font-semibold py-2.5">CPL</th>}
              {comCusto && <th className="text-right font-semibold py-2.5">ROAS</th>}
              <th className="text-right font-semibold py-2.5 pr-6">VGV</th>
            </tr>
          </thead>
          <tbody>
            {(loading || (comCusto && custoLoading)) &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td colSpan={cols} className="py-3 px-6">
                    <div className="h-5 rounded bg-muted animate-pulse" />
                  </td>
                </tr>
              ))}

            {!loading && !(comCusto && custoLoading) && linhas.length === 0 && (
              <tr>
                <td colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum lead no período selecionado.
                </td>
              </tr>
            )}

            {!loading &&
              !(comCusto && custoLoading) &&
              linhas.map((l) => {
                const conv = l.leads > 0 ? (l.visitas_realizadas / l.leads) * 100 : 0;
                const inv = l.investimento ?? 0;
                const cpl = inv > 0 && l.leads > 0 ? inv / l.leads : null;
                const roas = inv > 0 ? l.vgv_assinado / inv : null;
                return (
                  <tr key={l.chave} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="py-3 pl-6 max-w-[260px]">
                      <span className="font-medium text-foreground block truncate">{l.chave}</span>
                      <span className="block h-1 mt-1.5 rounded-full bg-primary/70" style={{ width: `${(l.leads / maxLeads) * 100}%` }} />
                    </td>
                    <td className="py-3 text-right tabular-nums">{l.leads}</td>
                    <td className="py-3 text-right tabular-nums">{l.visitas_realizadas}</td>
                    <td
                      className={cn(
                        "py-3 text-right tabular-nums font-medium",
                        l.leads >= 20 && conv === 0 ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {conv.toFixed(1)}%
                    </td>
                    <td className="py-3 text-right tabular-nums">{l.vendas % 1 === 0 ? l.vendas : l.vendas.toFixed(1)}</td>
                    {comCusto && (
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        {inv > 0 ? fmtMoney(inv, "short") : "—"}
                      </td>
                    )}
                    {comCusto && (
                      <td className={cn("py-3 text-right tabular-nums font-medium", cpl && cpl > 100 ? "text-destructive" : "text-foreground")}>
                        {cpl ? fmtMoney(cpl, "short") : "—"}
                      </td>
                    )}
                    {comCusto && (
                      <td className={cn("py-3 text-right tabular-nums font-medium", roas !== null && roas === 0 ? "text-destructive" : "text-foreground")}>
                        {roas !== null ? `${roas.toFixed(1)}x` : "—"}
                      </td>
                    )}
                    <td className="py-3 pr-6 text-right font-bold tabular-nums text-foreground">{fmtMoney(l.vgv_assinado, "short")}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {comCusto && (
        <p className="px-6 py-3 text-[11px] text-muted-foreground border-t border-border">
          Investimento vem dos dados diários do Meta no período. CPL e ROAS comparam gasto do período com a coorte de leads
          do mesmo período — ciclos longos podem ter venda assinada fora da janela.
        </p>
      )}
    </div>
  );
}
