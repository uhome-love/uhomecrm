import { cn } from "@/lib/utils";

export type PeriodoPadrao = "hoje" | "ontem" | "semana" | "mes" | "30d" | "personalizado";

const OPCOES: { value: PeriodoPadrao; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "30d", label: "30 dias" },
  { value: "personalizado", label: "Personalizado" },
];

interface PeriodSelectorProps {
  value: PeriodoPadrao;
  onChange: (v: PeriodoPadrao) => void;
  /** Esconde opções que a página não suporta. */
  opcoes?: PeriodoPadrao[];
  className?: string;
}

/** Classes do visual padrão, para páginas que montam seus próprios botões (ex.: com calendário). */
export const periodoGrupoClasse = "inline-flex items-center gap-0.5 p-1 rounded-xl bg-muted/70 border border-border flex-wrap";
export function periodoBotaoClasse(ativo: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12.5px] font-medium transition-all whitespace-nowrap",
    ativo ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
  );
}

/** Seletor de período padrão do CRM (mesmo visual em todas as páginas). */
export function PeriodSelector({ value, onChange, opcoes, className }: PeriodSelectorProps) {
  const lista = opcoes ? OPCOES.filter((o) => opcoes.includes(o.value)) : OPCOES;
  return (
    <div
      role="radiogroup"
      aria-label="Período"
      className={cn("inline-flex items-center gap-0.5 p-1 rounded-xl bg-muted/70 border border-border", className)}
    >
      {lista.map((o) => {
        const ativo = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 px-3 rounded-lg text-[12.5px] font-medium transition-all whitespace-nowrap",
              ativo ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
