import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Item { empreendimento: string; total: number }

interface Props {
  options: Item[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export default function EmpreendimentoMultiSelect({ options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const total = useMemo(
    () => options.reduce((s, o) => s + o.total, 0),
    [options]
  );

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> Empreendimento
          {selected.length > 0 && (
            <Badge variant="outline" className="text-[9px]">{selected.length} selecionado{selected.length > 1 ? "s" : ""}</Badge>
          )}
        </label>
        {selected.length > 0 && (
          <button
            type="button"
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
            onClick={() => onChange([])}
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full h-9 justify-between font-normal">
            <span className="truncate text-left">
              {selected.length === 0
                ? `Todos (${total.toLocaleString("pt-BR")} leads)`
                : selected.length === 1
                  ? selected[0]
                  : `${selected.length} empreendimentos`}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar empreendimento…" />
            <CommandList>
              <CommandEmpty>Nenhum empreendimento nesta base.</CommandEmpty>
              {selected.length > 0 && (
                <>
                  <CommandGroup>
                    <CommandItem onSelect={() => onChange([])}>
                      <span className="text-xs text-muted-foreground">Limpar seleção ({selected.length})</span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              <CommandGroup heading={`${options.length} empreendimentos · ${total.toLocaleString("pt-BR")} leads`}>
                {options.map((o) => {
                  const checked = selected.includes(o.empreendimento);
                  return (
                    <CommandItem
                      key={o.empreendimento}
                      value={o.empreendimento}
                      onSelect={() => toggle(o.empreendimento)}
                    >
                      <Check className={cn("h-3.5 w-3.5 mr-2", checked ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{o.empreendimento}</span>
                      <Badge variant="outline" className="text-[9px] tabular-nums">{o.total.toLocaleString("pt-BR")}</Badge>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px] gap-1">
              {s}
              <button type="button" onClick={() => toggle(s)} className="hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
