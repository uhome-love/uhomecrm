import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowUpDown, Check } from "lucide-react";
import { STAGE_SORT_OPTIONS, DEFAULT_VIEW, type StageView } from "@/lib/stageViewPrefs";
import type { SubstatusOption } from "@/lib/leadHelpers";
import { cn } from "@/lib/utils";

interface Props {
  stageNome: string;
  view: StageView;
  opcoes: SubstatusOption[] | null;
  onChange: (v: StageView) => void;
}

export function StageSortFilterMenu({ stageNome, view, opcoes, onChange }: Props) {
  const ativo = view.sort !== "padrao" || view.sub.length > 0;
  const toggleSub = (v: string) =>
    onChange({ ...view, sub: view.sub.includes(v) ? view.sub.filter((s) => s !== v) : [...view.sub, v] });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ordenar e filtrar ${stageNome}`}
          title="Ordenar e filtrar esta etapa"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "p-1 rounded-md transition-colors",
            ativo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-primary",
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ordenar esta etapa
        </div>
        {STAGE_SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange({ ...view, sort: o.value })}
            className={cn(
              "w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted",
              view.sort === o.value && "text-primary font-semibold",
            )}
          >
            {o.label}
            {view.sort === o.value && <Check className="h-3.5 w-3.5" />}
          </button>
        ))}
        {opcoes && (
          <>
            <div className="px-1 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mostrar só
            </div>
            {opcoes.map((o) => {
              const on = view.sub.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggleSub(o.value)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted text-left",
                    on && "text-primary font-semibold",
                  )}
                >
                  <span className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center", on ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </>
        )}
        {ativo && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_VIEW)}
            className="mt-2 w-full rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 text-left"
          >
            Limpar
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
