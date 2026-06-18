/**
 * ModoTimeAlertas — até 3 cards de alerta clicáveis no topo do Modo Time.
 */
import { cn } from "@/lib/utils";
import type { Alerta, AlertaAction } from "@/hooks/useTimeAlertas";

interface Props {
  alertas: Alerta[];
  onActionClick: (action: AlertaAction) => void;
}

export default function ModoTimeAlertas({ alertas, onActionClick }: Props) {
  if (alertas.length === 0) return null;

  return (
    <div className="flex gap-2">
      {alertas.map((alerta) => (
        <button
          key={alerta.id}
          type="button"
          onClick={() => onActionClick(alerta.action)}
          className={cn(
            "flex-1 p-3 rounded-md border-l-[3px] text-left transition-all hover:-translate-y-0.5 hover:shadow-sm bg-white border border-neutral-200",
            alerta.tipo === "red" && "border-l-red-600 bg-red-50/40",
            alerta.tipo === "amber" && "border-l-amber-600 bg-amber-50/40",
            alerta.tipo === "blue" && "border-l-indigo-600 bg-indigo-50/40",
          )}
        >
          <div className="text-sm mb-1">{alerta.icone}</div>
          <div className="text-xs font-medium text-[#0A0E1A] leading-tight mb-0.5">
            {alerta.texto}
          </div>
          <div className="text-[10px] text-primary font-semibold">Ver detalhes →</div>
        </button>
      ))}
    </div>
  );
}
