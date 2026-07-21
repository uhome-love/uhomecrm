import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface EmpreendimentoOption {
  id: string;
  nome: string;
  segmento?: string | null;
}

interface Props {
  options: EmpreendimentoOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  triggerLabel?: string;
}

/**
 * Multi-select em popover com busca + checkboxes.
 * Usado na aba Alocação de /foco-corretores.
 */
export function EmpreendimentoMultiSelect({ options, value, onChange, disabled, triggerLabel = "+ Empreendimento" }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.nome.toLowerCase().includes(s) || (o.segmento || "").toLowerCase().includes(s));
  }, [q, options]);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={disabled}>
          {triggerLabel}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empreendimento…"
              className="h-8 pl-7 text-xs"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-72">
          <div className="py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum encontrado</div>
            )}
            {filtered.map((o) => {
              const selected = value.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition",
                    selected && "bg-muted/50"
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                      selected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="flex-1 text-left truncate">{o.nome}</span>
                  {o.segmento && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{o.segmento}</span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
        <div className="px-3 py-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{value.length} selecionado{value.length === 1 ? "" : "s"}</span>
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => onChange([])}
          >
            Limpar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
