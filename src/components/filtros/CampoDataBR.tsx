import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { withinDateBounds } from "@/lib/dateBounds";

interface Props {
  id: string;
  label: string;
  /** yyyy-MM-dd */
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}

const paraData = (s: string) => {
  const [a, m, d] = s.split("-").map(Number);
  return a && m && d ? new Date(a, m - 1, d, 12) : undefined;
};
const paraTexto = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Campo de data sempre em dia/mês/ano, independente do idioma do navegador. */
export function CampoDataBR({ id, label, value, onChange, min, max }: Props) {
  const [aberto, setAberto] = useState(false);
  const data = paraData(value);
  const minData = min ? paraData(min) : undefined;
  const maxData = max ? paraData(max) : undefined;
  const limites = [
    ...(minData ? [{ before: minData }] : []),
    ...(maxData ? [{ after: maxData }] : []),
  ];
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "flex h-10 w-full justify-start items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-normal tabular-nums duration-short ease-move",
              "hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          >
            <CalendarDays className="size-4 text-muted-foreground" />
            {value ? value.split("-").reverse().join("/") : "dd/mm/aaaa"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={data}
            defaultMonth={data}
            disabled={limites.length ? limites : undefined}
            onSelect={(d) => {
              if (d && withinDateBounds(paraTexto(d), min, max)) { onChange(paraTexto(d)); setAberto(false); }
            }}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
