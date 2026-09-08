/**
 * EquipesViewPlaceholder — Tab "Equipes" do CEO (placeholder Fase 1).
 *
 * A implementação real é da Fase 3 (EquipesView).
 */
import { Building2 } from "lucide-react";

export default function EquipesViewPlaceholder() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-12">
      <div className="max-w-md text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
          <Building2 className="h-7 w-7 text-violet-600 dark:text-violet-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Equipes</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Em construção. Aqui você verá um dashboard executivo com KPIs globais do escritório,
          comparação entre gestores e drilldown por corretor.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Enquanto isso, use o filtro por gestor no topo e troque para a aba <strong>Kanban</strong>.
        </p>
      </div>
    </div>
  );
}
