import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  label: string;
  /** yyyy-MM-dd */
  value: string;
  onChange: (v: string) => void;
  min?: string;
}

const paraData = (s: string) => {
  const [a, m, d] = s.split("-").map(Number);
  return a && m && d ? new Date(a, m - 1, d, 12) : undefined;
};
const paraTexto = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Campo de data sempre em dia/mês/ano, independente do idioma do navegador. */
export function CampoDataBR({ id, label, value, onChange, min }: Props) {
  const [aberto, setAberto] = useState(false);
  const data = paraData(value);
  const minData = min ? paraData(min) : undefined;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm tabular-nums",
              "hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          >
            <CalendarDays className="size-4 text-muted-foreground" />
            {value ? value.split("-").reverse().join("/") : "dd/mm/aaaa"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={data}
            defaultMonth={data}
            disabled={minData ? { before: minData } : undefined}
            onSelect={(d) => {
              if (d) { onChange(paraTexto(d)); setAberto(false); }
            }}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
