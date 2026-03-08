import { useState, useEffect, useCallback } from "react";
import { Phone, Lock, Kanban, CalendarDays, Bot, FileEdit, BarChart3, AlertCircle, Zap, LogOut, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import DailyProgressCard from "@/components/corretor/DailyProgressCard";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { differenceInHours } from "date-fns";
import { getDynamicGreeting, formatStreak } from "@/lib/celebrations";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/gamification";
import MetaCelebration from "@/components/corretor/MetaCelebration";
import ConfettiBurst from "@/components/corretor/ConfettiToast";
import PulseFeed from "@/components/pulse/PulseFeed";
import RoletaStatusBar from "@/components/corretor/RoletaStatusBar";

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

export default function CorretorDashboard() {
  const { progress, goals, saveGoals } = useCorretorProgress();
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const motivation = useDailyMotivation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [showMetaCelebration, setShowMetaCelebration] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [metaCelebrated, setMetaCelebrated] = useState(false);

  // Radar data
  const { data: radarData } = useQuery({
    queryKey: ["corretor-radar", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      const { count: pendingLeads } = await (supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true }) as any)
        .eq("corretor_id", user!.id)
        .is("proxima_acao", null);

      const slaThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: slaExpired } = await (supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true }) as any)
        .eq("corretor_id", user!.id)
        .lt("stage_changed_at", slaThreshold);

      const { data: visitas } = await (supabase
        .from("visitas")
        .select("id, nome_cliente, empreendimento, hora_visita, data_visita, status") as any)
        .eq("corretor_id", user!.id)
        .eq("data_visita", today)
        .order("hora_visita");

      const { data: rankingData } = await supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id")
        .gte("created_at", today + "T00:00:00");

      // Priority leads: SLA expired or high value, limit 3
      const { data: priorityLeads } = await (supabase
        .from("pipeline_leads")
        .select("id, nome, empreendimento, stage_changed_at, telefone, oportunidade_score, valor_estimado")
        .eq("corretor_id", user!.id)
        .not("stage_id", "is", null)
        .order("stage_changed_at", { ascending: true })
        .limit(5) as any);

      const counts: Record<string, number> = {};
      rankingData?.forEach((r: any) => { counts[r.corretor_id] = (counts[r.corretor_id] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const myPos = sorted.findIndex(([id]) => id === user!.id) + 1;
      const totalBrokers = sorted.length || 1;
      const myPts = counts[user!.id] || 0;
      const nextAbove = myPos > 1 ? sorted[myPos - 2]?.[1] - myPts : 0;

      return {
        pendingLeads: pendingLeads || 0,
        slaExpired: slaExpired || 0,
        visitas: visitas || [],
        rankingPos: myPos || totalBrokers,
        totalBrokers,
        ptsToNext: Math.max(0, nextAbove),
        priorityLeads: (priorityLeads || []).slice(0, 3),
        myPts,
        totalWithPoints: sorted.length,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_preview_url").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
      if ((data as any)?.avatar_preview_url) setAvatarUrl((data as any).avatar_preview_url);
    });
  }, [user]);

  const metaSalva = !!goals;

  const ligPct = goals ? Math.min(100, Math.round((progress.tentativas / (goals.meta_ligacoes || 30)) * 100)) : 0;
  const aprvPct = goals ? Math.min(100, Math.round((progress.aproveitados / (goals.meta_aproveitados || 5)) * 100)) : 0;
  const visPct = goals ? Math.min(100, Math.round((progress.visitasMarcadas / (goals.meta_visitas_marcadas || 3)) * 100)) : 0;

  // Check all 3 metas complete for celebration
  const allMetasComplete = goals && ligPct >= 100 && aprvPct >= 100 && visPct >= 100;
  useEffect(() => {
    if (allMetasComplete && !metaCelebrated) {
      setMetaCelebrated(true);
      setShowMetaCelebration(true);
      setConfettiTrigger(prev => prev + 1);
    }
  }, [allMetasComplete, metaCelebrated]);

  if (!roleLoading && (isGestor || isAdmin)) {
    return <Navigate to="/" replace />;
  }

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

  const radar = radarData || { pendingLeads: 0, slaExpired: 0, visitas: [], rankingPos: 0, totalBrokers: 1, ptsToNext: 0, priorityLeads: [], myPts: 0, totalWithPoints: 0 };

  // Dynamic greeting
  const greetingData = getDynamicGreeting({
    nome: nome || "Corretor",
    rankingPos: radar.rankingPos,
    slaExpired: radar.slaExpired,
    streak: 0,
    myPts: radar.myPts,
    totalWithPoints: radar.totalWithPoints,
  });
  const streakData = formatStreak(0); // TODO: compute from DB
  const currentLevel = getLevel(progress.pontos);
  const nextLevel = getNextLevel(progress.pontos);
  const levelProgress = getLevelProgress(progress.pontos);

  return (
    <div className="flex flex-col h-[calc(100vh-56px-2rem)] px-4 md:px-6 lg:px-8 py-4 overflow-auto">
      <ConfettiBurst trigger={confettiTrigger} intensity="moderate" />
      <MetaCelebration show={showMetaCelebration} nome={nome || "Corretor"} onDismiss={() => setShowMetaCelebration(false)} />

      {/* HEADER — full width */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-4">
        <div className="h-14 w-14 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
          style={{
            background: avatarUrl ? "transparent" : "linear-gradient(135deg, #3B82F6, #6366F1)",
            border: avatarUrl ? "2px solid hsl(var(--border))" : "none",
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={nome || "Avatar"} className="h-full w-full object-cover rounded-full" />
          ) : (
            <span className="text-lg font-bold text-white">
              {(nome || "C").slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground">
            {greetingData.greeting}
          </h1>
          <p className="text-sm text-muted-foreground truncate">{greetingData.subtitle}</p>
        </div>
      </motion.div>

      {/* STATUS BAR — Roleta */}
      <div className="mb-4">
        <RoletaStatusBar />
      </div>

      {/* GRID PRINCIPAL — 2 colunas desktop, 1 coluna mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4 flex-1 min-h-0">

        {/* ===== COLUNA ESQUERDA ===== */}
        <div className="flex flex-col gap-4">

          {/* Radar do Dia — 3 cards */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="grid grid-cols-3 gap-3">
              <Card className="cursor-pointer hover:border-orange-300 hover:shadow-card-hover transition-all duration-150" onClick={() => navigate("/pipeline")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertCircle className="h-4 w-4 text-danger-500" />
                    <span className="text-xs font-medium text-muted-foreground">Leads</span>
                  </div>
                  <p className={`text-3xl lg:text-4xl font-bold leading-none ${radar.pendingLeads > 0 ? "text-orange-500" : "text-foreground"}`}>{radar.pendingLeads}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">p/ contatar</p>
                  {radar.slaExpired > 0 && (
                    <p className="text-xs text-danger-500 font-medium mt-0.5">{radar.slaExpired} SLA expirado</p>
                  )}
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary/30 hover:shadow-card-hover transition-all duration-150" onClick={() => navigate("/agenda-visitas")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Agenda</span>
                  </div>
                  <p className={`text-3xl lg:text-4xl font-bold leading-none ${radar.visitas.length > 0 ? "text-primary" : "text-foreground"}`}>{radar.visitas.length}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">{radar.visitas.length === 1 ? "visita" : "visitas"}</p>
                </CardContent>
              </Card>

              <Card className={`cursor-pointer hover:shadow-card-hover transition-all duration-150 ${radar.rankingPos === 1 ? "bg-amber-50/50 border-amber-200 hover:border-amber-300" : "hover:border-primary/30"}`} onClick={() => navigate("/corretor/call")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className={`h-4 w-4 ${radar.rankingPos === 1 ? "text-amber-500" : "text-warning"}`} />
                    <span className="text-xs font-medium text-muted-foreground">Ranking</span>
                  </div>
                  <p className={`text-3xl lg:text-4xl font-bold leading-none ${radar.rankingPos === 1 ? "text-[#B45309]" : "text-foreground"}`}>#{radar.rankingPos || "–"}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">de {radar.totalBrokers}</p>
                  {radar.ptsToNext > 0 && (
                    <p className="text-xs text-[#B45309] font-medium mt-0.5">{radar.ptsToNext}pts p/ subir</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>

          {/* Botões de Ação */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                disabled={!metaSalva}
                whileHover={metaSalva ? { scale: 1.02 } : {}}
                whileTap={metaSalva ? { scale: 0.98 } : {}}
                className={`h-16 rounded-xl flex items-center gap-3 px-4 transition-all duration-200 ${
                  metaSalva
                    ? "bg-gradient-to-br from-[#16A34A] to-[#15803D] hover:from-[#15803D] hover:to-[#166534] text-white shadow-[0_4px_14px_rgba(22,163,74,0.4)]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
                onClick={() => metaSalva && navigate("/corretor/call")}
              >
                {!metaSalva ? <Lock className="h-6 w-6 shrink-0" /> : <Phone className="h-6 w-6 shrink-0" />}
                <div className="text-left">
                  <p className="text-base font-bold uppercase tracking-wide leading-tight">
                    {metaSalva ? "Iniciar Call" : "🔒 Call"}
                  </p>
                  <p className="text-[10px] font-normal opacity-80">Oferta Ativa</p>
                </div>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="h-16 rounded-xl flex items-center gap-3 px-4 bg-gradient-to-br from-[#1E40AF] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#2563EB] text-white shadow-[0_4px_14px_rgba(29,78,216,0.35)] transition-all duration-200"
                onClick={() => navigate("/pipeline")}
              >
                <Kanban className="h-6 w-6 shrink-0" />
                <div className="text-left">
                  <p className="text-base font-bold uppercase tracking-wide leading-tight">Gestão de Leads</p>
                  <p className="text-[10px] font-normal opacity-80">Pipeline</p>
                </div>
              </motion.button>
            </div>
            {!metaSalva && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Defina sua meta para liberar a discagem.
              </p>
            )}
          </motion.div>

          {/* Streak + Nível */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <Card className="border-border/60">
              <CardContent className="p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  {/* Streak = 0: motivational text only, no empty bar */}
                  {progress.pontos === 0 && !streakData.label.includes("dias") ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔥</span>
                      <span className="text-sm text-muted-foreground italic">Comece seu streak hoje!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{streakData.emoji || "🔥"}</span>
                      <span className={`text-xl font-bold ${streakData.color || "text-muted-foreground"}`}>0</span>
                      <span className="text-xs text-muted-foreground">dias de streak</span>
                    </div>
                  )}
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${currentLevel.bgColor} ${currentLevel.color}`}>
                    {currentLevel.emoji} {currentLevel.label}
                  </span>
                </div>
                {/* Only show progress bar if there's actual progress */}
                {progress.pontos > 0 && (
                  <>
                    <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={`absolute inset-y-0 left-0 rounded-full ${
                          currentLevel.id === "iniciante" ? "bg-muted-foreground/40"
                          : currentLevel.id === "ativo" ? "bg-emerald-500"
                          : currentLevel.id === "engajado" ? "bg-orange-500"
                          : currentLevel.id === "destaque" ? "bg-amber-500"
                          : currentLevel.id === "elite" ? "bg-primary"
                          : "bg-purple-500"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${levelProgress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground font-medium">{progress.pontos}/{nextLevel ? nextLevel.minPoints : "MAX"} pts</p>
                      <p className="text-[10px] text-muted-foreground italic">{streakData.label}</p>
                    </div>
                  </>
                )}
                {progress.pontos === 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground font-medium">0/{nextLevel ? nextLevel.minPoints : "100"} pts</p>
                    <p className="text-[10px] text-muted-foreground italic">Faça sua primeira ligação!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Ranking Multi-Categoria */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border/60">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🏆</span>
                    <span className="text-xs font-semibold text-foreground">Seu melhor ranking hoje</span>
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-primary" onClick={() => navigate("/corretor/ranking-equipes")}>
                    Ver rankings →
                  </Button>
                </div>
                <div className="space-y-1">
                  {[
                    { emoji: "📞", label: "Oferta Ativa", pos: radar.rankingPos || "—", level: currentLevel },
                    { emoji: "💰", label: "VGV", pos: "—", level: currentLevel },
                    { emoji: "📋", label: "Gestão Leads", pos: "—", level: currentLevel },
                  ].map((cat) => (
                    <div
                      key={cat.label}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs hover:bg-accent/30 transition-colors"
                    >
                      <span className="text-sm">{cat.emoji}</span>
                      <span className="flex-1 text-foreground font-medium">{cat.label}</span>
                      <span className="font-bold text-foreground tabular-nums">
                        {typeof cat.pos === "number" ? `#${cat.pos}` : cat.pos}
                      </span>
                      <span className={`text-[10px] font-semibold ${cat.level.color}`}>
                        {cat.level.emoji} {cat.level.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Finalizar Trabalho — desktop only in left column */}
          {metaSalva && progress.tentativas > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="hidden lg:block">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="w-full h-9 gap-2 text-xs text-muted-foreground hover:text-destructive" disabled={finalizando}>
                    <LogOut className="h-3.5 w-3.5" /> Finalizar Trabalho do Dia
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
                          <p className="text-lg font-bold text-success">{progress.aproveitados}</p>
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
        </div>

        {/* ===== COLUNA DIREITA ===== */}
        <div className="flex flex-col gap-4">

          {/* Meta do Dia */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            {!metaSalva ? (
              <DailyProgressCard progress={progress} goals={goals} saveGoals={saveGoals} variant="full" />
            ) : (
              <Card className="border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Meta do Dia</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-primary">Editar</Button>
                  </div>
                  {[
                    { emoji: "🔥", label: "Tentativas", value: progress.tentativas, max: goals?.meta_ligacoes || 30, pct: ligPct, barColor: "bg-primary" },
                    { emoji: "✅", label: "Aproveitados", value: progress.aproveitados, max: goals?.meta_aproveitados || 5, pct: aprvPct, barColor: "bg-[#16A34A]" },
                    { emoji: "📅", label: "Visitas", value: progress.visitasMarcadas, max: goals?.meta_visitas_marcadas || 3, pct: visPct, barColor: "bg-purple-500" },
                  ].map((item) => {
                    const valueColor = item.value === 0
                      ? "text-muted-foreground"
                      : item.pct >= 100
                      ? "text-[#16A34A]"
                      : "text-primary";
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{item.emoji} {item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${valueColor}`}>{item.value}/{item.max}</span>
                            <span className="text-[10px] text-muted-foreground w-8 text-right">{item.pct}%</span>
                          </div>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={`h-full rounded-full ${item.pct >= 100 ? "bg-[#16A34A]" : item.barColor}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Prioridades Agora */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎯</span>
                    <span className="text-sm font-semibold text-foreground">Prioridades Agora</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{radar.priorityLeads?.length || 0}</span>
                </div>
                {(!radar.priorityLeads || radar.priorityLeads.length === 0) ? (
                  <div className="text-center py-3">
                    <p className="text-sm text-muted-foreground">✅ Tudo em dia! Bora prospectar.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {radar.priorityLeads.map((lead: any) => {
                      const hrs = differenceInHours(new Date(), new Date(lead.stage_changed_at));
                      const isUrgent = hrs >= 24;
                      return (
                        <div key={lead.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/60 hover:bg-accent/30 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs">{isUrgent ? "🚨" : "⭐"}</span>
                              <span className="text-xs font-bold text-foreground truncate">{lead.nome}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {lead.empreendimento || "Sem empreendimento"}
                              {isUrgent && <span className="text-danger-500 font-medium"> · SLA {hrs}h</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {lead.telefone && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => window.open(`tel:${lead.telefone}`, "_self")}
                              >
                                <Phone className="h-3 w-3 text-[#16A34A]" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => navigate("/pipeline")}
                            >
                              <ArrowRight className="h-3 w-3 text-primary" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Agenda de Hoje */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Hoje</span>
                </div>
                {radar.visitas.length === 0 ? (
                  <div className="text-center py-3 space-y-1">
                    <p className="text-sm text-muted-foreground">😴 Livre hoje. Que tal marcar uma?</p>
                    <Button variant="link" size="sm" className="text-xs text-primary h-auto p-0" onClick={() => navigate("/agenda-visitas")}>
                      Abrir agenda →
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {radar.visitas.map((v: any) => (
                      <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/60">
                        <span className="text-xs font-bold text-primary shrink-0 w-12">
                          {v.hora_visita?.slice(0, 5) || "–"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{v.nome_cliente}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{v.empreendimento}</p>
                        </div>
                      </div>
                    ))}
                    <Button variant="link" size="sm" className="text-xs text-primary h-auto p-0" onClick={() => navigate("/agenda-visitas")}>
                      Ver agenda completa →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ⚡ Pulse Feed */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <PulseFeed />
          </motion.div>
        </div>
      </div>

      {/* RODAPÉ — full width, atalhos */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-4 shrink-0 relative z-10">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Agenda", icon: CalendarDays, path: "/agenda-visitas", color: "text-primary" },
            { label: "HOMI", icon: Bot, path: "/homi", color: "text-purple-500" },
            { label: "Scripts", icon: FileEdit, path: "/scripts", color: "text-amber-500" },
            { label: "Desempenho", icon: BarChart3, path: "/corretor/resumo", color: "text-[#16A34A]" },
          ].map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              className="h-auto flex-col gap-1 py-3 text-muted-foreground hover:text-foreground hover:-translate-y-0.5 transition-all duration-150"
              onClick={() => navigate(item.path)}
            >
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Button>
          ))}
        </div>

        {/* Finalizar — mobile only */}
        {metaSalva && progress.tentativas > 0 && (
          <div className="lg:hidden mt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full h-9 gap-2 text-xs text-muted-foreground hover:text-destructive" disabled={finalizando}>
                  <LogOut className="h-3.5 w-3.5" /> Finalizar Trabalho do Dia
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
                        <p className="text-lg font-bold text-success">{progress.aproveitados}</p>
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
          </div>
        )}
      </motion.div>
    </div>
  );
}