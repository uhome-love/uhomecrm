import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImmersiveScreen, { ConfettiBurst, ImmersiveLabel } from "./ImmersiveScreen";

interface Props {
  fromEmoji: string;
  fromLabel: string;
  toEmoji: string;
  toLabel: string;
  message?: string;
  onDismiss: () => void;
}

export default function TitleEvolutionScreen({
  fromEmoji, fromLabel, toEmoji, toLabel, message, onDismiss,
}: Props) {
  // Auto-close after 3 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <ImmersiveScreen fullScreen onClose={onDismiss}>
        <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
          <ConfettiBurst count={30} colors={["#60A5FA", "#4969FF", "#818CF8", "#FFD700"]} />

          <ImmersiveLabel>EVOLUIU!</ImmersiveLabel>

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="flex items-center gap-6"
          >
            <span className="text-6xl">{fromEmoji}</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.3 }}
              className="text-3xl text-neutral-500"
            >
              →
            </motion.span>
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.4, damping: 8 }}
              className="text-7xl"
            >
              {toEmoji}
            </motion.span>
          </motion.div>

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <p className="text-neutral-500 text-sm">
              {fromLabel} →{" "}
              <span className="text-white font-black text-lg">{toLabel}!</span>
            </p>
            {message && (
              <p className="text-sm text-neutral-400 mt-2">{message}</p>
            )}
          </motion.div>
        </div>
      </ImmersiveScreen>
    </AnimatePresence>
  );
}
