/**
 * CorretorMiniCard — Nível 3 da aba Equipes: card de um corretor dentro do
 * drilldown de um gestor. Click → abre Kanban filtrado por esse corretor.
 */
import { ChevronRight } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import type { EquipesCorretor } from "@/hooks/useEquipesView";

interface Props {
  corretor: EquipesCorretor;
  onClick: () => void;
}

function ultimaAtividadeLabel(iso: string | null): string {
  if (!iso) return "sem atividade";
  return `há ${formatBRT(iso, "dd/MM")}`;
}

export default function CorretorMiniCard({ corretor, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 hover:border-slate-300 dark:hover:border-gray-600 hover:shadow-sm transition flex items-center gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
          {corretor.nome ?? "—"}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{corretor.leads_ativos} leads</span>
          <span className={corretor.atrasados > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
            {corretor.atrasados} atras.
          </span>
          <span>{corretor.negocios} neg.</span>
        </div>
      </div>
      <div className="text-[10px] text-slate-400 whitespace-nowrap">
        {corretor.ultima_atividade ? formatBRT(corretor.ultima_atividade, "dd/MM HH:mm") : "—"}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
    </button>
  );
}
