import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ImmersiveScreen, { ConfettiBurst, ImmersiveLabel } from "./ImmersiveScreen";
import type { AchievementDef } from "@/lib/gamification";

interface Props {
  achievement: AchievementDef | null;
  onDismiss: () => void;
}

export default function AchievementUnlockedScreen({ achievement, onDismiss }: Props) {
  const navigate = useNavigate();

  // Auto-close after 5 seconds
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  return (
    <AnimatePresence>
      <ImmersiveScreen fullScreen onClose={onDismiss}>
        <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
          <ConfettiBurst count={50} />

          <ImmersiveLabel>CONQUISTA DESBLOQUEADA</ImmersiveLabel>

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 10, stiffness: 200 }}
            className="text-8xl"
          >
            {achievement.emoji}
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <h2 className="text-3xl font-black text-white mb-2">
              {achievement.label}
            </h2>
            <p className="text-sm text-neutral-400 max-w-xs mx-auto">
              {achievement.description}
            </p>
            <p className="text-xs text-[#60A5FA] font-semibold mt-3">
              +50 XP · +badge no perfil
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex gap-3 mt-2"
          >
            <Button
              variant="outline"
              onClick={() => { onDismiss(); navigate("/conquistas"); }}
              className="border-white/20 text-white bg-white/5 hover:bg-white/10 rounded-xl px-5 h-10"
            >
              Ver todas conquistas
            </Button>
            <Button
              onClick={onDismiss}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-0 rounded-xl px-5 h-10"
            >
              Continuar →
            </Button>
          </motion.div>
        </div>
      </ImmersiveScreen>
    </AnimatePresence>
  );
}
