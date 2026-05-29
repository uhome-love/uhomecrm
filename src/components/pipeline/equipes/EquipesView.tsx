/**
 * EquipesView — Aba "Equipes" do Pipeline (visão CEO/Admin).
 *
 * 3 níveis:
 *  1) EscritorioKpiHeader — KPIs globais
 *  2) GestorCard          — 3 gestores lado a lado (colapsados por padrão)
 *  3) CorretorMiniCard    — drilldown; click → Kanban filtrado por corretor
 */
import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEquipesView } from "@/hooks/useEquipesView";
import EscritorioKpiHeader from "./EscritorioKpiHeader";
import GestorCard from "./GestorCard";
import CorretorMiniCard from "./CorretorMiniCard";

interface Props {
  /** Abre o Kanban filtrado pelo corretor (auth_id). */
  onOpenKanban: (corretorAuthId: string) => void;
}

export default function EquipesView({ onOpenKanban }: Props) {
  const { data, isLoading, isError, refetch } = useEquipesView();
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // colapsado por padrão

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl bg-slate-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-12">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-500" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Não foi possível carregar a visão de equipes.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400"
          >
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
      <EscritorioKpiHeader escritorio={data.escritorio} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {data.gestores.map((g) => (
          <GestorCard
            key={g.auth_id}
            gestor={g}
            expanded={expanded.has(g.auth_id)}
            onToggle={() => toggle(g.auth_id)}
          >
            {g.corretores.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic px-1">Nenhum corretor no time.</p>
            ) : (
              g.corretores.map((c) => (
                <CorretorMiniCard key={c.auth_id} corretor={c} onClick={() => onOpenKanban(c.auth_id)} />
              ))
            )}
          </GestorCard>
        ))}
      </div>
    </div>
  );
}
