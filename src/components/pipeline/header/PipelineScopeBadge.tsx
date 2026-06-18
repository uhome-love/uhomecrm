/**
 * PipelineScopeBadge — Mostra o contexto atual do Pipeline.
 *
 * Fase 1 do refactor das visões Gestor/CEO. Renderiza:
 *   • Corretor       → "Meus leads · N"
 *   • Gestor         → "Time · N leads"
 *   • CEO sem filtro → "Escritório · N leads"
 *   • CEO filtrado   → "Time {Nome} · N · filtrado por CEO"
 */
import { GERENTES_REAIS } from "./PipelineGestorSelect";
import { useGestoresPipeline } from "@/hooks/useGestoresPipeline";

export interface PipelineScopeBadgeProps {
  isAdmin: boolean;
  isDiretor?: boolean;
  isGestor: boolean;
  filteredCount: number;
  gestorFilter?: string; // "todos" ou gerente_id
}

export default function PipelineScopeBadge({
  isAdmin,
  isDiretor = false,
  isGestor,
  filteredCount,
  gestorFilter = "todos",
}: PipelineScopeBadgeProps) {
  let label: string;
  let accent: string;
  // Diretoria e CEO têm visão de escritório; o rótulo diferencia o contexto.
  if (isAdmin || isDiretor) {
    const scopeName = isDiretor && !isAdmin ? "Diretoria" : "CEO";
    if (gestorFilter && gestorFilter !== "todos") {
      const g = GERENTES_REAIS.find((x) => x.id === gestorFilter);
      label = `Time ${g?.apelido ?? "Gestor"} · ${filteredCount} · filtrado por ${scopeName}`;
    } else {
      label = `Escritório · ${filteredCount} leads`;
    }
    accent = "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800";
  } else if (isGestor) {
    label = `Time · ${filteredCount} leads`;
    accent = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800";
  } else {
    label = `Meus leads · ${filteredCount}`;
    accent = "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700";
  }

  return (
    <span
      className={`inline-flex items-center h-6 px-2 rounded-full border text-[10px] font-semibold whitespace-nowrap ${accent}`}
    >
      {label}
    </span>
  );
}
