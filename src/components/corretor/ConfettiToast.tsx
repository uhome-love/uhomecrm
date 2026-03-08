/**
 * Lightweight confetti burst component — renders particles at a target position.
 * Uses CSS animations, no external library.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCelebrationEnabled } from "@/lib/celebrations";

const COLORS = ["hsl(var(--primary))", "#FFD700", "#FF6B6B", "#4ECDC4", "#A855F7", "#F97316"];

interface Props {
  trigger: number; // increment to trigger
  intensity?: "light" | "moderate" | "intense";
}

export default function ConfettiBurst({ trigger, intensity = "light" }: Props) {
  const [particles, setParticles] = useState<number[]>([]);

  useEffect(() => {
    if (trigger <= 0 || !getCelebrationEnabled()) return;
    const count = intensity === "intense" ? 50 : intensity === "moderate" ? 30 : 15;
    setParticles(Array.from({ length: count }, (_, i) => i));
    const t = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(t);
  }, [trigger, intensity]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {particles.map((i) => (
          <motion.div
            key={`${trigger}-${i}`}
            initial={{ 
              x: window.innerWidth / 2, 
              y: window.innerHeight / 2, 
              scale: 0, 
              opacity: 1 
            }}
            animate={{
              x: window.innerWidth / 2 + (Math.random() - 0.5) * 800,
              y: (Math.random() - 0.3) * window.innerHeight,
              scale: Math.random() * 1.5 + 0.5,
              opacity: 0,
              rotate: Math.random() * 720,
            }}
            transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}
            className="absolute pointer-events-none"
            style={{
              width: 6 + Math.random() * 8,
              height: 6 + Math.random() * 8,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              backgroundColor: COLORS[Math.floor(Math.random() * COLORS.length)],
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
