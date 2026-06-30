// =============================================================================
// CorretorDashboard v3 — Layout 2 colunas + 3 blocos enxutos + Tarefas lateral
// Sprint 1 (Modo Foco V2), saudação HOMI, RoletaStatusBar e FocusModeModal
// permanecem intocados. useCorretorHomeData não é mais consumido aqui (mas
// o arquivo segue preservado para outras telas).
// =============================================================================

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import { useConquistas } from "@/hooks/useConquistas";

import RoletaStatusBar from "@/components/corretor/RoletaStatusBar";
import CelebrationOverlay from "@/components/corretor/CelebrationOverlay";
import OnboardingWidget from "@/components/corretor/OnboardingWidget";
import FocusModeModal from "@/components/pipeline/FocusModeModal";

import CarteiraKpis from "@/components/corretor/CarteiraKpis";
import PreEstagnacaoCard from "@/components/corretor/PreEstagnacaoCard";
import ConquistasKpis from "@/components/corretor/ConquistasKpis";
import CaminhosCards from "@/components/corretor/CaminhosCards";
import TarefasHojeLateral from "@/components/corretor/TarefasHojeLateral";

export default function CorretorDashboard() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<{ nome?: string; avatar_url?: string; avatar_preview_url?: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nome, avatar_url, avatar_preview_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  const avatarSrc = profile?.avatar_url || profile?.avatar_preview_url;
  const primeiroNome = (profile?.nome || "Corretor").split(" ")[0];
  const initials = (profile?.nome || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const motivation = useDailyMotivation();
  const { newlyUnlocked, dismissCelebration } = useConquistas();
  const [focusOpen] = useState(false);

  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto pb-10">
      <CelebrationOverlay achievement={newlyUnlocked} onDismiss={dismissCelebration} />
      <OnboardingWidget />

      {/* 1. Saudação HOMI (gradient inline — intocado) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="rounded-2xl p-5 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #4969FF, #7C3AED, #3350E6)" }}
        >
          <div className="flex items-center gap-4">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile?.nome || "Avatar"}
                className="h-16 w-16 shrink-0 rounded-full object-cover border-2 border-white/30"
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white font-black text-xl select-none border-2 border-white/30"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                {initials || "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold truncate">Olá, {primeiroNome}! 👋</p>
              <p className="text-sm text-white/80 italic leading-snug mt-0.5">"{motivation}"</p>
              <p className="text-xs text-white/60 mt-1 capitalize">{dataFormatada}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. RoletaStatusBar (intocada) */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
        <RoletaStatusBar />
      </motion.div>

      {/* 3. Layout 2 colunas: principal (3 blocos) + lateral fixa 280px */}
      <div className="flex flex-col lg:flex-row gap-3.5">
        {/* Coluna principal */}
        <div className="flex-1 min-w-0 space-y-5">
          <PreEstagnacaoCard />
          <CarteiraKpis />
          <ConquistasKpis />
          <CaminhosCards />
        </div>

        {/* Coluna lateral — desktop ≥1024px */}
        <div className="hidden lg:block w-[280px] shrink-0">
          <TarefasHojeLateral variant="desktop" />
        </div>

        {/* Lateral — tablet/mobile vira accordion abaixo dos cards */}
        <div className="lg:hidden">
          <TarefasHojeLateral variant="mobile" />
        </div>
      </div>

      {/* FocusModeModal montado (mantido) */}
      <FocusModeModal
        open={focusOpen}
        onClose={() => {}}
        pipelineTipo="leads"
        initialCriteria={["all"]}
      />
    </div>
  );
}
