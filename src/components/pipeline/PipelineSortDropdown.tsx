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
  | "prioridade"
  | "atividade"
  | "ultima_atividade"
  | "mais_recente"
  | "mais_antigo"
  | "nome"
  | "valor"
  | "temperatura";

const SORT_OPTIONS: { value: SortOrder; label: string; icon: string; desc: string }[] = [
  { value: "prioridade",       label: "Prioridade",       icon: "🔥", desc: "Quem atender agora (por etapa)" },
  { value: "atividade",        label: "Compromisso",      icon: "📅", desc: "Lembrete vencido → hoje → futuro" },
  { value: "ultima_atividade", label: "Última atividade", icon: "⏳", desc: "Mais tempo sem falar no topo" },
  { value: "mais_recente",     label: "Mais recente",     icon: "🆕", desc: "Lead que chegou por último" },
  { value: "mais_antigo",      label: "Mais antigo",      icon: "📆", desc: "Lead que chegou primeiro" },
  { value: "nome",             label: "Nome (A-Z)",       icon: "🅰", desc: "Ordem alfabética" },
];

const STORAGE_KEY = "pipeline-sort-order";
const VALID: SortOrder[] = SORT_OPTIONS.map((o) => o.value);

export function loadSortOrder(): SortOrder {
  if (typeof window === "undefined") return "prioridade";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return VALID.includes(stored as SortOrder) ? (stored as SortOrder) : "prioridade";
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
          title={`Ordenar: ${current.label}`}
          className="shrink-0 flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs font-medium border border-[#e8e8f0] dark:border-white/[0.07] bg-[#f7f7fb] dark:bg-white/[0.04] text-[#52525b] dark:text-[#a1a1aa] hover:border-primary hover:text-primary transition-colors cursor-pointer whitespace-nowrap"
        >
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold text-[#0a0a0a] dark:text-white">{current.label}</span>
        </button>

      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Ordenar por
        </div>
        {SORT_OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              className={`flex items-start gap-2 text-xs ${
                isActive ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300" : ""
              }`}
            >
              <span className="w-4 shrink-0 pt-0.5 text-center">{opt.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="font-medium">{opt.label}</span>
                <span className="block text-[11px] font-normal text-muted-foreground">{opt.desc}</span>
              </span>
              {isActive && <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />}
            </DropdownMenuItem>
          );
        })}
        <div className="mt-1 border-t border-border px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Prioridade</span> por etapa:
          <span className="mt-1 block">🟦 Novo Lead → mais recente</span>
          <span className="block">⚫ Sem Contato → cadência (tentativa devida)</span>
          <span className="block">🔍 Qualificação+ → 🔥 quente esfriando</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
