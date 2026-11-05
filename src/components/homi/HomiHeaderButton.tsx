import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useHomi } from "@/contexts/HomiContext";
import { cn } from "@/lib/utils";
import { HomiAvatar } from "@/components/brand/HomiAvatar";

/** Botão "Perguntar ao Homi" (DS v4): azul de ação com avatar plano; anel ciano quando há alerta. */
function HomiHeaderButtonInner() {
  const { unseenCount, isLoading } = useHomi();
  const navigate = useNavigate();
  const alerta = unseenCount > 0 && !isLoading;

  return (
    <button
      onClick={() => navigate("/homi")}
      className={cn(
        "relative inline-flex items-center gap-2 h-9 pl-1 pr-1 sm:pr-3 rounded-[9px] shrink-0 touch-manipulation",
        "bg-primary text-primary-foreground hover:bg-primary-700 transition-colors text-sm font-semibold",
      )}
      title="Perguntar ao Homi"
      aria-label="Perguntar ao Homi"
    >
      <HomiAvatar size={28} circle ring={alerta} />
      <span className="hidden sm:inline">Perguntar ao Homi</span>

      {isLoading && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-homi-cyan animate-pulse" />
      )}
      {alerta && (
        <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
          {unseenCount > 9 ? "9+" : unseenCount}
        </span>
      )}
    </button>
  );
}

const HomiHeaderButton = memo(HomiHeaderButtonInner);
export default HomiHeaderButton;
