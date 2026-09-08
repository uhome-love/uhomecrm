import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EVENT_CONFIG, getRelativeTime, type PulseEvent, type EmojiType } from "@/hooks/usePulse";
import PulseReactionBar from "./PulseReactionBar";

interface PulseEventCardProps {
  event: PulseEvent;
  isNew: boolean;
  currentUserId?: string;
  onReact: (eventId: string, emoji: EmojiType) => void;
}

export default function PulseEventCard({ event, isNew, currentUserId, onReact }: PulseEventCardProps) {
  const config = EVENT_CONFIG[event.tipo] || { icon: "📌", borderColor: "border-border" };
  const isHighPriority = event.prioridade === "alta";
  const isOwnEvent = event.corretor_id === currentUserId;
  const initials = (event.corretor_nome || "C").split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: 40 } : { opacity: 1 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`rounded-xl p-3 border shadow-sm transition-shadow hover:shadow-md ${
        isNew ? "bg-primary/5" : "bg-card"
      } ${isHighPriority ? "ring-1 ring-primary/20 animate-pulse-slow" : "border-border/60"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`relative shrink-0`}>
          <Avatar className={`h-8 w-8 border-2 ${config.borderColor}`}>
            <AvatarImage src={event.corretor_avatar || undefined} />
            <AvatarFallback className="text-[10px] font-bold">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 text-xs">{config.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {event.corretor_nome?.split(" ")[0]}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {getRelativeTime(event.created_at)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.titulo}</p>
          {event.descricao && (
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 italic line-clamp-1">{event.descricao}</p>
          )}

          <PulseReactionBar
            reactions={event.reactions || {}}
            isOwnEvent={isOwnEvent}
            onReact={(emoji) => onReact(event.id, emoji)}
          />
        </div>
      </div>
    </motion.div>
  );
}
