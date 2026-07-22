import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2 } from "lucide-react";

export type PdnColKey = "data" | "empreendimento" | "vgv" | "corretor" | "status" | "obs";

export const PDN_COL_LABELS: Record<PdnColKey, string> = {
  data: "Data",
  empreendimento: "Empreendimento",
  vgv: "VGV",
  corretor: "Corretor",
  status: "Status",
  obs: "Observação",
};

export const PDN_DEFAULT_COLS: Record<PdnColKey, boolean> = {
  data: true, empreendimento: true, vgv: true, corretor: true, status: true, obs: true,
};

interface Props {
  cols: Record<PdnColKey, boolean>;
  onChange: (cols: Record<PdnColKey, boolean>) => void;
}

/** Popover que controla quais colunas da planilha PDN ficam visíveis. Nome é fixo. */
export function ColumnsMenu({ cols, onChange }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Configurar colunas">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Colunas visíveis</div>
        <div className="space-y-1">
          <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
            <Checkbox checked disabled />
            <span>Nome</span>
            <span className="ml-auto text-[10px]">fixo</span>
          </label>
          {(Object.keys(PDN_COL_LABELS) as PdnColKey[]).map(k => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox
                checked={cols[k]}
                onCheckedChange={(v) => onChange({ ...cols, [k]: v === true })}
              />
              <span>{PDN_COL_LABELS[k]}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 border-t pt-2">
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onChange({ ...PDN_DEFAULT_COLS })}>
            Restaurar padrão
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
