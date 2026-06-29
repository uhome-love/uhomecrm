import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, CalendarDays, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { useEquipesDisponiveis } from "@/hooks/useEquipesDisponiveis";
import { resolvePeriodo } from "@/hooks/useRelatoriosCentral";
import { getSection } from "./sections";
import type { CentralPeriodo, CentralUrlState } from "./useCentralUrlState";

const ALL_EQUIPES = "__all__";

const PILLS: Array<{ id: CentralPeriodo; label: string }> = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "trimestre", label: "Trimestre" },
  { id: "custom", label: "Personalizado" },
];

interface Props {
  state: CentralUrlState;
  onChange: (patch: Partial<CentralUrlState>) => void;
}

function fmtRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (start === end) return format(s, "d 'de' MMM", { locale: ptBR });
  if (sameMonth) return `${format(s, "d", { locale: ptBR })}–${format(e, "d 'de' MMM", { locale: ptBR })}`;
  return `${format(s, "d MMM", { locale: ptBR })} – ${format(e, "d MMM", { locale: ptBR })}`;
}

export function CentralHeader({ state, onChange }: Props) {
  const { isAdmin } = useUserRole();
  const { data: equipes = [] } = useEquipesDisponiveis();
  const s = getSection(state.secao);
  const showCustom = state.periodo === "custom";

  const range = useMemo(
    () => resolvePeriodo(state.periodo, state.de, state.ate),
    [state.periodo, state.de, state.ate]
  );

  const deDate = useMemo(() => (state.de ? new Date(`${state.de}T00:00:00`) : undefined), [state.de]);
  const ateDate = useMemo(() => (state.ate ? new Date(`${state.ate}T00:00:00`) : undefined), [state.ate]);

  const handleExport = () => {
    window.dispatchEvent(new CustomEvent("central:export-pdf", { detail: { secao: state.secao } }));
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background supports-[backdrop-filter]:bg-background/90 supports-[backdrop-filter]:backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-6">
        {/* Linha 1 — identidade + ações */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display truncate text-xl leading-tight text-foreground sm:text-2xl">
                Central de Relatórios
              </h1>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span className="truncate">{s.label}</span>
                <span className="text-border">·</span>
                <CalendarDays className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {fmtRange(range.start, range.end)} <span className="hidden sm:inline">· vs. período anterior</span>
                </span>
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </Button>
        </div>

        {/* Linha 2 — período + equipe */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PILLS.map((p) => {
              const active = state.periodo === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ periodo: p.id })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {showCustom && (
            <div className="flex flex-wrap items-center gap-1.5">
              <DateField value={deDate} placeholder="De" onChange={(d) => onChange({ de: d ? format(d, "yyyy-MM-dd") : undefined })} />
              <span className="text-xs text-muted-foreground">→</span>
              <DateField value={ateDate} placeholder="Até" onChange={(d) => onChange({ ate: d ? format(d, "yyyy-MM-dd") : undefined })} />
            </div>
          )}

          {isAdmin && (
            <div className="ml-auto">
              <Select
                value={state.equipe ?? ALL_EQUIPES}
                onValueChange={(v) => onChange({ equipe: v === ALL_EQUIPES ? undefined : v })}
              >
                <SelectTrigger className="h-8 w-[190px] text-xs">
                  <SelectValue placeholder="Todas as equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_EQUIPES}>Todas as equipes</SelectItem>
                  {equipes.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function DateField({
  value,
  placeholder,
  onChange,
}: {
  value: Date | undefined;
  placeholder: string;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 justify-start text-xs font-normal", !value && "text-muted-foreground")}
        >
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
          {value ? format(value, "dd/MM/yy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}
