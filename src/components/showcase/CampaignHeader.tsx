import { Star } from "lucide-react";
import { motion } from "framer-motion";
import type { ShowcaseCorretor, ShowcaseVitrine } from "./types";

interface CampaignHeaderProps {
  vitrine: ShowcaseVitrine;
  corretor: ShowcaseCorretor | null;
  badgeText?: string;
  accentColor?: string;
}

export default function CampaignHeader({ vitrine, corretor, badgeText = "Seleção Melnick Day 2026", accentColor }: CampaignHeaderProps) {
  return (
    <header className="relative overflow-hidden">
      {/* Navy gradient background */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #1e40af 70%, #3b82f6 100%)",
      }} />
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 30% 20%, rgba(251,191,36,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.2) 0%, transparent 50%)",
      }} />
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 40px, white 40px, white 41px)",
      }} />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 pb-16 sm:pt-16 sm:pb-24 relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center space-y-6">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center gap-2.5 rounded-full px-6 py-2.5"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.15))",
              border: "1px solid rgba(251,191,36,0.4)",
              boxShadow: "0 0 30px rgba(251,191,36,0.15)",
            }}
          >
            <Star className="h-4 w-4 text-amber-300" fill="currentColor" />
            <span className="text-amber-100 text-xs sm:text-sm font-bold tracking-[0.25em] uppercase">{badgeText}</span>
            <Star className="h-4 w-4 text-amber-300" fill="currentColor" />
          </motion.div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.05]"
            style={{ textShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>
            {vitrine.titulo}
          </h1>

          {vitrine.mensagem && (
            <p className="text-blue-100/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">{vitrine.mensagem}</p>
          )}

          {/* Corretor badge */}
          {corretor && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="inline-flex items-center gap-3.5 rounded-full px-5 py-3"
              style={{
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.15)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
            >
              {corretor.avatar_url ? (
                <img src={corretor.avatar_url} alt={corretor.nome}
                  className="w-12 h-12 rounded-full object-cover"
                  style={{ border: "3px solid rgba(251,191,36,0.7)", boxShadow: "0 0 20px rgba(251,191,36,0.3)" }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "3px solid rgba(251,191,36,0.7)" }}>
                  {corretor.nome.charAt(0)}
                </div>
              )}
              <div className="text-left">
                <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-medium">Seleção por</p>
                <p className="text-white font-bold text-sm">{corretor.nome}</p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Wave separator */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" className="w-full" preserveAspectRatio="none">
          <path d="M0 60V20C180 45 360 55 540 50C720 45 900 30 1080 25C1200 22 1320 25 1440 30V60H0Z" fill="white" />
        </svg>
      </div>
    </header>
  );
}
