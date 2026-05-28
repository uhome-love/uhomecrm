import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import type { CentralPeriodo, CentralUrlState } from "./useCentralUrlState";

interface Props {
  state: CentralUrlState;
  onChange: (patch: Partial<CentralUrlState>) => void;
}

const PILLS: Array<{ id: CentralPeriodo; label: string }> = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "trimestre", label: "Trimestre" },
  { id: "custom", label: "Personalizado" },
];

export function CentralFilters({ state, onChange }: Props) {
  const { isAdmin } = useAuth();
  const showCustom = state.periodo === "custom";

  const deDate = useMemo(() => (state.de ? new Date(state.de) : undefined), [state.de]);
  const ateDate = useMemo(() => (state.ate ? new Date(state.ate) : undefined), [state.ate]);

  return (
    <div className="central-card flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Período
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PILLS.map((p) => {
            const active = state.periodo === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ periodo: p.id })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-2">
          <DateField
            label="De"
            value={deDate}
            onChange={(d) => onChange({ de: d ? format(d, "yyyy-MM-dd") : undefined })}
          />
          <DateField
            label="Até"
            value={ateDate}
            onChange={(d) => onChange({ ate: d ? format(d, "yyyy-MM-dd") : undefined })}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {isAdmin && (
          <SelectStub
            label="Equipe"
            value={state.equipe ?? ""}
            placeholder="Todas as equipes"
            onChange={(v) => onChange({ equipe: v || undefined })}
          />
        )}
        <SelectStub
          label="Corretor"
          value={state.corretor ?? ""}
          placeholder="Todos os corretores"
          onChange={(v) => onChange({ corretor: v || undefined })}
        />
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-[160px] justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy") : "Selecionar"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Placeholder de select — RPCs de equipe/corretor entram no Prompt 6.
function SelectStub({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-[200px] rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        disabled
        aria-label={`${label} (em construção)`}
      />
    </div>
  );
}
