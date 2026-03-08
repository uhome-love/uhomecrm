import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * ImmersiveScreen — dark background with animated particles.
 * Use for celebration moments and special screens only.
 *
 * @param fullScreen  If true, uses fixed positioning to cover viewport (overlays).
 *                    If false (default), fills its parent container.
 * @param className   Additional classes for the outer wrapper.
 * @param onClose     If provided, clicking the backdrop calls this (for overlays).
 * @param animate     If true (default), fades in on mount.
 */
interface Props {
  children: ReactNode;
  fullScreen?: boolean;
  className?: string;
  onClose?: () => void;
  animate?: boolean;
  particleCount?: number;
}

function Particles({ count = 25 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        size: 1 + Math.random() * 2,
        opacity: 0.15 + Math.random() * 0.35,
        duration: 8 + Math.random() * 7,
        delay: Math.random() * 10,
      })),
    [count]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            bottom: "-10px",
            animation: `immersive-particle-rise ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes immersive-particle-rise {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-110vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function ImmersiveScreen({
  children,
  fullScreen = false,
  className = "",
  onClose,
  animate = true,
  particleCount = 25,
}: Props) {
  const baseClasses = fullScreen
    ? "fixed inset-0 z-[9999]"
    : "relative w-full min-h-full";

  const content = (
    <div
      className={`${baseClasses} flex flex-col items-center justify-center overflow-hidden ${className}`}
      style={{
        background:
          "radial-gradient(ellipse at center, #0F1E3D 0%, #060D1F 60%, #020610 100%)",
      }}
      onClick={onClose ? () => onClose() : undefined}
    >
      <Particles count={particleCount} />
      <div
        className="relative z-10 w-full flex flex-col items-center"
        onClick={onClose ? (e) => e.stopPropagation() : undefined}
      >
        {children}
      </div>
    </div>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="contents"
    >
      {content}
    </motion.div>
  );
}

/** Confetti burst — renders N confetti particles that fly outward and fade. */
export function ConfettiBurst({
  count = 40,
  colors,
}: {
  count?: number;
  colors?: string[];
}) {
  const palette = colors || [
    "#4969FF",
    "#FFD700",
    "#FF6B6B",
    "#4ECDC4",
    "#A855F7",
    "#F97316",
  ];

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{
            x: (Math.random() - 0.5) * 600,
            y: (Math.random() - 0.5) * 600,
            scale: Math.random() * 1.5 + 0.5,
            opacity: 0,
            rotate: Math.random() * 720,
          }}
          transition={{ duration: 2 + Math.random(), ease: "easeOut" }}
          className="absolute pointer-events-none"
          style={{
            width: 8 + Math.random() * 8,
            height: 8 + Math.random() * 8,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            backgroundColor:
              palette[Math.floor(Math.random() * palette.length)],
          }}
        />
      ))}
    </>
  );
}

/** Styled header label — "✦ TEXT ✦" */
export function ImmersiveLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm tracking-[0.3em] uppercase font-bold text-[#60A5FA] text-center">
      ✦ {children} ✦
    </p>
  );
}
