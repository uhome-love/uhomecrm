import { useMemo, useState } from "react";
import { fmtMoney } from "@/lib/fmtMoney";
import { agruparPorEquipe, type MetricaCorretor } from "@/lib/metricasSSOT";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";

type Coluna = "vgv_assinado" | "vendas" | "visitas_realizadas" | "leads_recebidos" | "conversao";

interface Props {
  linhas: MetricaCorretor[];
  loading?: boolean;
  onSelectCorretor?: (linha: MetricaCorretor) => void;
}

const COLS: { key: Coluna; label: string }[] = [
  { key: "leads_recebidos", label: "Leads" },
  { key: "visitas_realizadas", label: "Visitas" },
  { key: "conversao", label: "Conv." },
  { key: "vendas", label: "Vendas" },
  { key: "vgv_assinado", label: "VGV assinado" },
];

const conv = (l: MetricaCorretor) => (l.visitas_realizadas > 0 ? (l.vendas / l.visitas_realizadas) * 100 : 0);
const valor = (l: MetricaCorretor, c: Coluna) => (c === "conversao" ? conv(l) : (l[c] as number));

export default function PerfRanking({ linhas, loading, onSelectCorretor }: Props) {
  const [ordem, setOrdem] = useState<Coluna>("vgv_assinado");
  const [desc, setDesc] = useState(true);
  const [busca, setBusca] = useState("");

  const alternarOrdem = (c: Coluna) => {
    if (c === ordem) setDesc((d) => !d);
    else {
      setOrdem(c);
      setDesc(true);
    }
  };

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter((l) => (l.corretor_nome || "").toLowerCase().includes(q) || (l.equipe || "").toLowerCase().includes(q));
  }, [linhas, busca]);

  const ordenadas = useMemo(
    () => [...filtradas].sort((a, b) => (desc ? valor(b, ordem) - valor(a, ordem) : valor(a, ordem) - valor(b, ordem))),
    [filtradas, ordem, desc]
  );

  const totais = useMemo(
    () =>
      ordenadas.reduce(
        (acc, l) => ({
          leads: acc.leads + l.leads_recebidos,
          visitas: acc.visitas + l.visitas_realizadas,
          vendas: acc.vendas + l.vendas,
          vgv: acc.vgv + l.vgv_assinado,
        }),
        { leads: 0, visitas: 0, vendas: 0, vgv: 0 }
      ),
    [ordenadas]
  );
  const convTotal = totais.visitas > 0 ? (totais.vendas / totais.visitas) * 100 : 0;

  const equipes = useMemo(() => agruparPorEquipe(linhas), [linhas]);
  const maxVgv = Math.max(1, ...equipes.map((e) => e.totais.vgv_assinado));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 pb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg text-foreground">Ranking de corretores</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Parcerias rateadas 50/50 · desligados mantêm histórico</p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar corretor ou equipe"
              className="h-8 w-full sm:w-56 pl-8 pr-3 text-xs rounded-lg bg-muted/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden px-4 pb-4 space-y-2">
          {loading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
          {!loading && ordenadas.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum dado no período selecionado.</p>
          )}
          {!loading &&
            ordenadas.map((l, i) => (
              <button
                key={l.corretor_auth_id}
                onClick={() => onSelectCorretor?.(l)}
                className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={cn("text-xs font-bold tabular-nums", i === 0 ? "text-primary" : "text-muted-foreground")}>{i + 1}</span>
                    <span className="font-semibold text-sm text-foreground truncate">{l.corretor_nome || "Sem nome"}</span>
                    {!l.corretor_ativo && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inativo</span>
                    )}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-foreground shrink-0">{fmtMoney(l.vgv_assinado, "short")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {l.equipe || "—"} · {l.leads_recebidos} leads · {l.visitas_realizadas} visitas · {l.vendas} vendas · {conv(l).toFixed(1)}% conv.
                </p>
              </button>
            ))}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border bg-muted/40">
                <th className="text-left font-semibold py-2.5 pl-6 w-10">#</th>
                <th className="text-left font-semibold py-2.5">Corretor</th>
                <th className="text-left font-semibold py-2.5">Equipe</th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-right font-semibold py-2.5 pr-6 last:pr-6">
                    <button
                      onClick={() => alternarOrdem(c.key)}
                      title={ordem === c.key ? (desc ? "Maior → menor" : "Menor → maior") : "Ordenar por esta coluna"}
                      className={cn("hover:text-foreground transition-colors inline-flex items-center gap-1", ordem === c.key && "text-primary")}
                    >
                      {c.label}
                      {ordem === c.key ? (
                        desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </button>
                  </th>
                ))}

              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td colSpan={8} className="py-3 px-6">
                      <div className="h-5 rounded bg-muted animate-pulse" />
                    </td>
                  </tr>
                ))}

              {!loading && ordenadas.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum dado no período selecionado.
                  </td>
                </tr>
              )}

              {!loading &&
                ordenadas.map((l, i) => (
                  <tr
                    key={l.corretor_auth_id}
                    onClick={() => onSelectCorretor?.(l)}
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-muted/40 transition-colors",
                      onSelectCorretor && "cursor-pointer"
                    )}
                  >
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
                    <td className="py-3 text-right tabular-nums text-muted-foreground">{conv(l).toFixed(1)}%</td>
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
