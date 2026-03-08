import { useMemo, Suspense, lazy } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { GamificationLevel } from "@/lib/gamification";
import { getLevel } from "@/lib/gamification";

const Avatar3DViewer = lazy(() => import("@/components/avaturn/Avatar3DViewer"));

export type AvatarAnimationState = "idle" | "celebrating" | "calling" | "no-answer" | "levelup" | "overtaken";

export interface CorretorAvatarProps {
  nome: string;
  avatarUrl?: string | null;
  avatarPreviewUrl?: string | null;
  points?: number;
  level?: GamificationLevel;
  ranking?: number;
  streak?: number;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  showBadges?: boolean;
  animationState?: AvatarAnimationState;
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-20 w-20",
  xl: "h-[120px] w-[120px]",
};

const textSizeMap = {
  sm: "text-[10px]",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
};

const crownSizeMap = {
  sm: "text-xs -top-2",
  md: "text-sm -top-3",
  lg: "text-xl -top-4",
  xl: "text-3xl -top-6",
};

const medalSizeMap = {
  sm: "text-[8px] -bottom-0.5 -right-0.5",
  md: "text-xs -bottom-1 -right-1",
  lg: "text-base -bottom-1 -right-1",
  xl: "text-xl -bottom-2 -right-2",
};

const streakSizeMap = {
  sm: "text-[8px] -top-0.5 -right-0.5",
  md: "text-xs -top-1 -right-1",
  lg: "text-sm -top-1 -right-0",
  xl: "text-base -top-2 -right-0",
};

/** Color configs per level id */
const levelStyles: Record<string, {
  ring: string;
  aura: string;
  bg: string;
  effectClass: string;
}> = {
  iniciante: {
    ring: "ring-neutral-500/40",
    aura: "",
    bg: "bg-neutral-600",
    effectClass: "",
  },
  ativo: {
    ring: "ring-blue-500/60",
    aura: "shadow-[0_0_20px_rgba(59,130,246,0.6)]",
    bg: "bg-blue-600",
    effectClass: "avatar-effect-ativo",
  },
  engajado: {
    ring: "ring-orange-500/60",
    aura: "shadow-[0_0_16px_rgba(249,115,22,0.5)]",
    bg: "bg-orange-600",
    effectClass: "avatar-effect-engajado",
  },
  destaque: {
    ring: "ring-amber-400/70",
    aura: "shadow-[0_0_20px_rgba(245,158,11,0.5)]",
    bg: "bg-amber-500",
    effectClass: "avatar-effect-destaque",
  },
  elite: {
    ring: "ring-purple-500/70",
    aura: "shadow-[0_0_24px_rgba(168,85,247,0.5)]",
    bg: "bg-purple-600",
    effectClass: "avatar-effect-elite",
  },
  lendario: {
    ring: "ring-yellow-400/80",
    aura: "shadow-[0_0_32px_rgba(234,179,8,0.6)]",
    bg: "bg-yellow-500",
    effectClass: "avatar-effect-lendario",
  },
};

