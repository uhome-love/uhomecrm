import { useState, useCallback, useMemo, createContext, useContext } from "react";
import { cn } from "@/lib/utils";

const homiMascot = "/images/homi-120.png";

export type HomiAnimState = "idle" | "talking" | "thinking" | "alert" | "celebrating";

const PARTICLES = ["🌟", "✨", "🎉", "⭐", "💫", "🎊"];

interface HomiAnimControls {
  state: HomiAnimState;
  setState: (s: HomiAnimState) => void;
  triggerAlert: () => void;
  triggerCelebrate: () => void;
}

const HomiAnimContext = createContext<HomiAnimControls | null>(null);

export function useHomiAnim() {
  return useContext(HomiAnimContext);
}

export function HomiAnimProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HomiAnimState>("idle");

  const triggerAlert = useCallback(() => {
    setState("alert");
    setTimeout(() => setState("idle"), 2000);
  }, []);

  const triggerCelebrate = useCallback(() => {
    setState("celebrating");
    setTimeout(() => setState("idle"), 2200);
  }, []);

  const value = useMemo(() => ({ state, setState, triggerAlert, triggerCelebrate }), [state, triggerAlert, triggerCelebrate]);

  return <HomiAnimContext.Provider value={value}>{children}</HomiAnimContext.Provider>;
}

interface HomiAnimatedProps {
  state?: HomiAnimState;
  size?: number;
  className?: string;
}

export default function HomiAnimated({ state = "idle", size = 64, className }: HomiAnimatedProps) {
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <img
        src={homiMascot}
        alt="HOMI"
        className={cn(`homi-${state}`, "object-contain")}
        style={{ width: size, height: size }}
      />
      {state === "celebrating" && PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`absolute text-base pointer-events-none homi-particle-${i}`}
          style={{ opacity: 0 }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}
