import { AnimatePresence } from "framer-motion";
import AchievementUnlockedScreen from "@/components/immersive/AchievementUnlockedScreen";
import type { AchievementDef } from "@/lib/gamification";

interface Props {
  achievement: AchievementDef | null;
  onDismiss: () => void;
}

export default function CelebrationOverlay({ achievement, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {achievement && (
        <AchievementUnlockedScreen
          achievement={achievement}
          onDismiss={onDismiss}
        />
      )}
    </AnimatePresence>
  );
}
