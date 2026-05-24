/**
 * PipelineCorretorSelect — Select reutilizável de corretor.
 *
 * Extraído de PipelineHeader.tsx (Fase 1 — Refactor visões Gestor/CEO).
 * Comportamento idêntico ao select inline original; apenas centraliza o markup
 * para eliminar as 3 duplicações entre mobile/tablet/desktop.
 *
 * Variantes preservam o estilo de cada breakpoint do header atual.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CorretorSelectVariant = "mobile" | "tablet" | "desktop";

export interface PipelineCorretorSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  isAdmin: boolean;
  variant: CorretorSelectVariant;
}

const TRIGGER_BY_VARIANT: Record<CorretorSelectVariant, string> = {
  mobile:
    "h-7 text-[10px] w-[100px] shrink-0 rounded-[7px] font-semibold",
  tablet:
    "h-7 text-[10px] w-[110px] shrink-0 rounded-[7px] font-semibold",
  desktop:
    "h-[32px] text-[12px] max-w-[170px] min-w-[120px] shrink rounded-lg font-medium truncate",
};

const ACTIVE_BY_VARIANT: Record<CorretorSelectVariant, string> = {
  mobile:
    "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  tablet:
    "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  desktop:
    "border-[#4969FF] bg-[#4969FF]/5 dark:bg-[#4969FF]/10 text-[#4969FF]",
};

const IDLE_BY_VARIANT: Record<CorretorSelectVariant, string> = {
  mobile:
    "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400",
  tablet:
    "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400",
  desktop:
    "border-[#e8e8f0] dark:border-white/[0.07] bg-[#f7f7fb] dark:bg-white/[0.04] text-[#52525b] dark:text-[#a1a1aa]",
};

const PLACEHOLDER_BY_VARIANT: Record<CorretorSelectVariant, string> = {
  mobile: "Corretor",
  tablet: "Corretores",
  desktop: "Todos os corretores",
};

export default function PipelineCorretorSelect({
  value,
  onChange,
  options,
  isAdmin,
  variant,
}: PipelineCorretorSelectProps) {
  const active = value !== "all";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={`${TRIGGER_BY_VARIANT[variant]} ${active ? ACTIVE_BY_VARIANT[variant] : IDLE_BY_VARIANT[variant]}`}
      >
        <SelectValue placeholder={PLACEHOLDER_BY_VARIANT[variant]} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{variant === "desktop" ? "Todos os corretores" : "Todos"}</SelectItem>
        {isAdmin && <SelectItem value="sem_corretor">Sem corretor</SelectItem>}
        {options.map(([id, nome]) => (
          <SelectItem key={id} value={id}>{nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
