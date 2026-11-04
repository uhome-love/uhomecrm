import { CampoDataBR } from "@/components/filtros/CampoDataBR";
import { Button } from "@/components/ui/button";

interface Props {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  error: string | null;
}

/** Desktop presentation; the page continues to own draft and applied dates. */
export function VisitasPeriodoPersonalizado({ from, to, onFromChange, onToChange, onApply, error }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end flex-wrap gap-3">
        <div className="w-48"><CampoDataBR id="visitas-de" label="De" value={from} onChange={onFromChange} max={to || undefined} /></div>
        <div className="w-48"><CampoDataBR id="visitas-ate" label="Até" value={to} onChange={onToChange} min={from || undefined} /></div>
        <Button disabled={!from || !to || !!error} onClick={onApply} className="h-10 duration-short ease-move">Aplicar</Button>
      </div>
      {error && <p className="text-[11px] text-danger-500 px-1">{error}</p>}
    </div>
  );
}