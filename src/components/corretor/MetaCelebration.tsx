/**
 * Full-screen meta completion celebration — shown for 4 seconds when all 3 daily goals are met.
 */
import { motion, AnimatePresence } from "framer-motion";
import { playSoundFanfare, getCelebrationEnabled } from "@/lib/celebrations";
import { useEffect } from "react";

interface Props {
  show: boolean;
  nome: string;
  onDismiss: () => void;
}

const COLORS = ["hsl(var(--primary))", "#FFD700", "#FF6B6B", "#4ECDC4", "#A855F7", "#F97316", "#10B981"];

export default function MetaCelebration({ show, nome, onDismiss }: Props) {
  useEffect(() => {
    if (show && getCelebrationEnabled()) {
      playSoundFanfare();
      const t = setTimeout(onDismiss, 5000);
      return () => clearTimeout(t);
    }
  }, [show, onDismiss]);

  if (!show || !getCelebrationEnabled()) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onDismiss}
      >
        {/* Confetti */}
        {Array.from({ length: 60 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: (Math.random() - 0.5) * 800,
              y: (Math.random() - 0.5) * 800,
              scale: Math.random() * 2 + 0.5,
              opacity: 0,
              rotate: Math.random() * 720,
            }}
            transition={{ duration: 2.5 + Math.random(), ease: "easeOut" }}
            className="absolute pointer-events-none"
            style={{
              width: 8 + Math.random() * 10,
              height: 8 + Math.random() * 10,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              backgroundColor: COLORS[Math.floor(Math.random() * COLORS.length)],
            }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
          className="relative bg-card border border-border rounded-2xl p-10 text-center shadow-2xl max-w-md mx-4"
          onClick={e => e.stopPropagation()}
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
            transition={{ repeat: 3, duration: 0.6 }}
            className="text-7xl mb-4"
          >
            🏆
          </motion.div>

          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
            ⭐ META DO DIA COMPLETA ⭐
          </p>
          <h2 className="text-2xl font-display font-extrabold text-foreground mb-2">
            {nome}, você arrasou!
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Todas as metas batidas. Isso é consistência! 💪
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDismiss}
            className="px-8 py-3 rounded-full bg-primary text-primary-foreground text-sm font-bold"
          >
            Valeu! 🎉
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
