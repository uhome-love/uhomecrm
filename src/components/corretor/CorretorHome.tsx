import { motion } from "framer-motion";
import { Phone, MessageCircle, Mail, Trophy, CheckCircle, Zap, Bot, CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import { useMissoesLeads } from "@/hooks/useMissoesLeads";
import { useCorretorHomeData } from "@/hooks/useCorretorHomeData";
import { useConquistas } from "@/hooks/useConquistas";
import DailyProgressCard from "./DailyProgressCard";
import MissoesDeHoje from "./MissoesDeHoje";
import RadarLeadsPendentes from "./RadarLeadsPendentes";
import RankingGestaoLeads from "./RankingGestaoLeads";
import MinhaAgendaWidget from "./MinhaAgendaWidget";
import VisitasHojeCard from "./VisitasHojeCard";
import MiniFunilPessoal from "./MiniFunilPessoal";
import EvolucaoSemanal from "./EvolucaoSemanal";
import LevelProgressBar from "./LevelProgressBar";
import CelebrationOverlay from "./CelebrationOverlay";
import OnboardingWidget from "./OnboardingWidget";
import { ACHIEVEMENTS } from "@/lib/gamification";
import { useNavigate } from "react-router-dom";

const ACHIEVEMENTS_MAP: Record<string, { emoji: string; label: string }> = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, { emoji: a.emoji, label: a.label }])
);


export default function CorretorHome() {
  const { progress, goals, saveGoals } = useCorretorProgress();
  const motivation = useDailyMotivation();
  const { missoes, missaoGeral, radarLeads, radarLoading, ranking, rankingLoading, userId } = useMissoesLeads();
  const { followUps, followUpsLoading, visitasHoje, visitasLoading, funil, funilLoading, totalLeads, evolucao, evolucaoLoading } = useCorretorHomeData();
  const { newlyUnlocked, dismissCelebration, unlocked } = useConquistas();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ nome?: string; avatar_url?: string; avatar_preview_url?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_url, avatar_preview_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const avatarSrc = profile?.avatar_url || profile?.avatar_preview_url;
  const initials = (profile?.nome || "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <CelebrationOverlay achievement={newlyUnlocked} onDismiss={dismissCelebration} />

      {/* Onboarding Widget */}
      <OnboardingWidget />

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" /> Central do Corretor
        </h1>
        <p className="text-sm text-muted-foreground">Foco, meta e execução. Seu dia começa aqui.</p>
      </div>

      {/* Homi Motivation Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/15 bg-accent/50 overflow-hidden">
          <CardContent className="p-4 flex items-start gap-3">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile?.nome || "Avatar"}
                className="h-14 w-14 shrink-0 rounded-full object-cover"
                style={{ border: "2px solid hsl(217 91% 60%)", boxShadow: "0 0 12px hsl(217 91% 60% / 0.3)" }}
              />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white font-black text-xl select-none"
                style={{ background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(258 90% 66%))", border: "2px solid hsl(217 91% 60%)", boxShadow: "0 0 12px hsl(217 91% 60% / 0.3)" }}
              >
                {initials || "?"}
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" /> Homi diz
              </p>
              <p className="text-sm font-medium text-foreground mt-1 italic">"{motivation}"</p>
              <p className="text-[10px] text-muted-foreground mt-1">Meta, ritmo e execução.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main CTA — Iniciar Call */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Button
          size="lg"
          className="w-full h-16 gap-3 text-lg font-bold rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_20px_hsl(152_60%_42%/0.3)] hover:shadow-[0_6px_28px_hsl(152_60%_42%/0.4)] transition-all duration-300 hover:-translate-y-0.5"
          onClick={() => navigate("/oferta-ativa")}
        >
          <Phone className="h-6 w-6" /> Iniciar Call
        </Button>
      </motion.div>

      {/* 📅 Visitas de Hoje — NEW */}
      {visitasHoje.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <VisitasHojeCard visitas={visitasHoje} loading={visitasLoading} />
        </motion.div>
      )}

      {/* 📋 Minha Agenda — replaces Follow-ups */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
        <MinhaAgendaWidget />
      </motion.div>

      {/* 🎮 Missões de Hoje */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <MissoesDeHoje
          missoes={missoes}
          missaoGeral={missaoGeral}
          pontos={progress.pontos}
          todasCompletas={progress.todasMissoesCumpridas}
        />
      </motion.div>

      {/* 📊 Mini Funil + Evolução — Side by Side */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MiniFunilPessoal funil={funil} totalLeads={totalLeads} loading={funilLoading} />
          <EvolucaoSemanal evolucao={evolucao} loading={evolucaoLoading} />
        </div>
      </motion.div>

      {/* 📡 Radar de Leads Pendentes */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <RadarLeadsPendentes
          leads={radarLeads}
          loading={radarLoading}
          onOpenPipeline={() => navigate("/pipeline-leads")}
        />
      </motion.div>

      {/* Daily Goals */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <DailyProgressCard
          progress={progress}
          goals={goals}
          saveGoals={saveGoals}
          variant="full"
        />
      </motion.div>

      {/* Performance Cards */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Ligações", value: progress.ligacoes, icon: Phone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "WhatsApps", value: progress.whatsapps, icon: MessageCircle, color: "text-green-500", bg: "bg-green-500/10" },
            { label: "E-mails", value: progress.emails, icon: Mail, color: "text-primary", bg: "bg-primary/10" },
            { label: "Visitas Marcadas", value: progress.visitasMarcadas, icon: CalendarCheck, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Taxa Aprov.", value: `${progress.taxaAproveitamento}%`, icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
          ].map((item) => (
            <Card key={item.label} className="border-border/60">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg} shrink-0`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <div>
                  <p className="text-xl font-display font-extrabold text-foreground leading-none">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* 🏆 Ranking Gestão de Leads */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <RankingGestaoLeads
          ranking={ranking}
          loading={rankingLoading}
          userId={userId}
        />
      </motion.div>

      {/* Gamification — Level Progress + Recent Achievements */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-primary/10 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <LevelProgressBar points={progress.pontos} />
            {unlocked.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                <p className="text-[10px] text-muted-foreground font-medium shrink-0">Recentes:</p>
                {unlocked.slice(0, 5).map(u => {
                  const def = ACHIEVEMENTS_MAP[u.conquista_id];
                  return def ? (
                    <span key={u.conquista_id} className="text-sm" title={def.label}>{def.emoji}</span>
                  ) : null;
                })}
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary ml-auto" onClick={() => navigate("/conquistas")}>
                  Ver todas →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Access */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-12 gap-2 text-sm rounded-xl"
            onClick={() => navigate("/oferta-ativa?tab=aproveitados")}
          >
            <CheckCircle className="h-4 w-4" /> Aproveitados
          </Button>
          <Button
            variant="outline"
            className="h-12 gap-2 text-sm rounded-xl"
            onClick={() => navigate("/oferta-ativa?tab=ranking")}
          >
            <Trophy className="h-4 w-4" /> Ranking
          </Button>
          <Button
            variant="outline"
            className="h-12 gap-2 text-sm rounded-xl"
            onClick={() => navigate("/homi")}
          >
            <Bot className="h-4 w-4" /> Homi AI
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
