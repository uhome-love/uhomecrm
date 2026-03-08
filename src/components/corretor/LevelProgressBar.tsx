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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${level.bgColor}`}>
            <Trophy className={`h-4.5 w-4.5 ${level.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-display font-extrabold text-foreground">{points} pts</span>
              <Badge variant="outline" className={`text-[10px] font-bold ${level.color}`}>
                {level.emoji} {level.label}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {next ? `${pointsToNext} pts para ${next.emoji} ${next.label}` : "Nível máximo alcançado!"}
            </p>
          </div>
        </div>
      </div>
      <div className="relative">
        <Progress value={progress} className="h-2" />
        <motion.div
          className="absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r from-primary/80 to-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
