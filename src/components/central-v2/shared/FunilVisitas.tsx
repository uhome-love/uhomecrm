import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { FunilEtapas } from "./FunilEtapas";
import { VisitasPanel } from "./VisitasPanel";
import type { FunilVis } from "./funilTypes";

/**
 * FunilVisitas — funil por etapa + painel de visitas, controlados por um
 * único toggle (safra da coorte × período/pipeline todo).
 */

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

export function FunilVisitas({ query }: Props) {
  const [vis, setVis] = useState<FunilVis>("coorte");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Funil & Visitas</h2>
        <div className="inline-flex shrink-0 rounded-lg bg-muted/60 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setVis("coorte")}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium transition-colors",
              vis === "coorte"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Safra do período
          </button>
          <button
            type="button"
            onClick={() => setVis("periodo_todo")}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium transition-colors",
              vis === "periodo_todo"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Todo o período
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FunilEtapas query={query} vis={vis} />
        <VisitasPanel query={query} vis={vis} />
      </div>
    </div>
  );
}
