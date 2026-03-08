import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getLevel } from "@/lib/gamification";
import { motion } from "framer-motion";

export interface PodiumEntry {
  id: string;
  nome: string;
  value: string;
  points: number;
  avatarUrl?: string | null;
  isMe?: boolean;
}

interface Props {
  entries: PodiumEntry[];
}

const podiumConfig = [
  { pos: 1, medal: "🥈", height: 60, bg: "bg-neutral-300 dark:bg-neutral-600", border: "ring-neutral-400", order: 0, delay: 0.15 },
  { pos: 0, medal: "🥇", height: 80, bg: "bg-amber-400 dark:bg-amber-500", border: "ring-amber-400 animate-pulse", order: 1, delay: 0 },
  { pos: 2, medal: "🥉", height: 45, bg: "bg-amber-700 dark:bg-amber-800", border: "ring-amber-700", order: 2, delay: 0.25 },
];

const avatarBorder = [
  "ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]",
  "ring-2 ring-neutral-400",
  "ring-2 ring-amber-700",
];

function getInitials(nome: string) {
  return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function RankingPodium({ entries }: Props) {
  if (entries.length < 3) return null;

  // Reorder: [2nd, 1st, 3rd]
  const display = [entries[1], entries[0], entries[2]];

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6 pt-6 pb-2">
      {display.map((entry, displayIdx) => {
        const cfg = podiumConfig[displayIdx];
        const realPos = cfg.pos;
        const level = getLevel(entry.points);

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: cfg.delay, duration: 0.4 }}
            className="flex flex-col items-center gap-1.5 min-w-[80px] sm:min-w-[100px]"
          >
            <span className="text-2xl">{cfg.medal}</span>
            <Avatar className={`h-12 w-12 ${avatarBorder[realPos]}`}>
              <AvatarFallback className="text-sm font-bold bg-muted">
                {getInitials(entry.nome)}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs font-bold text-foreground text-center truncate max-w-[90px]">
              {entry.nome}
            </p>
            <p className="text-sm font-bold text-foreground">{entry.value}</p>
            <span className={`text-[10px] font-semibold ${level.color}`}>
              {level.emoji} {level.label}
            </span>
            {/* Podium bar */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: cfg.height }}
              transition={{ delay: cfg.delay + 0.1, duration: 0.5, ease: "easeOut" }}
              className={`w-full rounded-t-lg ${cfg.bg} flex items-center justify-center`}
            >
              <span className="text-xs font-bold text-white/80">#{realPos + 1}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
