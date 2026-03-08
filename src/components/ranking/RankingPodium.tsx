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

function getInitials(nome: string) {
  return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

const podiumConfig = [
  { pos: 1, height: 60, bg: "#94A3B8", borderColor: "#94A3B8", delay: 0.15, avatarSize: 64, avatarBorder: "3px solid #94A3B8", avatarShadow: "none", fontSize: 18 },
  { pos: 0, height: 80, bg: "#F59E0B", borderColor: "#F59E0B", delay: 0, avatarSize: 80, avatarBorder: "3px solid #F59E0B", avatarShadow: "0 0 20px rgba(245,158,11,0.3)", fontSize: 24 },
  { pos: 2, height: 48, bg: "#CD7F32", borderColor: "#CD7F32", delay: 0.25, avatarSize: 64, avatarBorder: "3px solid #CD7F32", avatarShadow: "none", fontSize: 18 },
];

export default function RankingPodium({ entries }: Props) {
  if (entries.length < 3) return null;

  // Reorder: [2nd, 1st, 3rd]
  const display = [entries[1], entries[0], entries[2]];

  return (
    <div className="flex items-end justify-center gap-4 sm:gap-8 pt-8 pb-3 px-4">
      {display.map((entry, displayIdx) => {
        const cfg = podiumConfig[displayIdx];
        const realPos = cfg.pos;
        const level = getLevel(entry.points);
        const isGold = realPos === 0;

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: cfg.delay, duration: 0.4 }}
            className="flex flex-col items-center gap-1.5"
            style={{ minWidth: isGold ? 110 : 90 }}
          >
            {/* Crown for #1 */}
            {isGold && <span style={{ fontSize: 24 }}>👑</span>}

            {/* Avatar */}
            <div
              className="flex items-center justify-center rounded-full font-black text-gray-700 shrink-0"
              style={{
                width: cfg.avatarSize,
                height: cfg.avatarSize,
                border: cfg.avatarBorder,
                boxShadow: cfg.avatarShadow,
                background: "#F3F4F6",
                fontSize: cfg.fontSize,
              }}
            >
              {getInitials(entry.nome)}
            </div>

            <p className="text-sm font-semibold text-gray-800 text-center truncate max-w-[100px]">
              {entry.nome}
            </p>
            <p className="text-lg font-black text-gray-900">{entry.value}</p>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                color: level.color?.includes("emerald") ? "#059669" : level.color?.includes("amber") ? "#D97706" : "#6B7280",
                background: "rgba(0,0,0,0.05)",
              }}
            >
              {level.emoji} {level.label}
            </span>

            {/* Podium bar */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: cfg.height }}
              transition={{ delay: cfg.delay + 0.1, duration: 0.5, ease: "easeOut" }}
              className="w-full flex items-center justify-center"
              style={{
                background: cfg.bg,
                borderRadius: "8px 8px 0 0",
              }}
            >
              <span className="text-sm font-black text-white">#{realPos + 1}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
