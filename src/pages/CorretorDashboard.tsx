import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, CheckCircle, Trophy, Target, Flame, MessageCircle, ArrowRight, Lock, LogOut, TrendingUp, ChevronDown, CalendarCheck } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import DailyProgressCard from "@/components/corretor/DailyProgressCard";

import AchievementsBadges from "@/components/corretor/AchievementsBadges";
import FollowUpsDoDia from "@/components/corretor/FollowUpsDoDia";
import VisitasHojeCard from "@/components/corretor/VisitasHojeCard";
import MiniFunilPessoal from "@/components/corretor/MiniFunilPessoal";
import EvolucaoSemanal from "@/components/corretor/EvolucaoSemanal";
import MissoesDeHoje from "@/components/corretor/MissoesDeHoje";
import { useMissoesLeads } from "@/hooks/useMissoesLeads";
import { useCorretorHomeData } from "@/hooks/useCorretorHomeData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import CorretorListSelection from "@/components/oferta-ativa/CorretorListSelection";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";
import CorretorDisponibilidadePanel from "@/components/disponibilidade/CorretorDisponibilidadePanel";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
const homiMascot = "/images/homi-mascot-opt.png";

// Confetti burst component
function ConfettiBurst({ show }: { show: boolean }) {
  if (!show) return null;
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 300,
    y: -(Math.random() * 200 + 100),
    rotation: Math.random() * 720,
    color: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96E6A1", "#DDA0DD"][i % 6],
    delay: Math.random() * 0.3,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: "50vw", y: "40vh", opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: `calc(50vw + ${p.x}px)`, y: `calc(40vh + ${p.y}px)`, opacity: 0, scale: 0.5, rotate: p.rotation }}
          transition={{ duration: 1.5, delay: p.delay, ease: "easeOut" }}
          className="absolute w-3 h-3 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 70) return "bg-primary";
  if (pct >= 40) return "bg-amber-500";
  return "bg-destructive/70";
}

