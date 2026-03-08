import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { GamificationLevel } from "@/lib/gamification";
import { getLevel } from "@/lib/gamification";

export interface CorretorAvatarProps {
  nome: string;
  avatarUrl?: string | null;
  points?: number;
  level?: GamificationLevel;
  ranking?: number;
  streak?: number;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  showBadges?: boolean;
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
}> = {
  iniciante: {
    ring: "ring-neutral-500/40",
    aura: "",
    bg: "bg-neutral-600",
  },
  ativo: {
    ring: "ring-blue-500/60",
    aura: "shadow-[0_0_12px_rgba(59,130,246,0.5)]",
    bg: "bg-blue-600",
  },
  engajado: {
    ring: "ring-orange-500/60",
    aura: "shadow-[0_0_16px_rgba(249,115,22,0.5)]",
    bg: "bg-orange-600",
  },
  destaque: {
    ring: "ring-amber-400/70",
    aura: "shadow-[0_0_20px_rgba(245,158,11,0.5)]",
    bg: "bg-amber-500",
  },
  elite: {
    ring: "ring-purple-500/70",
    aura: "shadow-[0_0_24px_rgba(168,85,247,0.5)]",
    bg: "bg-purple-600",
  },
  lendario: {
    ring: "ring-yellow-400/80",
    aura: "shadow-[0_0_32px_rgba(234,179,8,0.6)]",
    bg: "bg-yellow-500",
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

export default function CorretorAvatar({
  nome,
  avatarUrl,
  points = 0,
  level: levelOverride,
  ranking,
  streak = 0,
  size = "md",
  animated = true,
  showBadges = true,
  className,
}: CorretorAvatarProps) {
  const level = levelOverride || getLevel(points);
  const style = levelStyles[level.id] || levelStyles.iniciante;
  const initials = useMemo(() => getInitials(nome), [nome]);

  const isTop1 = ranking === 1;
  const isTop3 = ranking !== undefined && ranking >= 1 && ranking <= 3;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
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

      {/* Main avatar */}
      <Avatar
        className={cn(
          sizeMap[size],
          "ring-2 transition-all duration-300",
          style.ring,
          animated && style.aura,
        )}
      >
        <AvatarImage src={avatarUrl || undefined} alt={nome} />
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

      {/* Accessory layers */}
      {showBadges && (
        <>
          {/* Crown / medal for top 3 */}
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
            <span className={cn("absolute z-20", medalSizeMap[size])}>
              🥈
            </span>
          )}
          {ranking === 3 && (
            <span className={cn("absolute z-20", medalSizeMap[size])}>
              🥉
            </span>
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
      `}</style>
    </div>
  );
}
