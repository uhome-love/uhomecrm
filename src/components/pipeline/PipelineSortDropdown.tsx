// ─────────────────────────────────────────────────────────────────
// PipelineSortDropdown — Dropdown de ordenação do Pipeline v2 (P3 Fix)
//
// 6 opções:
//   🔥 Atividade (default)  · 📅 Mais recente   · 📆 Mais antigo
//   🅰 Nome (A-Z)           · 💰 Valor estimado · ⭐ Temperatura
//
// Persiste a escolha em localStorage e dispara telemetria
// `pipeline_sort_changed` em cada troca.
// ─────────────────────────────────────────────────────────────────
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Check } from "lucide-react";
import { trackPipelineEvent } from "@/lib/pipelineTelemetry";

export type SortOrder =
  | "atividade"
  | "mais_recente"
  | "mais_antigo"
  | "nome"
  | "valor"
  | "temperatura";

const SORT_OPTIONS: { value: SortOrder; label: string; icon: string }[] = [
  { value: "atividade",    label: "Atividade",      icon: "🔥" },
  { value: "mais_recente", label: "Mais recente",   icon: "📅" },
  { value: "mais_antigo",  label: "Mais antigo",    icon: "📆" },
  { value: "nome",         label: "Nome (A-Z)",     icon: "🅰" },
  { value: "valor",        label: "Valor estimado", icon: "💰" },
  { value: "temperatura",  label: "Temperatura",    icon: "⭐" },
];

const STORAGE_KEY = "pipeline-sort-order";
const VALID: SortOrder[] = SORT_OPTIONS.map((o) => o.value);

export function loadSortOrder(): SortOrder {
  if (typeof window === "undefined") return "atividade";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return VALID.includes(stored as SortOrder) ? (stored as SortOrder) : "atividade";
}

interface Props {
  value: SortOrder;
  onChange: (value: SortOrder) => void;
}

export function PipelineSortDropdown({ value, onChange }: Props) {
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  const handleChange = (next: SortOrder) => {
    if (next === value) return;
    onChange(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
    trackPipelineEvent("pipeline_sort_changed", { from: value, to: next });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Ordenar leads"
          className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border border-[#e8e8f0] dark:border-white/[0.07] bg-[#f7f7fb] dark:bg-white/[0.04] text-[#52525b] dark:text-[#a1a1aa] hover:border-[#4969FF] hover:text-[#4969FF] transition-colors cursor-pointer whitespace-nowrap"
        >
          <ArrowUpDown className="h-4 w-4" />
          <span>
            Ordenar: <strong className="font-semibold text-[#0a0a0a] dark:text-white">{current.label}</strong>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Ordenar por
        </div>
        {SORT_OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              className={`flex items-center gap-2 text-xs ${
                isActive ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium" : ""
              }`}
            >
              <span className="w-4 text-center">{opt.icon}</span>
              <span className="flex-1">{opt.label}</span>
              {isActive && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
