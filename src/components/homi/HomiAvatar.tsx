import { memo, useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useHomi } from "@/contexts/HomiContext";

const SNAP_MARGIN = 16;
const BUTTON_SIZE = 56;

function getSnapPosition(x: number, y: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = x + BUTTON_SIZE / 2;
  const cy = y + BUTTON_SIZE / 2;
  const midX = w / 2;
  const midY = h / 2;

  return {
    x: cx < midX ? SNAP_MARGIN : w - BUTTON_SIZE - SNAP_MARGIN,
    y: cy < midY ? Math.max(SNAP_MARGIN, y) : h - BUTTON_SIZE - SNAP_MARGIN,
  };
}

function loadSavedPosition() {
  try {
    const saved = localStorage.getItem("homi-avatar-pos");
    if (saved) return JSON.parse(saved);
  } catch (e) { console.warn("[HomiAvatar] localStorage parse error:", e); }
  return null;
}

function HomiAvatarInner() {
  const { isOpen, toggleHomi, unseenCount, isLoading } = useHomi();
  const defaultPos = { x: window.innerWidth - BUTTON_SIZE - SNAP_MARGIN, y: window.innerHeight - BUTTON_SIZE - SNAP_MARGIN };
  const [position, setPosition] = useState(() => loadSavedPosition() || defaultPos);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Persist position
  useEffect(() => {
    localStorage.setItem("homi-avatar-pos", JSON.stringify(position));
  }, [position]);

  // Recalc on resize
  useEffect(() => {
    const onResize = () => {
      setPosition(prev => {
        const maxX = window.innerWidth - BUTTON_SIZE - SNAP_MARGIN;
        const maxY = window.innerHeight - BUTTON_SIZE - SNAP_MARGIN;
        return {
          x: Math.min(prev.x, maxX),
          y: Math.min(prev.y, maxY),
        };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    hasMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved.current = true;
    const newX = Math.max(0, Math.min(window.innerWidth - BUTTON_SIZE, dragStart.current.posX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - BUTTON_SIZE, dragStart.current.posY + dy));
    setPosition({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (hasMoved.current) {
      // Snap to nearest corner
      const snapped = getSnapPosition(position.x, position.y);
      setPosition(snapped);
    } else {
      toggleHomi();
    }
  }, [position, toggleHomi]);

  if (isOpen) return null;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="fixed z-[60] group touch-none select-none"
      style={{ left: position.x, top: position.y, cursor: isDragging.current ? "grabbing" : "grab" }}
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
        style={{ height: BUTTON_SIZE, width: BUTTON_SIZE }}
      >
        <img src="/images/homi-mascot-official.png" alt="HOMI" className="h-10 w-10 object-contain pointer-events-none" />

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
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md pointer-events-none">
          {unseenCount > 9 ? "9+" : unseenCount}
        </div>
      )}

      {/* Tooltip */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
        HOMI AI • tecle <kbd className="font-mono">/</kbd>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
      </div>
    </div>
  );
}

const HomiAvatar = memo(HomiAvatarInner);
export default HomiAvatar;
