import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/fmtMoney";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import type { MetasMes, PaceMes } from "@/hooks/useMetasSSOT";

interface Props {
  realizado: number;
  metas?: MetasMes;
  pace?: PaceMes;
  loading?: boolean;
}

const FONTE_LABEL: Record<MetasMes["fonte"], string> = {
  equipe: "meta da equipe",
  soma_equipes: "soma das metas das equipes",
  empresa: "meta da empresa",
  nenhuma: "sem meta cadastrada",
};

export default function PerfMetaCard({ realizado, metas, pace, loading }: Props) {
  const meta = metas?.meta_vgv ?? 0;
  const temMeta = meta > 0;
  const pctMeta = temMeta ? (realizado / meta) * 100 : 0;
  const faltam = Math.max(0, meta - realizado);

  const fracao = pace?.fracao ?? 1;
  const esperado = temMeta ? meta * fracao : 0;
  const projecao = pace && pace.fracao > 0 ? realizado / pace.fracao : realizado;
  const noPace = temMeta ? realizado >= esperado : false;
  const desvioPct = esperado > 0 ? ((realizado - esperado) / esperado) * 100 : 0;

  if (loading) {
    return <div className="bg-card border border-border rounded-xl p-6 h-[132px] animate-pulse" />;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> Meta do mês · VGV assinado
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <h2 className="text-3xl font-bold text-foreground tabular-nums">{fmtMoney(realizado, "short")}</h2>
            <span className="text-sm text-muted-foreground">
              de {temMeta ? fmtMoney(meta, "short") : "—"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {FONTE_LABEL[metas?.fonte ?? "nenhuma"]}
            {pace ? ` · ${pace.uteisDecorridos}/${pace.uteisTotal} dias úteis` : ""}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Faltam</span>
            <p className="text-lg font-bold text-foreground tabular-nums">{temMeta ? fmtMoney(faltam, "short") : "—"}</p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Projeção</span>
            <p className="text-lg font-bold text-foreground tabular-nums">{fmtMoney(projecao, "short")}</p>
          </div>
          {temMeta && (
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold",
                noPace ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}
            >
              {noPace ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {noPace ? "No ritmo" : "Abaixo do ritmo"}
              <span className="opacity-70">
                {desvioPct >= 0 ? "+" : ""}
                {desvioPct.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-5 h-2.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", noPace || !temMeta ? "bg-primary" : "bg-destructive")}
          style={{ width: `${Math.max(0, Math.min(100, pctMeta))}%` }}
        />
        {temMeta && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/60"
            style={{ left: `${Math.min(100, fracao * 100)}%` }}
            title="ritmo esperado para hoje"
          />
        )}
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{temMeta ? `${pctMeta.toFixed(0)}% da meta` : "Cadastre a meta do mês"}</span>
        {temMeta && <span>ritmo esperado hoje: {(fracao * 100).toFixed(0)}%</span>}
      </div>
    </div>
  );
}
