import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/gamification";
import { Trophy } from "lucide-react";

interface Props {
  points: number;
  compact?: boolean;
}

export default function LevelProgressBar({ points, compact = false }: Props) {
  const level = getLevel(points);
  const next = getNextLevel(points);
  const progress = getLevelProgress(points);
  const pointsToNext = next ? next.minPoints - points : 0;

  if (compact) {
    return (
      <Badge variant="outline" className={`gap-1 text-[10px] font-bold ${level.color}`}>
        {level.emoji} {level.label}
      </Badge>
    );
  }

  const isImmersive = !compact;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${level.bgColor}`}>
            <Trophy className={`h-4.5 w-4.5 ${level.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                style={isImmersive ? { fontSize: 22, color: "#fff" } : undefined}
                className={isImmersive ? "font-black" : "text-lg font-display font-extrabold text-foreground"}
              >
                {points} pts
              </span>
              <Badge
                variant="outline"
                className={`font-semibold ${level.color}`}
                style={isImmersive ? {
                  fontSize: 12,
                  background: "rgba(34,197,94,0.15)",
                  color: "#86efac",
                  border: "1px solid rgba(34,197,94,0.4)",
                } : { fontSize: 10 }}
              >
                {level.emoji} {level.label}
              </Badge>
            </div>
            <p style={isImmersive ? { fontSize: 14, color: "rgba(255,255,255,0.8)" } : { fontSize: 10 }} className={isImmersive ? "" : "text-muted-foreground"}>
              {next ? `${pointsToNext} pts para ${next.emoji} ${next.label}` : "Nível máximo alcançado!"}
            </p>
          </div>
        </div>
      </div>
      <div className="relative">
        <div
          className="h-2.5 w-full rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              background: "linear-gradient(90deg, #60a5fa, #4ade80)",
              boxShadow: "0 0 10px rgba(59,130,246,0.5)",
              maxWidth: "100%",
            }}
          />
        </div>
      </div>
    </div>
  );
}
