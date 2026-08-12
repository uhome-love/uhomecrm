/**
 * CorretorMiniCard — Nível 3 da aba Equipes: card de um corretor dentro do
 * drilldown de um gestor. Click → abre Kanban filtrado por esse corretor.
 */
import { ChevronRight } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { HealthBar, type EquipesSaudeKey } from "./EscritorioKpiHeader";
import type { EquipesCorretor } from "@/hooks/useEquipesView";

interface Props {
  corretor: EquipesCorretor;
  onClick: () => void;
}

export default function CorretorMiniCard({ corretor, onClick }: Props) {
  const counts: Record<EquipesSaudeKey, number> = {
    em_dia: corretor.em_dia, atencao: corretor.atencao, desatualizado: corretor.desatualizado, estagnado: corretor.estagnado,
  };
  const acao = corretor.atencao + corretor.desatualizado + corretor.estagnado;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 hover:border-slate-300 dark:hover:border-gray-600 hover:shadow-sm transition flex items-center gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {corretor.nome ?? "—"}
          </span>
          <span className="ml-auto shrink-0 text-[10px] text-slate-400 whitespace-nowrap">
            {corretor.ultima_atividade ? formatBRT(corretor.ultima_atividade, "dd/MM HH:mm") : "—"}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{corretor.leads_ativos} leads</span>
          <span className={acao > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
            {acao} p/ ação
          </span>
          <span>{corretor.negocios} neg.</span>
        </div>
        <div className="mt-1.5"><HealthBar counts={counts} h="h-1.5" /></div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
    </button>
  );
}
