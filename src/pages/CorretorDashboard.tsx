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

import { MissaoNatalCard } from "@/natal/MissaoNatalCard";
import RoletaTurnoCard from "@/components/corretor/rotina/RoletaTurnoCard";
import MinhaEvolucaoKpis from "@/components/corretor/rotina/MinhaEvolucaoKpis";
import MeuFocoHoje from "@/components/corretor/rotina/MeuFocoHoje";
import AtalhosRotina from "@/components/corretor/rotina/AtalhosRotina";
import ProximaVisitaCard from "@/components/corretor/rotina/ProximaVisitaCard";
// WidgetProdutividadeCorretor removido — métricas não estavam funcionais.
import { useIsMobile } from "@/hooks/use-mobile";
import { useNatal } from "@/natal/useNatal";
import { GorroNatal } from "@/natal/TemaNatal";
import { NeveSuave } from "@/natal/NeveSuave";
import { diasAte18 } from "@/natal/config";


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
  const isMobile = useIsMobile();
  const natal = useNatal();
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
    <div className="px-0 pt-0 md:px-2 space-y-4 max-w-7xl mx-auto pb-10">
      <OnboardingWidget />




      {/* 1. Celular: título grande estilo iPhone + próxima visita + atalhos redondos */}
      {isMobile && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {natal.efeitos ? (
            <div className="gradient-brand relative overflow-hidden rounded-2xl p-3.5 text-primary-foreground shadow-sm">
              <NeveSuave altura={120} flocos={12} />
              <img src="/natal/homi_noel.png" alt="" aria-hidden className="pointer-events-none absolute bottom-0 right-2 h-[78px] select-none" />
              <div className="relative flex items-center gap-3 pr-16">
                <div className="relative shrink-0">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={profile?.nome || "Avatar"} className="h-11 w-11 rounded-full border-2 border-primary-foreground/40 object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary-foreground/40 font-bold">{initials || "?"}</div>
                  )}
                  <GorroNatal className="-left-2 -top-3 w-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] capitalize text-primary-foreground/75">{dataFormatada}</p>
                  <h1 className="truncate text-[18px] font-bold leading-tight">{saudacao}, {primeiroNome}! 👋</h1>
                </div>
              </div>
              <p className="relative mt-1.5 line-clamp-2 pr-16 text-[12px] italic leading-snug text-primary-foreground/85">"{motivation}"</p>
              <span className="natal-chip-ouro relative mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold">🎁 Faltam {diasAte18()} dias para 18/12</span>
            </div>
          ) : (<>
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0">
              <p className="text-[13px] font-medium capitalize text-muted-foreground">{dataFormatada}</p>
              <h1 className="truncate text-[30px] font-bold leading-tight tracking-tight text-foreground">{saudacao}, {primeiroNome}</h1>
              {natal.efeitos && (
                <span className="natal-chip-ouro mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold">🎁 Faltam {diasAte18()} dias para 18/12</span>
              )}
            </div>
            <div className="relative shrink-0">
            {avatarSrc ? (
              <img src={avatarSrc} alt={profile?.nome || "Avatar"} className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{initials || "?"}</div>
            )}
              <GorroNatal className="-left-2 -top-4 w-8" />
            </div>
          </div>
          <p className="text-sm italic text-muted-foreground">"{motivation}"</p>
          </>)}
          <ProximaVisitaCard />
          <AtalhosRotina variante="redondo" />
        </motion.div>
      )}

      {/* 1. Saudação HOMI (gradient inline — computador) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="hidden md:block">
        <div
          className={`rounded-2xl px-5 py-3.5 text-primary-foreground relative overflow-hidden gradient-brand`}
        >
          {natal.efeitos && <NeveSuave altura={120} />}
          {natal.efeitos && (
            <img src="/natal/homi_noel.png" alt="" aria-hidden className="pointer-events-none absolute bottom-0 right-6 h-[94%] select-none" />
          )}
          <div className="relative flex items-center gap-4">
            <div className="relative shrink-0">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile?.nome || "Avatar"}
                className="h-12 w-12 shrink-0 rounded-full object-cover border-2 border-primary-foreground/30"
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary-foreground font-black text-lg select-none border-2 border-primary-foreground/30"
                style={{ background: "hsl(var(--primary-foreground) / 0.15)" }}
              >
                {initials || "?"}
              </div>
            )}
              <GorroNatal className="-left-2.5 -top-4 w-8" />
            </div>
            <div className={`min-w-0 flex-1 ${natal.efeitos ? "pr-36" : ""}`}>
              <p className="text-lg font-bold truncate">{saudacao}, {primeiroNome}! 👋</p>
              <p className="truncate text-sm text-primary-foreground/80 italic leading-snug">"{motivation}"</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs capitalize">{dataFormatada}</span>
                {perf?.crm_atende && (
                  <span className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs font-semibold">🏆 Padrão Uhome conquistado</span>
                )}
                {natal.efeitos && (
                  <span className="natal-chip-ouro rounded-full px-2.5 py-0.5 text-xs font-bold">🎁 Faltam {diasAte18()} dias para 18/12</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <MissaoNatalCard userId={user?.id} recolhivel />

      {/* 2. Roleta do turno: barra de credenciamento + estado + regras */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="space-y-2">
        <RoletaTurnoCard />
      </motion.div>


      <div className="flex flex-col lg:flex-row gap-3.5">
        <div className="flex-1 min-w-0 space-y-5">
          <MinhaEvolucaoKpis />
          <MeuFocoHoje />
        </div>
        {!isMobile && (
          <div className="w-full lg:w-[280px] shrink-0 space-y-3.5">
            <ProximaVisitaCard />
            <AtalhosRotina />
          </div>
        )}
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
