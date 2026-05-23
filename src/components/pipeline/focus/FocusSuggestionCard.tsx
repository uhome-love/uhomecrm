/**
 * FocusSuggestionCard — card individual de sugestão no FocusEmptyState.
 *
 * - Quando count > 0: clicável, abre o Modo Foco filtrado pelos leadIds.
 * - Quando count === 0: estado neutro ("Tudo em dia"), sem seta, cursor default.
 */
import { LucideIcon } from "lucide-react";

interface FocusSuggestionCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  emptyDescription?: string;
  count: number;
  onClick: () => void;
}

export default function FocusSuggestionCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  emptyDescription = "Tudo em dia",
  count,
  onClick,
}: FocusSuggestionCardProps) {
  const isEmpty = count === 0;

  return (
    <button
      type="button"
      onClick={isEmpty ? undefined : onClick}
      disabled={isEmpty}
      className="w-full text-left rounded-2xl px-5 py-4 transition-all flex items-center gap-4 group"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        cursor: isEmpty ? "default" : "pointer",
        opacity: isEmpty ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isEmpty) e.currentTarget.style.background = "rgba(255,255,255,0.07)";
      }}
      onMouseLeave={(e) => {
        if (!isEmpty) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-white font-semibold text-sm">{title}</span>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: isEmpty ? "rgba(255,255,255,0.4)" : iconColor }}
          >
            {count}
          </span>
        </div>
        <p className="text-gray-400 text-xs mt-0.5">
          {isEmpty ? emptyDescription : description}
        </p>
      </div>
      {!isEmpty && (
        <span className="text-gray-500 group-hover:text-white transition-colors text-lg">
          →
        </span>
      )}
    </button>
  );
}
