// =============================================================================
// CorretorDashboard — Layout completo da Home do Corretor
// Combina identidade visual do CorretorHome com lógica corrigida.
// =============================================================================

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Phone, MessageCircle, Trophy, CheckCircle, Zap, Bot, Target, ListTodo,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useNavigate } from "react-router-dom";


import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import { useMissoesLeads } from "@/hooks/useMissoesLeads";
import { useCorretorHomeData } from "@/hooks/useCorretorHomeData";
import { useConquistas } from "@/hooks/useConquistas";

import OportunidadesLista from "@/components/corretor/OportunidadesLista";
import RoletaStatusBar from "@/components/corretor/RoletaStatusBar";
import DailyProgressCard from "@/components/corretor/DailyProgressCard";
import MissoesDeHoje from "@/components/corretor/MissoesDeHoje";
import RankingGestaoLeads from "@/components/corretor/RankingGestaoLeads";
import MinhaAgendaWidget from "@/components/corretor/MinhaAgendaWidget";
import VisitasHojeCard from "@/components/corretor/VisitasHojeCard";
import MiniFunilPessoal from "@/components/corretor/MiniFunilPessoal";
import EvolucaoSemanal from "@/components/corretor/EvolucaoSemanal";
import LevelProgressBar from "@/components/corretor/LevelProgressBar";
import CelebrationOverlay from "@/components/corretor/CelebrationOverlay";
import OnboardingWidget from "@/components/corretor/OnboardingWidget";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { ACHIEVEMENTS } from "@/lib/gamification";

const ACHIEVEMENTS_MAP: Record<string, { emoji: string; label: string }> = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, { emoji: a.emoji, label: a.label }])
);




// ---------------------------------------------------------------------------
// Componente Principal
// ---------------------------------------------------------------------------
export default function CorretorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Profile
  const [profile, setProfile] = useState<{ nome?: string; avatar_url?: string; avatar_preview_url?: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_url, avatar_preview_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const avatarSrc = profile?.avatar_url || profile?.avatar_preview_url;
  const primeiroNome = (profile?.nome || "Corretor").split(" ")[0];
  const initials = (profile?.nome || "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();




  // Data hooks
  const { progress, goals, saveGoals } = useCorretorProgress();
  const motivation = useDailyMotivation();
  const { missoes, missaoGeral, ranking, rankingLoading, userId } = useMissoesLeads();
  const { followUps, followUpsLoading, visitasHoje, visitasLoading, funil, funilLoading, totalLeads, evolucao, evolucaoLoading } = useCorretorHomeData();
  const { newlyUnlocked, dismissCelebration, unlocked } = useConquistas();

  // Date
  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto pb-10">
      <CelebrationOverlay achievement={newlyUnlocked} onDismiss={dismissCelebration} />
      <OnboardingWidget />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. BANNER GRADIENTE                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="rounded-2xl p-5 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED, #2563EB)" }}
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
              <p className="text-lg font-bold truncate">
                Olá, {primeiroNome}! 👋
              </p>
              <p className="text-sm text-white/80 italic leading-snug mt-0.5">
                "{motivation}"
              </p>
              <p className="text-xs text-white/60 mt-1 capitalize">{dataFormatada}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. STATUS + CREDENCIAMENTO ROLETA (componente completo)            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
        <RoletaStatusBar />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3. KPI CARDS — 4 em linha                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <KpiGrid cols={4}>
          <KpiCard
            label="TOTAL LEADS"
            value={totalLeads}
            icon={<Zap className="h-4 w-4" />}
            variant="highlight"
          />
          <KpiCard
            label="LIGAÇÕES HOJE"
            value={progress.ligacoes}
            icon={<Phone className="h-4 w-4" />}
            variant="success"
          />
          <KpiCard
            label="WHATSAPPS"
            value={progress.whatsapps}
            icon={<MessageCircle className="h-4 w-4" />}
            variant="success"
          />
          <KpiCard
            label="TAXA APROV."
            value={`${progress.taxaAproveitamento}%`}
            icon={<CheckCircle className="h-4 w-4" />}
            variant="highlight"
          />
        </KpiGrid>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5. BOTÕES DE AÇÃO                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-14 gap-2 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_20px_hsl(152_60%_42%/0.3)]"
            onClick={() => navigate("/corretor/call")}
          >
            <Phone className="h-5 w-5" />
            CALL / Oferta Ativa
          </Button>
          <Button
            size="lg"
            className="h-14 gap-2 text-sm font-bold rounded-xl"
            onClick={() => navigate("/pipeline-leads")}
          >
            <ListTodo className="h-5 w-5" />
            Pipeline
          </Button>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 6. OPORTUNIDADES DO DIA                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
        <OportunidadesLista />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5. META DO DIA + TAREFAS (lado a lado)                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DailyProgressCard
            progress={progress}
            goals={goals}
            saveGoals={saveGoals}
            variant="full"
          />
          <MinhaAgendaWidget />
        </div>
      </motion.div>

      {/* Visitas de Hoje (condicional) */}
      {visitasHoje.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
          <VisitasHojeCard visitas={visitasHoje} loading={visitasLoading} />
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 6. MEU FUNIL + ÚLTIMOS 7 DIAS                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MiniFunilPessoal funil={funil} totalLeads={totalLeads} loading={funilLoading} />
          <EvolucaoSemanal evolucao={evolucao} loading={evolucaoLoading} />
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 8. PROGRESSO DO DIA (card compacto → link /progresso)             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <Card className="border-primary/10 overflow-hidden cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/progresso")}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="font-bold text-sm text-foreground">Progresso do Dia</span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary gap-1">
                Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <LevelProgressBar points={progress.pontos} />
            {missaoGeral !== undefined && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Missão geral: <strong className="text-foreground">{missaoGeral}%</strong></span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 15. QUICK ACCESS                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }}>
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/oferta-ativa?tab=aproveitados")}>
            <CheckCircle className="h-4 w-4" /> Aproveitados
          </Button>
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/oferta-ativa?tab=ranking")}>
            <Trophy className="h-4 w-4" /> Ranking
          </Button>
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/homi")}>
            <Bot className="h-4 w-4" /> Homi AI
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
