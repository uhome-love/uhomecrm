import { useMemo, useState } from "react";
import { BarChart3, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/fmtMoney";
import type { FunilLinha } from "@/hooks/useFunilPerformance";
import { aproveitamentoPorCorretor, aproveitamentoPorEquipe, type AproveitamentoLinha } from "./perfData";

export type AprovTab = "equipe" | "corretor";

interface Props {
  linhas: FunilLinha[];
  tabs: AprovTab[];
  loading: boolean;
  onDrill?: (tab: AprovTab, linha: AproveitamentoLinha) => void;
}

const LABEL: Record<AprovTab, string> = { equipe: "Por equipe", corretor: "Por corretor" };

function rateTone(v: number) {
  return v >= 15 ? "bg-success-500/12 text-success-700 dark:text-success-500"
    : v >= 5 ? "bg-warning-500/14 text-warning-700 dark:text-warning-500"
    : "bg-danger-500/12 text-danger-500";
}
function Rate({ v }: { v: number }) {
  return <span className={cn("inline-flex min-w-[52px] justify-center rounded-md px-2 py-1 text-[11.5px] font-bold tabular-nums", rateTone(v))}>{v.toFixed(1)}%</span>;
}

export function PerfAproveitamento({ linhas, tabs, loading, onDrill }: Props) {
  const [tab, setTab] = useState<AprovTab>(tabs[0]);
  const active = tabs.includes(tab) ? tab : tabs[0];

  const rows = useMemo(
    () => (active === "equipe" ? aproveitamentoPorEquipe(linhas) : aproveitamentoPorCorretor(linhas)),
    [active, linhas]
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <BarChart3 className="h-4 w-4 text-primary" strokeWidth={2} />
          Aproveitamento dos leads
        </span>
        {tabs.length > 1 && (
          <div className="inline-flex rounded-lg bg-muted p-0.5">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1 text-[12px] font-semibold transition-colors",
                  active === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {LABEL[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-4"><Skeleton className="h-48 w-full rounded-xl" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                {[LABEL[active].replace("Por ", ""), "Leads", "Visitas", "Vendas", "Lead→Visita", "Visita→Venda", ""].map((h, i) => (
                  <th key={i} className={cn("px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground", i === 0 ? "text-left" : "text-right", i === 6 && "w-8")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onDrill?.(active, r)}
                  className={cn("border-b border-border/60 last:border-0", onDrill && "cursor-pointer hover:bg-muted/40")}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-semibold capitalize text-foreground">{r.nome}</div>
                    {r.sub && <div className="text-[11px] text-muted-foreground">{r.sub}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{r.leads}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{r.visitas}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-foreground">
                    {r.vendas}
                    {r.vgv > 0 && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{fmtMoney(r.vgv, "short")}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right"><Rate v={r.leadVisita} /></td>
                  <td className="px-3 py-2.5 text-right"><Rate v={r.visitaVenda} /></td>
                  <td className="px-2 text-right">{onDrill && <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
