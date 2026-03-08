import { motion } from "framer-motion";
import { Phone, MessageCircle, Mail, Trophy, CheckCircle, Zap, Bot, CalendarCheck } from "lucide-react";
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
import FollowUpsDoDia from "./FollowUpsDoDia";
import VisitasHojeCard from "./VisitasHojeCard";
import MiniFunilPessoal from "./MiniFunilPessoal";
import EvolucaoSemanal from "./EvolucaoSemanal";
import LevelProgressBar from "./LevelProgressBar";
import CelebrationOverlay from "./CelebrationOverlay";
import { useNavigate } from "react-router-dom";
const homiMascot = "/images/homi-mascot-opt.png";

export default function CorretorHome() {
  const { progress, goals, saveGoals } = useCorretorProgress();
  const motivation = useDailyMotivation();
  const { missoes, missaoGeral, radarLeads, radarLoading, ranking, rankingLoading, userId } = useMissoesLeads();
  const { followUps, followUpsLoading, visitasHoje, visitasLoading, funil, funilLoading, totalLeads, evolucao, evolucaoLoading } = useCorretorHomeData();
  const { newlyUnlocked, dismissCelebration, unlocked } = useConquistas();
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0 overflow-hidden">
              <img src={homiMascot} alt="Homi" className="h-10 w-10 object-contain" />
            </div>
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

      {/* ⚡ Follow-ups Pendentes — NEW */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
        <FollowUpsDoDia leads={followUps} loading={followUpsLoading} />
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
          onOpenPipeline={() => navigate("/pipeline")}
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

      {/* Gamification — Points & Level */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-primary/10 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-extrabold text-foreground">{progress.pontos} pts</p>
                  <p className="text-[10px] text-muted-foreground">Pontuação de hoje</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className={`gap-1 text-xs font-bold ${progress.levelColor}`}>
                  {progress.level}
                </Badge>
                <p className="text-[9px] text-muted-foreground mt-0.5">{progress.pontos}/{progress.nextLevelTarget} pts</p>
              </div>
            </div>
            <Progress value={progress.levelProgress} className="h-1.5" />
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
