import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImmersiveScreen, { ConfettiBurst, ImmersiveLabel } from "./ImmersiveScreen";

interface Props {
  rankingName: string;
  userName: string;
  onDismiss: () => void;
}

export default function LeadershipScreen({ rankingName, userName, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <ImmersiveScreen fullScreen onClose={onDismiss}>
        <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
          <ConfettiBurst count={50} colors={["#FFD700", "#FFA500", "#FFEC44", "#F59E0B"]} />

          <ImmersiveLabel>VOCÊ LIDERA!</ImmersiveLabel>

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-8xl"
          >
            👑
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <p className="text-sm text-neutral-400 mb-1">{rankingName}</p>
            <h2 className="text-2xl font-black text-white mb-3">
              {userName} assumiu a liderança!
            </h2>
            <p className="text-sm text-neutral-400">
              Defende o trono. 🔥
            </p>
          </motion.div>
        </div>
      </ImmersiveScreen>
    </AnimatePresence>
  );
}
