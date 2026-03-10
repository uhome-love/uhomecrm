/**
 * EmpreendimentoCombobox — Reusable combobox for empreendimento selection.
 * Allows selecting from a list OR typing a custom value.
 */

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_EMPREENDIMENTOS = [
  "Alfa",
  "Alto Lindóia",
  "Boa Vista Country Club",
  "Casa Bastian",
  "Casa Tua",
  "Duetto - Morana",
  "Lake Eyre",
  "Las Casas",
  "Me Day",
  "Melnick Day",
  "Melnick Day Compactos",
  "Open Bosque",
  "Orygem",
  "Seen",
  "Shift - Vanguard",
  "Terrace",
  "Vértice - Las Casas",
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called only when user picks from dropdown list (not on every keystroke) */
  onSelect?: (value: string) => void;
  extraOptions?: string[];
  placeholder?: string;
  className?: string;
}

export default function EmpreendimentoCombobox({
  value,
  onChange,
  extraOptions = [],
  placeholder = "Selecione ou digite o empreendimento",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Merge default + extra, deduplicate, sort
  const allOptions = Array.from(
    new Set([...DEFAULT_EMPREENDIMENTOS, ...extraOptions])
  ).sort((a, b) => a.localeCompare(b));

  const filtered = search
    ? allOptions.filter((e) =>
        e.toLowerCase().includes(search.toLowerCase())
      )
    : allOptions;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setSearch("");
    setOpen(false);
  };

  const handleInputChange = (text: string) => {
    setSearch(text);
    onChange(text);
    if (!open) setOpen(true);
  };

  const handleClear = () => {
    onChange("");
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={search || value}
          onChange={(e) => handleInputChange(e.target.value)}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8 pr-14 h-9 text-sm"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="p-0.5 rounded hover:bg-muted"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-md">
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors",
                value === option && "bg-accent font-semibold"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
