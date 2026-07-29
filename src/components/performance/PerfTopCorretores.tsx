import { fmtMoney } from "@/lib/fmtMoney";
import type { MetricaCorretor } from "@/lib/metricasSSOT";
import { cn } from "@/lib/utils";

interface Props {
  linhas: MetricaCorretor[];
  totalCorretores: number;
  loading?: boolean;
  onVerTudo: () => void;
}

export default function PerfTopCorretores({ linhas, totalCorretores, loading, onVerTudo }: Props) {
  const top = [...linhas].sort((a, b) => b.vgv_assinado - a.vgv_assinado).slice(0, 5);

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg text-foreground">Top Corretores</h3>
        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
          {totalCorretores} corretores
        </span>
      </div>

      <div className="space-y-5 flex-1">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}

        {!loading && top.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum resultado no período.</p>
        )}

        {!loading &&
          top.map((l, i) => (
            <div key={l.corretor_auth_id} className="flex items-center gap-4">
              <div
                className={cn(
                  "w-8 h-8 flex items-center justify-center font-bold rounded-full text-sm shrink-0",
                  i === 0 ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted"
                )}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">
                  {l.corretor_nome || "Sem nome"}
                  {!l.corretor_ativo && (
                    <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground align-middle">
                      inativo
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtMoney(l.vgv_assinado, "short")} • {l.vendas} venda{l.vendas === 1 ? "" : "s"}
                </p>
              </div>
              <div className={cn("w-2 h-2 rounded-full shrink-0", l.vendas > 0 ? "bg-success" : "bg-border")} />
            </div>
          ))}
      </div>

      <button
        onClick={onVerTudo}
        className="w-full mt-8 py-3 text-sm font-semibold text-primary border border-primary/20 rounded-xl hover:bg-primary/5 transition-all"
      >
        Ver ranking completo
      </button>
    </div>
  );
}
