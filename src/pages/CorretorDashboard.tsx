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
import { useRoletaPerformanceStatus } from "@/hooks/useRoletaPerformanceStatus";

import OnboardingWidget from "@/components/corretor/OnboardingWidget";
import FocusModeModal from "@/components/pipeline/FocusModeModal";

import RoletaTurnoCard from "@/components/corretor/rotina/RoletaTurnoCard";
import MinhaEvolucaoKpis from "@/components/corretor/rotina/MinhaEvolucaoKpis";
import MeuFocoHoje from "@/components/corretor/rotina/MeuFocoHoje";
import EvolucaoSemanasChart from "@/components/corretor/rotina/EvolucaoSemanasChart";
import AtalhosRotina from "@/components/corretor/rotina/AtalhosRotina";
import AgendaResumoWidget from "@/components/corretor/AgendaResumoWidget";
// WidgetProdutividadeCorretor removido — métricas não estavam funcionais.
import { MutiraoPulseBanner } from "@/components/oferta-ativa-ao-vivo/MutiraoPulseBanner";


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
  const [focusOpen] = useState(false);
  const { data: perf } = useRoletaPerformanceStatus();
  const horaBRT = Number(new Date().toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
  const saudacao = horaBRT < 12 ? "Bom dia" : horaBRT < 18 ? "Boa tarde" : "Boa noite";

  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto pb-10">
      <OnboardingWidget />

      {/* CTA Mutirão Inteligente (aparece quando ao vivo ou janela típica) */}
      <MutiraoPulseBanner />



      {/* 1. Saudação HOMI (gradient inline — intocado) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="rounded-2xl p-5 text-primary-foreground relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary"
        >
          <div className="flex items-center gap-4">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile?.nome || "Avatar"}
                className="h-16 w-16 shrink-0 rounded-full object-cover border-2 border-primary-foreground/30"
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-primary-foreground font-black text-xl select-none border-2 border-primary-foreground/30"
                style={{ background: "hsl(var(--primary-foreground) / 0.15)" }}
              >
                {initials || "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold truncate">{saudacao}, {primeiroNome}! 👋</p>
              <p className="text-sm text-primary-foreground/80 italic leading-snug mt-0.5">"{motivation}"</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs capitalize">{dataFormatada}</span>
                {perf?.crm_atende && (
                  <span className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs font-semibold">🏆 Padrão Uhome conquistado</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. Roleta do turno: barra de credenciamento + estado + regras */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="space-y-2">
        <RoletaTurnoCard />
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-3.5">
        <div className="flex-1 min-w-0 space-y-5">
          <MinhaEvolucaoKpis />
          <MeuFocoHoje />
          <EvolucaoSemanasChart />
        </div>
        <div className="w-full lg:w-[280px] shrink-0 space-y-3.5">
          <AgendaResumoWidget />
          <AtalhosRotina />
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
