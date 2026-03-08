import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import ImmersiveScreen, { ConfettiBurst, ImmersiveLabel } from "./ImmersiveScreen";

interface DailyGoals {
  ligacoes: number;
  metaLigacoes: number;
  aproveitados: number;
  metaAproveitados: number;
  visitas: number;
  metaVisitas: number;
  streak: number;
  userName: string;
}

interface Props {
  goals: DailyGoals;
  onDismiss: () => void;
}

export default function DailyGoalCompleteScreen({ goals, onDismiss }: Props) {
  return (
    <AnimatePresence>
      <ImmersiveScreen fullScreen onClose={onDismiss}>
        <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
          <ConfettiBurst count={70} />

          <ImmersiveLabel>META DO DIA COMPLETA!</ImmersiveLabel>

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-8xl"
          >
            🏆
          </motion.div>

          <motion.h1
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-black text-white text-center"
          >
            {goals.userName}, você é LENDA hoje!
          </motion.h1>

          {/* Goals checklist */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="space-y-2 w-full max-w-xs"
          >
            {[
              { icon: "🔥", current: goals.ligacoes, meta: goals.metaLigacoes, label: "ligações" },
              { icon: "✅", current: goals.aproveitados, meta: goals.metaAproveitados, label: "aproveitados" },
              { icon: "📅", current: goals.visitas, meta: goals.metaVisitas, label: "visitas" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-white font-bold text-lg">
                  {item.current}/{item.meta}
                </span>
                <span className="text-neutral-400 text-sm">{item.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {goals.streak > 1 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-[#60A5FA] font-bold text-sm"
            >
              🔥 Streak: {goals.streak} dias seguidos!
            </motion.p>
          )}

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="flex gap-3 mt-2"
          >
            <Button
              variant="outline"
              onClick={onDismiss}
              className="border-white/20 text-white bg-white/5 hover:bg-white/10 rounded-xl px-5 h-10"
            >
              Compartilhar 🎉
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
