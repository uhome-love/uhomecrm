import { memo } from "react";
import { motion } from "framer-motion";
import { useHomi } from "@/contexts/HomiContext";
import HomiAnimated from "./HomiAnimated";

function HomiAvatarInner() {
  const { isOpen, toggleHomi, unseenCount, isLoading } = useHomi();

  if (isOpen) return null;

  const animState = isLoading ? "thinking" : unseenCount > 0 ? "alert" : "idle";

  return (
    <button
      onClick={toggleHomi}
      className="fixed bottom-6 right-6 z-[60] group"
      title="Fale com o HOMI (tecle /)"
    >
      {/* Pulse ring when has unseen alerts */}
      {unseenCount > 0 && (
        <div className="absolute inset-0 rounded-full bg-primary/25 animate-ping" style={{ animationDuration: "2s" }} />
      )}

      {/* Normal subtle pulse */}
      {unseenCount === 0 && (
        <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping opacity-30" style={{ animationDuration: "4s" }} />
      )}

      {/* Avatar — white circle with HOMI mascot */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="relative rounded-full bg-white shadow-xl hover:shadow-2xl transition-shadow flex items-center justify-center overflow-hidden"
        style={{ height: 56, width: 56 }}
      >
        <img src="/images/homi-mascot-official.png" alt="HOMI" className="h-10 w-10 object-contain" />

        {/* Thinking indicator */}
        {isLoading && (
          <div className="absolute bottom-0.5 right-0.5 flex gap-[2px] bg-white/90 rounded-full px-1.5 py-0.5">
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </motion.div>

      {/* Badge count */}
      {unseenCount > 0 && (
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
          {unseenCount > 9 ? "9+" : unseenCount}
        </div>
      )}

      {/* Tooltip */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
        HOMI AI • tecle <kbd className="font-mono">/</kbd>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
      </div>
    </button>
  );
}

const HomiAvatar = memo(HomiAvatarInner);
export default HomiAvatar;
