import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { safeGet } from "./safeGet";
import type { FunilVis } from "./funilTypes";

/**
 * FunilEtapas — funil de 6 etapas do pipeline (controlado por `vis`):
 *  - "coorte": leads que ENTRARAM no período e até onde avançaram (safra do período).
 *  - "periodo_todo": todo o pipeline ativo acumulado (todas as safras).
 * Na coorte, mostra comparativo vs. período anterior no topo do funil.
 */

const STAGE_DEFS = [
  { key: "leads", label: "Leads recebidos" },
  { key: "atendimento", label: "Atendimento" },
  { key: "visita", label: "Visita" },
  { key: "pos_visita", label: "Pós-visita" },
  { key: "em_negociacao", label: "Em negociação" },
  { key: "venda", label: "Venda" },
] as const;

interface Stage {
  label: string;
  value: number;
}

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
  vis: FunilVis;
}

function readStages(obj: Record<string, unknown> | undefined): Stage[] {
  return STAGE_DEFS.map((d) => ({
    label: d.label,
    value: Number(safeGet<number>(obj ?? {}, d.key, `Funil ${d.key}`) ?? 0),
  }));
}

export function FunilEtapas({ query, vis }: Props) {
  const loading = query.isLoading && !query.data;
  const data = query.data;

  const coorte = safeGet<Record<string, unknown>>(data ?? {}, "coorte", "Funil coorte");
  const periodo = safeGet<Record<string, unknown>>(data ?? {}, "periodo_todo", "Funil periodo_todo");
  const coortePrev = safeGet<Record<string, unknown>>(data ?? {}, "coorte_prev", "Funil coorte_prev");

  const active = vis === "coorte" ? coorte : periodo;
  const stages = readStages(active);
  const max = Math.max(...stages.map((s) => s.value), 1);
  const allZero = stages.every((s) => !s.value);

  // comparativo de leads no topo (só a coorte tem período anterior comparável)
  const leadsNow = stages[0]?.value ?? 0;
  const leadsPrev = Number(safeGet<number>(coortePrev ?? {}, "leads", "Funil prev leads") ?? 0);
  const hasCompare = vis === "coorte" && coortePrev != null && leadsPrev > 0;
  const deltaPct = hasCompare ? Math.round(((leadsNow - leadsPrev) / leadsPrev) * 100) : null;

  return (
    <div className="central-card overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">Funil por etapa</span>
        <span className="text-xs text-muted-foreground">
          {vis === "coorte"
            ? "Leads que entraram no período e até onde avançaram"
            : "Todo o pipeline ativo (todas as safras)"}
        </span>
      </div>

      {deltaPct != null ? (
        <div className="flex items-center gap-2 px-4 pt-3 text-xs text-muted-foreground">
          <span>vs. período anterior ({leadsPrev.toLocaleString("pt-BR")} leads):</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 font-semibold",
              deltaPct > 0
                ? "bg-success/10 text-success"
                : deltaPct < 0
                  ? "bg-danger-500/10 text-danger-500"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {deltaPct > 0 ? "▲ +" : deltaPct < 0 ? "▼ " : ""}
            {deltaPct}%
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 p-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : allZero ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Sem movimentação no período.
          </div>
        ) : (
          stages.map((s, i) => {
            const pct = Math.max((s.value / max) * 100, s.value > 0 ? 6 : 0);
            const prev = i > 0 ? stages[i - 1].value : null;
            const conv = prev && prev > 0 ? (s.value / prev) * 100 : null;
            return (
              <div key={s.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="flex items-center gap-2">
                    {conv != null ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          conv >= 50
                            ? "bg-success/10 text-success"
                            : conv >= 20
                              ? "bg-warning-500/10 text-warning-600"
                              : "bg-danger-500/10 text-danger-500"
                        )}
                      >
                        {conv.toFixed(0)}%
                      </span>
                    ) : null}
                    <span className="font-semibold tabular-nums text-foreground">
                      {s.value.toLocaleString("pt-BR")}
                    </span>
                  </span>
                </div>
                <div className="h-7 w-full overflow-hidden rounded-lg bg-muted/50">
                  <div
                    className="h-full rounded-lg bg-gradient-to-r from-primary to-primary/70 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
