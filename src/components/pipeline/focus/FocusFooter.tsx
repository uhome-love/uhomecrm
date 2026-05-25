/**
 * FocusFooter — R5 Item 4.
 *
 * Footer fixo do Modo Foco. Compartilha os handlers `onPrev`/`onNext` com o
 * hook `useFocusKeyboardShortcuts` (setas ← / →). Single source of truth:
 * mudou aqui, mudou no atalho — princípio 40.
 *
 * NÃO aparece em: configPhase, empty state, loading.
 * TaskCompletionDialog (Radix z-50) cobre naturalmente.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function FocusFooter({ currentIndex, total, onPrev, onNext }: Props) {
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= total - 1;

  return (
    <div
      className="shrink-0 grid grid-cols-3 items-center px-4 sm:px-6 py-3"
      style={{
        background: "rgba(15, 15, 35, 0.95)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex justify-start">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className={cn(
            "flex items-center gap-1.5 text-xs sm:text-sm font-semibold rounded-lg px-3 py-2 transition-colors",
            isFirst
              ? "text-gray-600 cursor-not-allowed"
              : "text-gray-200 hover:bg-white/5 hover:text-white"
          )}
          title="Lead anterior (←)"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Lead anterior</span>
          <span className="sm:hidden">Anterior</span>
        </button>
      </div>

      <div className="flex justify-center">
        <span
          className="text-[11px] sm:text-xs text-gray-400 tabular-nums px-2.5 py-1 rounded-md"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="hidden sm:inline">Lead </span>
          {Math.min(currentIndex + 1, Math.max(total, 1))}
          <span className="hidden sm:inline"> de </span>
          <span className="sm:hidden">/</span>
          {total}
        </span>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={isLast}
          className={cn(
            "flex items-center gap-1.5 text-xs sm:text-sm font-semibold rounded-lg px-3 py-2 transition-colors",
            isLast
              ? "text-gray-600 cursor-not-allowed"
              : "text-gray-200 hover:bg-white/5 hover:text-white"
          )}
          title="Próximo lead (→)"
        >
          <span className="hidden sm:inline">Próximo lead</span>
          <span className="sm:hidden">Próximo</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
