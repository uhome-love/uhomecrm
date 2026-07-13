import { memo } from "react";
import { useHomi } from "@/contexts/HomiContext";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

function HomiHeaderButtonInner() {
  const { toggleHomi, unseenCount, isLoading } = useHomi();
  const { theme } = useTheme();

  return (
    <button
      onClick={() => toggleHomi()}
      className={cn(
        "relative flex items-center justify-center h-9 w-9 rounded-xl transition-colors shrink-0",
        theme === "dark" ? "hover:bg-white/5" : "hover:bg-[#f0f0f5]"
      )}
      title="Fale com o HOMI (tecle /)"
      aria-label="Abrir HOMI"
    >
      <span className="flex items-center justify-center h-7 w-7 rounded-full bg-white shadow-sm overflow-hidden">
        <img
          src="/images/homi-mascot-official.png"
          alt="HOMI"
          className="h-5 w-5 object-contain pointer-events-none"
        />
      </span>

      {isLoading && (
        <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
      )}

      {unseenCount > 0 && !isLoading && (
        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center shadow-md">
          {unseenCount > 9 ? "9+" : unseenCount}
        </span>
      )}
    </button>
  );
}

const HomiHeaderButton = memo(HomiHeaderButtonInner);
export default HomiHeaderButton;
