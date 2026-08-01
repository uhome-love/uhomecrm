import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface PickerItem {
  id: string;
  nome: string;
  hint?: string;
}

/** Seletor múltiplo compacto com busca — usado nos filtros do construtor de campanha. */
export function MultiPicker({
  items,
  value,
  onChange,
  placeholder,
  emptyLabel = "Todos",
}: {
  items: PickerItem[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? items.filter((i) => i.nome.toLowerCase().includes(t)) : items;
    return list.slice(0, 200);
  }, [items, q]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const label =
    value.length === 0
      ? emptyLabel
      : value.length === 1
        ? (items.find((i) => i.id === value[0])?.nome ?? "1 selecionado")
        : `${value.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">{label}</span>
          <ChevronDown size={14} className="opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search size={14} className="opacity-60" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-7 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nada encontrado</p>
          )}
          {filtered.map((i) => {
            const on = value.includes(i.id);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => toggle(i.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  }`}
                >
                  {on && <Check size={11} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{i.nome}</span>
                {i.hint && <Badge variant="secondary" className="text-[10px]">{i.hint}</Badge>}
              </button>
            );
          })}
        </div>
        {value.length > 0 && (
          <div className="border-t px-3 py-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([])}>
              Limpar seleção
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default MultiPicker;
