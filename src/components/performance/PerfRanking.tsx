import { useMemo, useState } from "react";
import { fmtMoney } from "@/lib/fmtMoney";
import { agruparPorEquipe, type MetricaCorretor } from "@/lib/metricasSSOT";
import { cn } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";

type Coluna = "vgv_assinado" | "vendas" | "visitas_realizadas" | "leads_recebidos";

interface Props {
  linhas: MetricaCorretor[];
  loading?: boolean;
}

const COLS: { key: Coluna; label: string }[] = [
  { key: "leads_recebidos", label: "Leads" },
  { key: "visitas_realizadas", label: "Visitas" },
  { key: "vendas", label: "Vendas" },
  { key: "vgv_assinado", label: "VGV assinado" },
];

export default function PerfRanking({ linhas, loading }: Props) {
  const [ordem, setOrdem] = useState<Coluna>("vgv_assinado");

  const ordenadas = useMemo(
    () => [...linhas].sort((a, b) => (b[ordem] as number) - (a[ordem] as number)),
    [linhas, ordem]
  );
  const equipes = useMemo(() => agruparPorEquipe(linhas), [linhas]);
  const maxVgv = Math.max(1, ...equipes.map((e) => e.totais.vgv_assinado));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 pb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-foreground">Ranking de corretores</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Parcerias rateadas 50/50 · desligados mantêm histórico</p>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" /> ordenar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border bg-muted/40">
                <th className="text-left font-semibold py-2.5 pl-6 w-10">#</th>
                <th className="text-left font-semibold py-2.5">Corretor</th>
                <th className="text-left font-semibold py-2.5">Equipe</th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-right font-semibold py-2.5 pr-6 last:pr-6">
                    <button
                      onClick={() => setOrdem(c.key)}
                      className={cn("hover:text-foreground transition-colors", ordem === c.key && "text-primary")}
                    >
                      {c.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td colSpan={7} className="py-3 px-6">
                      <div className="h-5 rounded bg-muted animate-pulse" />
                    </td>
                  </tr>
                ))}

              {!loading && ordenadas.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum dado no período selecionado.
                  </td>
                </tr>
              )}

              {!loading &&
                ordenadas.map((l, i) => (
                  <tr key={l.corretor_auth_id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                    <td className={cn("py-3 pl-6 font-bold tabular-nums", i === 0 ? "text-primary" : "text-muted-foreground")}>{i + 1}</td>
                    <td className="py-3 font-semibold text-foreground">
                      {l.corretor_nome || "Sem nome"}
                      {!l.corretor_ativo && (
                        <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inativo</span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">{l.equipe || "—"}</td>
                    <td className="py-3 text-right tabular-nums">{l.leads_recebidos}</td>
                    <td className="py-3 text-right tabular-nums">{l.visitas_realizadas}</td>
                    <td className="py-3 text-right tabular-nums">{l.vendas}</td>
                    <td className="py-3 pr-6 text-right font-bold tabular-nums text-foreground">{fmtMoney(l.vgv_assinado, "short")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-bold text-lg text-foreground mb-6">Equipes</h3>
        <div className="space-y-5">
          {loading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}
          {!loading && equipes.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          {!loading &&
            equipes.map((e) => (
              <div key={e.equipe}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm font-semibold text-foreground">{e.equipe}</span>
                  <span className="text-sm font-bold tabular-nums text-foreground">{fmtMoney(e.totais.vgv_assinado, "short")}</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(e.totais.vgv_assinado / maxVgv) * 100}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {e.totais.vendas} vendas · {e.totais.visitas_realizadas} visitas · {e.membros.length} corretores
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