export default function CorretorDashboard() {
  // === SINGLE SOURCE OF TRUTH ===
  const { progress, goals, saveGoals } = useCorretorProgress();
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const motivation = useDailyMotivation();
  const { user } = useAuth();

  const { missoes, missaoGeral } = useMissoesLeads();
  const { followUps, followUpsLoading, visitasHoje, visitasLoading, funil, funilLoading, totalLeads, evolucao, evolucaoLoading } = useCorretorHomeData();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("central");
  const [nome, setNome] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [prevAproveitados, setPrevAproveitados] = useState(0);

  // Count new leads (no contact yet)
  const { data: newLeadsCount = 0 } = useQuery({
    queryKey: ["corretor-new-leads-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user!.id)
        .in("stage_id", (await supabase.from("pipeline_stages").select("id").in("nome", ["Novo Lead", "Sem Contato"])).data?.map(s => s.id) || []);
      return count || 0;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Streak calculation
  const { data: streak } = useQuery({
    queryKey: ["corretor-streak", user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from("oferta_ativa_tentativas")
        .select("created_at")
        .eq("corretor_id", user!.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (!data || data.length === 0) return 0;
      // Use BRT dates to calculate streak correctly
      const dates = new Set(data.map(d => {
        const dt = new Date(d.created_at);
        return dt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      }));
      let count = 0;
      const now = new Date();
      const todayBrt = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      // Start from today
      let checkDate = new Date(todayBrt + "T12:00:00-03:00");
      for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        if (dates.has(dateStr)) {
          count++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }
      return count;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
    });
  }, [user]);

  // Celebration on new aproveitado
  useEffect(() => {
    if (progress.aproveitados > prevAproveitados && prevAproveitados > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    }
    setPrevAproveitados(progress.aproveitados);
  }, [progress.aproveitados]);

  if (!roleLoading && (isGestor || isAdmin)) {
    return <Navigate to="/" replace />;
  }

  const metaSalva = !!goals;

  const handleTabChange = (tab: string) => {
    if (tab === "discagem" && !metaSalva) {
      toast.warning("Defina sua meta do dia antes de iniciar a discagem!");
      return;
    }
    setActiveTab(tab);
  };

  const handleFinalizarTrabalho = async () => {
    if (!user) return;
    setFinalizando(true);
    try {
      const { data, error } = await supabase.rpc("finalizar_trabalho_corretor", { p_user_id: user.id });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        toast.success(`🎉 Trabalho finalizado! ${result.tentativas} tentativas e ${result.aproveitados} aproveitados enviados ao gerente.`);
      } else {
        toast.error(result?.message || "Erro ao finalizar trabalho.");
      }
    } catch (err: any) {
      toast.error("Erro ao finalizar: " + err.message);
    } finally {
      setFinalizando(false);
    }
  };

  // Derived from unified progress
  const levelEmoji = progress.level.split(" ")[0];
  const levelLabel = progress.level.split(" ").slice(1).join(" ");

  // Progress percentages for sticky bar
  const ligPct = goals ? Math.min(100, Math.round((progress.tentativas / (goals.meta_ligacoes || 30)) * 100)) : 0;
  const visPct = goals ? Math.min(100, Math.round((progress.visitasMarcadas / (goals.meta_visitas_marcadas || 3)) * 100)) : 0;
  const aprvPct = goals ? Math.min(100, Math.round((progress.aproveitados / (goals.meta_aproveitados || 5)) * 100)) : 0;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <ConfettiBurst show={showConfetti} />

      {/* Header with Homi */}
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="relative"
        >
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center overflow-hidden shadow-lg">
            <img src={homiMascot} alt="Homi" className="h-12 w-12 object-contain" />
          </div>
          {(streak || 0) >= 2 && (
            <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
              🔥
            </div>
          )}
        </motion.div>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {nome ? (
              <>Fala, <span className="text-primary">{nome}</span>! 💪</>
            ) : (
              <>Fala, <span className="text-primary">Corretor</span>! 💪</>
            )}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-muted-foreground">Bora fazer acontecer hoje</p>
            {(streak || 0) >= 2 && (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-orange-500/10 text-orange-600 border-orange-500/20">
                <Flame className="h-3 w-3" /> {streak} dias seguidos!
              </Badge>
            )}
          </div>
        </div>
        {/* Level Badge */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-center"
        >
          <div className="text-2xl">{levelEmoji}</div>
          <p className={`text-[10px] font-bold ${progress.levelColor}`}>{levelLabel}</p>
        </motion.div>
      </div>

      {/* 🔥 STICKY DAILY PROGRESS BAR */}
      {metaSalva && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-20 -mx-4 px-4 py-2.5 bg-background/95 backdrop-blur-sm border-b border-border/50"
        >
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Progresso do dia</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Ligações", value: progress.tentativas, max: goals?.meta_ligacoes || 30, pct: ligPct },
              { label: "Aproveit.", value: progress.aproveitados, max: goals?.meta_aproveitados || 5, pct: aprvPct },
              { label: "Visitas", value: progress.visitasMarcadas, max: goals?.meta_visitas_marcadas || 3, pct: visPct },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
                  <span className="text-[10px] font-bold text-foreground">{item.value}/{item.max}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`h-full rounded-full ${getProgressColor(item.pct)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 h-auto sticky top-[72px] z-10">
          <TabsTrigger value="central" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs py-2">
            <Target className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Central</span><span className="xs:hidden">Home</span>
          </TabsTrigger>
          <TabsTrigger value="discagem" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs py-2" disabled={!metaSalva}>
            {!metaSalva && <Lock className="h-3 w-3" />}
            <Phone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Discagem</span><span className="sm:hidden">Call</span>
          </TabsTrigger>
          <TabsTrigger value="aproveitados" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs py-2">
            <CheckCircle className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Aproveitados</span><span className="sm:hidden">Aprov.</span>
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs py-2">
            <Trophy className="h-3.5 w-3.5" /> Ranking
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Central ── */}
        <TabsContent value="central" className="space-y-4 mt-4">
          {/* 1️⃣ STATUS — Disponibilidade & Roleta */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <CorretorDisponibilidadePanel />
          </motion.div>

          {/* Celebration Banner */}
          <AnimatePresence>
            {progress.todasMissoesCumpridas && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-primary/10 to-amber-500/10">
                  <CardContent className="p-3 text-center">
                    <p className="text-lg mb-0.5">🏆🎉🔥</p>
                    <p className="text-sm font-bold text-foreground">MISSÃO DO DIA CUMPRIDA!</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Motivation — compact inline */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-muted-foreground italic">💬 "{motivation}"</span>
            </div>
          </motion.div>


          {/* 2️⃣ MISSÕES DO DIA (was 3) */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <MissoesDeHoje
              missoes={missoes}
              missaoGeral={missaoGeral}
              pontos={progress.pontos}
              todasCompletas={progress.todasMissoesCumpridas}
            />
          </motion.div>

          {/* 4️⃣ VISITAS DE HOJE */}
          {visitasHoje.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
              <VisitasHojeCard visitas={visitasHoje} loading={visitasLoading} />
            </motion.div>
          )}

          {/* ⚡ Follow-ups expandido (para quem quer detalhe) */}
          {followUps.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
              <FollowUpsDoDia leads={followUps} loading={followUpsLoading} />
            </motion.div>
          )}

          {/* 5️⃣ META DO DIA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <DailyProgressCard
              progress={progress}
              goals={goals}
              saveGoals={saveGoals}
              variant="full"
            />
          </motion.div>

          {/* 6️⃣ PERFORMANCE HOJE — simplificada */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">📊 Performance Hoje</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Tentativas", value: progress.tentativas, color: "text-primary" },
                    { label: "Aproveitados", value: progress.aproveitados, color: "text-emerald-600" },
                    { label: "Visitas", value: progress.visitasMarcadas, color: "text-amber-600" },
                    { label: "Taxa", value: `${progress.taxaAproveitamento}%`, color: "text-primary" },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <motion.p
                        key={String(item.value)}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className={`text-2xl font-bold ${item.color} leading-none`}
                      >
                        {item.value}
                      </motion.p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>

                {/* Points & Level inline */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{levelEmoji}</span>
                    <div>
                      <p className={`text-xs font-bold ${progress.levelColor}`}>{levelLabel}</p>
                      <p className="text-[10px] text-muted-foreground">{progress.pontos}/{progress.nextLevelTarget} pts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(streak || 0) >= 1 && (
                      <Badge variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1">
                        <Flame className="h-3 w-3" /> {streak}d
                      </Badge>
                    )}
                    <Progress value={progress.levelProgress} className="w-20 h-1.5" />
                  </div>
                </div>

                {/* Achievements inline */}
                <div className="mt-3 pt-3 border-t border-border">
                  <AchievementsBadges progress={progress} streak={streak || 0} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 7️⃣ INSIGHT SEMANAL */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EvolucaoSemanal evolucao={evolucao} loading={evolucaoLoading} />
              <MiniFunilPessoal funil={funil} totalLeads={totalLeads} loading={funilLoading} />
            </div>
          </motion.div>

          {/* Finalizar Trabalho */}
          {metaSalva && progress.tentativas > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-12 gap-2 text-sm border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={finalizando}
                  >
                    <LogOut className="h-4 w-4" /> Finalizar Trabalho do Dia
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Finalizar trabalho do dia?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>Suas estatísticas serão enviadas ao gerente:</p>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="text-center p-2 rounded-lg bg-muted">
                          <p className="text-lg font-bold text-foreground">{progress.tentativas}</p>
                          <p className="text-[10px] text-muted-foreground">tentativas</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted">
                          <p className="text-lg font-bold text-emerald-600">{progress.aproveitados}</p>
                          <p className="text-[10px] text-muted-foreground">aproveitados</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted">
                          <p className="text-lg font-bold text-primary">{progress.pontos}</p>
                          <p className="text-[10px] text-muted-foreground">pontos</p>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar e continuar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleFinalizarTrabalho} className="bg-destructive hover:bg-destructive/90">
                      {finalizando ? "Enviando..." : "Confirmar e Finalizar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          )}
        </TabsContent>

        {/* ── Tab: Discagem ── */}
        <TabsContent value="discagem" className="mt-4">
          <CorretorListSelection />
        </TabsContent>

        {/* ── Tab: Aproveitados ── */}
        <TabsContent value="aproveitados" className="mt-4">
          <AproveitadosPanel />
        </TabsContent>

        {/* ── Tab: Ranking ── */}
        <TabsContent value="ranking" className="mt-4">
          <RankingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
