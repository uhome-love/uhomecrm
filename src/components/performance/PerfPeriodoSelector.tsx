import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIODO_OPCOES, type PeriodoResolvido, type PeriodoState, type PeriodoTipo } from "@/lib/perfPeriodo";

interface Props {
  estado: PeriodoState;
  resolvido: PeriodoResolvido;
  onChange: (p: PeriodoState) => void;
}

export default function PerfPeriodoSelector({ estado, resolvido, onChange }: Props) {
  const setTipo = (tipo: PeriodoTipo) => onChange({ ...estado, tipo, offset: 0 });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex bg-muted/60 p-1 rounded-lg border border-border overflow-x-auto scrollbar-hide">
        {PERIODO_OPCOES.map((o) => (
          <button
            key={o.tipo}
            onClick={() => setTipo(o.tipo)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors",
              estado.tipo === o.tipo
                ? "bg-card shadow-sm text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {resolvido.navegavel ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChange({ ...estado, offset: estado.offset - 1 })}
            className="p-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Período anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[150px] text-center">{resolvido.label}</span>
          <button
            onClick={() => onChange({ ...estado, offset: Math.min(estado.offset + 1, 0) })}
            disabled={estado.offset >= 0}
            aria-label="Próximo período"
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              estado.offset >= 0
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : estado.tipo === "custom" ? (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={estado.customStart ?? resolvido.start}
            max={estado.customEnd ?? resolvido.end}
            onChange={(e) => onChange({ ...estado, customStart: e.target.value })}
            className="h-8 px-2 text-xs rounded-lg bg-muted/60 border border-border text-foreground"
            aria-label="Data inicial"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={estado.customEnd ?? resolvido.end}
            min={estado.customStart ?? resolvido.start}
            onChange={(e) => onChange({ ...estado, customEnd: e.target.value })}
            className="h-8 px-2 text-xs rounded-lg bg-muted/60 border border-border text-foreground"
            aria-label="Data final"
          />
        </div>
      ) : (
        <span className="text-sm font-semibold text-foreground">{resolvido.label}</span>
      )}
    </div>
  );
}