function getInitials(nome: string) {
  return nome
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Check if URL is a .glb 3D model */
function is3DModel(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes(".glb") || url.includes(".gltf");
}

export default function CorretorAvatar({
  nome,
  avatarUrl,
  avatarPreviewUrl,
  points = 0,
  level: levelOverride,
  ranking,
  streak = 0,
  size = "md",
  animated = true,
  showBadges = true,
  animationState = "idle",
  className,
}: CorretorAvatarProps) {
  const level = levelOverride || getLevel(points);
  const style = levelStyles[level.id] || levelStyles.iniciante;
  const initials = useMemo(() => getInitials(nome), [nome]);

  const has3D = is3DModel(avatarUrl);
  const use3D = has3D && (size === "lg" || size === "xl");
  // For sm/md: use preview PNG if available, else regular photo
  const flatImageUrl = avatarPreviewUrl || (has3D ? null : avatarUrl);

  const isTop1 = ranking === 1;

  return (
    <div className={cn(
      "relative inline-flex items-center justify-center",
      animated && `avatar-${animationState}`,
      className,
    )}>
      {/* Animated aura for higher levels */}
      {animated && level.id !== "iniciante" && (
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            level.id === "lendario" && "animate-[avatar-glow_2s_ease-in-out_infinite]",
            level.id === "elite" && "animate-[avatar-pulse_2.5s_ease-in-out_infinite]",
            level.id === "destaque" && "animate-[avatar-pulse_3s_ease-in-out_infinite]",
            level.id === "engajado" && "animate-[avatar-pulse_3s_ease-in-out_infinite]",
            level.id === "ativo" && "animate-[avatar-pulse_4s_ease-in-out_infinite]",
          )}
          style={{
            background:
              level.id === "lendario"
                ? "radial-gradient(circle, rgba(234,179,8,0.3) 0%, transparent 70%)"
                : level.id === "elite"
                ? "radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)"
                : level.id === "destaque"
                ? "radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)"
                : level.id === "engajado"
                ? "radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
            transform: "scale(1.5)",
          }}
        />
      )}

      {/* Level effect overlay wrapper */}
      <div className={cn("rounded-full overflow-hidden", animated && style.effectClass, sizeMap[size])}>
        {use3D ? (
          /* 3D model-viewer for lg/xl */
          <Suspense
            fallback={
              <Avatar className={cn(sizeMap[size], "ring-2", style.ring)}>
                <AvatarFallback className={cn(style.bg, "text-white font-bold", textSizeMap[size])}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            }
          >
            <Avatar3DViewer src={avatarUrl!} size={size as "lg" | "xl"} />
          </Suspense>
        ) : (
          /* 2D avatar for sm/md or no 3D */
          <Avatar
            className={cn(
              sizeMap[size],
              "ring-2 transition-all duration-300",
              style.ring,
              animated && style.aura,
            )}
          >
            <AvatarImage src={flatImageUrl || undefined} alt={nome} />
            <AvatarFallback
              className={cn(
                style.bg,
                "text-white font-bold",
                textSizeMap[size],
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Accessory layers */}
      {showBadges && (
        <>
          {/* Crown for #1 */}
          {isTop1 && (
            <span
              className={cn(
                "absolute z-20 left-1/2 -translate-x-1/2",
                crownSizeMap[size],
                animated && "animate-bounce",
              )}
              style={{ animationDuration: "2s" }}
            >
              👑
            </span>
          )}
          {ranking === 2 && (
            <span className={cn("absolute z-20", medalSizeMap[size])}>🥈</span>
          )}
          {ranking === 3 && (
            <span className={cn("absolute z-20", medalSizeMap[size])}>🥉</span>
          )}

          {/* Streak fire */}
          {streak > 0 && !isTop1 && (
            <span className={cn("absolute z-20", streakSizeMap[size])}>
              {streak > 14 ? "⚡" : streak > 7 ? "🔥🔥" : "🔥"}
            </span>
          )}

          {/* Level indicator dot (small sizes only) */}
          {(size === "sm" || size === "md") && (
            <span
              className={cn(
                "absolute -bottom-0.5 -left-0.5 z-20 flex items-center justify-center rounded-full border border-background",
                size === "sm" ? "h-3.5 w-3.5 text-[7px]" : "h-4.5 w-4.5 text-[9px]",
              )}
              title={`${level.emoji} ${level.label}`}
            >
              {level.emoji}
            </span>
          )}

          {/* Lendario orbiting particles */}
          {level.id === "lendario" && animated && (size === "lg" || size === "xl") && (
            <>
              <span className="absolute z-10 avatar-particle avatar-particle-1">✨</span>
              <span className="absolute z-10 avatar-particle avatar-particle-2">✨</span>
              <span className="absolute z-10 avatar-particle avatar-particle-3">✨</span>
              <span className="absolute z-10 avatar-particle avatar-particle-4">✨</span>
            </>
          )}
        </>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes avatar-glow {
          0%, 100% { opacity: 0.6; transform: scale(1.4); }
          50% { opacity: 1; transform: scale(1.6); }
        }
        @keyframes avatar-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1.3); }
          50% { opacity: 0.8; transform: scale(1.5); }
        }
        .avatar-effect-ativo {
          box-shadow: 0 0 20px rgba(59,130,246,0.6);
          animation: effect-pulse 2s ease-in-out infinite;
        }
        .avatar-effect-engajado {
          border: 2px solid transparent;
          background-origin: border-box;
          background-clip: padding-box, border-box;
          animation: effect-spin-border 4s linear infinite;
          box-shadow: 0 0 16px rgba(249,115,22,0.5);
        }
        .avatar-effect-destaque {
          box-shadow: 0 0 20px rgba(245,158,11,0.5);
          animation: effect-pulse 2.5s ease-in-out infinite;
        }
        .avatar-effect-elite {
          background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(236,72,153,0.2));
          background-size: 200% 200%;
          animation: effect-shimmer 3s ease infinite;
          box-shadow: 0 0 24px rgba(168,85,247,0.5);
        }
        .avatar-effect-lendario {
          box-shadow: 0 0 30px rgba(234,179,8,0.8);
          animation: effect-pulse 1.5s ease-in-out infinite;
        }
        @keyframes effect-pulse {
          0%, 100% { box-shadow: 0 0 12px currentColor; }
          50% { box-shadow: 0 0 24px currentColor; }
        }
        @keyframes effect-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes effect-spin-border {
          from { border-image: conic-gradient(from 0deg, #f97316, #fb923c, #f97316) 1; }
          to { border-image: conic-gradient(from 360deg, #f97316, #fb923c, #f97316) 1; }
        }
        @keyframes avatar-orbit {
          from { transform: rotate(0deg) translateX(140%) rotate(0deg); }
          to { transform: rotate(360deg) translateX(140%) rotate(-360deg); }
        }
        .avatar-particle {
          font-size: 10px;
          top: 50%;
          left: 50%;
          pointer-events: none;
          animation: avatar-orbit 4s linear infinite;
        }
        .avatar-particle-1 { animation-delay: 0s; }
        .avatar-particle-2 { animation-delay: -1s; }
        .avatar-particle-3 { animation-delay: -2s; }
        .avatar-particle-4 { animation-delay: -3s; }
      `}</style>
    </div>
  );
}
