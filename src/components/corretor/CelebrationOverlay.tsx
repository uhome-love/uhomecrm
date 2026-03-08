import { motion, AnimatePresence } from "framer-motion";
import type { AchievementDef } from "@/lib/gamification";

interface Props {
  achievement: AchievementDef | null;
  onDismiss: () => void;
}

export default function CelebrationOverlay({ achievement, onDismiss }: Props) {
  if (!achievement) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      >
        {/* Confetti particles */}
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: 0, y: 0, scale: 0, opacity: 1,
            }}
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
              backgroundColor: ["hsl(var(--primary))", "#FFD700", "#FF6B6B", "#4ECDC4", "#A855F7", "#F97316"][Math.floor(Math.random() * 6)],
            }}
          />
        ))}

        {/* Achievement card */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
          className="relative bg-card border border-border rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4"
          onClick={e => e.stopPropagation()}
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: 2, duration: 0.6 }}
            className="text-6xl mb-4"
          >
            {achievement.emoji}
          </motion.div>

          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
            🏆 Conquista Desbloqueada!
          </p>
          <h2 className="text-xl font-display font-extrabold text-foreground mb-2">
            {achievement.label}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {achievement.description}
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDismiss}
            className="px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold"
          >
            Incrível! 🎉
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
