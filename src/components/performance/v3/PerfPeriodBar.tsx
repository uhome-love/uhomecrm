import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PeriodoResolvido, PeriodoState, PeriodoTipo } from "@/lib/perfPeriodo";

const OPCOES: { tipo: PeriodoTipo; label: string }[] = [
  { tipo: "dia", label: "Dia" },
  { tipo: "semana", label: "Semana" },
  { tipo: "mes", label: "Mês" },
  { tipo: "custom", label: "Personalizado" },
];

interface Props {
  estado: PeriodoState;
  resolvido: PeriodoResolvido;
  onChange: (e: PeriodoState) => void;
}

/** Seletor único de período: Dia · Semana · Mês · Personalizado (BRT). */
export default function PerfPeriodBar({ estado, resolvido, onChange }: Props) {
  const setTipo = (tipo: PeriodoTipo) => onChange({ ...estado, tipo, offset: 0 });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-[10px] bg-muted p-0.5">
        {OPCOES.map((o) => (
          <button
            key={o.tipo}
            onClick={() => setTipo(o.tipo)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              estado.tipo === o.tipo
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {resolvido.navegavel && (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            aria-label="Período anterior"
            onClick={() => onChange({ ...estado, offset: estado.offset - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-semibold min-w-[140px] text-center">{resolvido.label}</span>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            aria-label="Próximo período"
            disabled={resolvido.noPresente}
            onClick={() => onChange({ ...estado, offset: estado.offset + 1 })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {estado.tipo === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-2 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              {resolvido.label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 pointer-events-auto" align="start">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="h-8 text-xs"
                value={resolvido.start}
                onChange={(e) => onChange({ ...estado, customStart: e.target.value })}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                className="h-8 text-xs"
                value={resolvido.end}
                onChange={(e) => onChange({ ...estado, customEnd: e.target.value })}
              />
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
