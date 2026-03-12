import { getLevel } from "@/lib/gamification";
import { motion } from "framer-motion";
import { Crown, TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface PodiumEntry {
  id: string;
  nome: string;
  value: string;
  points: number;
  avatarUrl?: string | null;
  avatarGamificadoUrl?: string | null;
  isMe?: boolean;
  /** Position change: positive = subiu, negative = caiu, 0 = manteve */
  delta?: number;
}

interface Props {
  entries: PodiumEntry[];
}

function getInitials(nome: string) {
  return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getFirstName(nome: string) {
  return nome.split(" ")[0];
}

const podiumConfig = [
  { pos: 1, height: 56, ringColor: "hsl(var(--muted-foreground))", delay: 0.15, avatarSize: 56, label: "2º" },
  { pos: 0, height: 72, ringColor: "#F59E0B", delay: 0, avatarSize: 72, label: "1º" },
  { pos: 2, height: 44, ringColor: "#CD7F32", delay: 0.25, avatarSize: 52, label: "3º" },
];

function DeltaBadge({ delta }: { delta?: number }) {
  if (delta === undefined || delta === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[9px] font-semibold text-muted-foreground">
        <Minus className="h-2.5 w-2.5" /> =
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600">
        <TrendingUp className="h-2.5 w-2.5" /> +{delta}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500">
      <TrendingDown className="h-2.5 w-2.5" /> {delta}
    </span>
  );
}

export default function RankingPodium({ entries }: Props) {
  if (entries.length < 3) return null;

  // Reorder: [2nd, 1st, 3rd]
  const display = [entries[1], entries[0], entries[2]];

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6 pt-6 pb-2 px-4">
      {display.map((entry, displayIdx) => {
        const cfg = podiumConfig[displayIdx];
        const realPos = cfg.pos;
        const isGold = realPos === 0;
        const imgSrc = entry.avatarGamificadoUrl || entry.avatarUrl;
        const level = getLevel(entry.points);

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: cfg.delay, duration: 0.4 }}
            className="flex flex-col items-center gap-1"
            style={{ minWidth: isGold ? 100 : 80 }}
          >
            {/* Crown for #1 */}
            {isGold && (
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
              >
                <Crown className="h-6 w-6 text-amber-400 drop-shadow-md" fill="currentColor" />
              </motion.div>
            )}

            {/* Avatar with ring */}
            <div
              className="rounded-full shrink-0 overflow-hidden relative"
              style={{
                width: cfg.avatarSize,
                height: cfg.avatarSize,
                border: `3px solid ${cfg.ringColor}`,
                boxShadow: isGold ? "0 0 24px rgba(245,158,11,0.3)" : "none",
              }}
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={entry.nome}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      parent.classList.add("flex", "items-center", "justify-center", "bg-accent");
                      const span = document.createElement("span");
                      span.className = "font-black text-foreground";
                      span.style.fontSize = isGold ? "20px" : "16px";
                      span.textContent = getInitials(entry.nome);
                      parent.appendChild(span);
                    }
                  }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center font-black text-foreground bg-accent"
                  style={{ fontSize: isGold ? 20 : 16 }}
                >
                  {getInitials(entry.nome)}
                </div>
              )}
            </div>

            {/* Name */}
            <p className="text-xs font-bold text-foreground text-center truncate max-w-[90px]">
              {getFirstName(entry.nome)}
            </p>

            {/* Value + delta */}
            <div className="flex flex-col items-center">
              <p className={`font-black ${isGold ? "text-base" : "text-sm"} text-foreground`}>{entry.value}</p>
              <DeltaBadge delta={entry.delta} />
            </div>

            {/* Level badge */}
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${level.bgColor} ${level.color}`}
            >
              {level.emoji} {level.label}
            </span>

            {/* Podium bar */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: cfg.height }}
              transition={{ delay: cfg.delay + 0.1, duration: 0.5, ease: "easeOut" }}
              className="w-full flex items-center justify-center rounded-t-lg"
              style={{
                background: isGold
                  ? "linear-gradient(180deg, #F59E0B, #D97706)"
                  : realPos === 1
                  ? "linear-gradient(180deg, hsl(var(--muted-foreground)/0.6), hsl(var(--muted-foreground)/0.4))"
                  : "linear-gradient(180deg, #CD7F32, #A0622D)",
              }}
            >
              <span className="text-xs font-black text-white">{cfg.label}</span>
            </motion.div>

            {/* "Você" indicator */}
            {entry.isMe && (
              <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full -mt-0.5">
                ← você
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
