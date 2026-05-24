/**
 * ModoTimePlaceholder — Tab "Modo Time" do gestor (placeholder Fase 1).
 *
 * A implementação real é da Fase 2 (ModoTimeView).
 */
import { Users } from "lucide-react";

export default function ModoTimePlaceholder() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-12">
      <div className="max-w-md text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
          <Users className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Modo Time</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Em construção. Aqui você verá em uma tabela única todos os corretores do seu time, com
          leads, atrasados, em dia, negócios, VGV e alertas acionáveis.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Enquanto isso, troque para a aba <strong>Kanban</strong> para ver os leads do time.
        </p>
      </div>
    </div>
  );
}
