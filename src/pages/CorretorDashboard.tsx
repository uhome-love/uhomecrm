import { useState, useEffect } from "react";
import { GreetingBar } from "@/components/ui/GreetingBar";
import { Phone, Lock, Kanban, CalendarDays, AlertCircle, Zap, LogOut, Loader2 } from "lucide-react";
import { LoadingState } from "@/components/ui/screen-states";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import DailyProgressCard from "@/components/corretor/DailyProgressCard";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { todayBRT } from "@/lib/utils";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { differenceInHours } from "date-fns";
import { getDynamicGreeting } from "@/lib/celebrations";
import MetaCelebration from "@/components/corretor/MetaCelebration";
import ConfettiBurst from "@/components/corretor/ConfettiToast";
import PulseFeed from "@/components/pulse/PulseFeed";
import RoletaStatusBar from "@/components/corretor/RoletaStatusBar";
import MinhaAgendaWidget from "@/components/corretor/MinhaAgendaWidget";
import DashboardAgendaPreview from "@/components/corretor/DashboardAgendaPreview";
import DashboardRankingsPreview from "@/components/corretor/DashboardRankingsPreview";
import DashboardDesempenhoWidget from "@/components/corretor/DashboardDesempenhoWidget";
import MiniAcademiaWidget from "@/components/corretor/MiniAcademiaWidget";

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
  const [editingMeta, setEditingMeta] = useState(false);

  // Radar data
  const { data: radarData } = useQuery({
    queryKey: ["corretor-radar", user?.id],
    queryFn: async () => {
      const today = todayBRT();
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count: totalLeads } = await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user!.id)
        .eq("aceite_status", "aceito")
        .neq("stage_id", "1dd66c25-3848-4053-9f66-82e902989b4d");

      // Use auth_user_id column (canonical) instead of corretor_id (profiles.id)
      const { count: totalNegocios } = await supabase
        .from("negocios")
        .select("id", { count: "exact", head: true })
        .eq("auth_user_id", user!.id)
        .neq("fase", "caiu");

      const { data: rankingData } = await supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id")
        .gte("created_at", today + "T00:00:00");

      const counts: Record<string, number> = {};
      rankingData?.forEach((r: any) => { counts[r.corretor_id] = (counts[r.corretor_id] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const myPos = sorted.findIndex(([id]) => id === user!.id) + 1;
      const totalBrokers = sorted.length || 1;
      const myPts = counts[user!.id] || 0;
      const nextAbove = myPos > 1 ? sorted[myPos - 2]?.[1] - myPts : 0;

      return {
        totalLeads: totalLeads || 0,
        totalNegocios: totalNegocios || 0,
        rankingPos: myPos || totalBrokers,
        totalBrokers,
        ptsToNext: Math.max(0, nextAbove),
        myPts,
        totalWithPoints: sorted.length,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_preview_url, avatar_url, avatar_gamificado_url").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (error) {
        console.warn("[CorretorDashboard] profile fetch error:", error.message);
        // Retry once after 2s
        setTimeout(() => {
          supabase.from("profiles").select("nome, avatar_preview_url, avatar_url, avatar_gamificado_url").eq("user_id", user.id).maybeSingle().then(({ data: d2 }) => {
            if (d2?.nome) setNome(d2.nome.split(" ")[0]);
            const av = d2?.avatar_preview_url || d2?.avatar_gamificado_url || d2?.avatar_url || null;
            if (av) setAvatarUrl(av);
          });
        }, 2000);
        return;
      }
      if (data?.nome) setNome(data.nome.split(" ")[0]);
      const av = data?.avatar_preview_url || (data as any)?.avatar_gamificado_url || (data as any)?.avatar_url || null;
      if (av) setAvatarUrl(av);
    });
  }, [user]);

  const metaSalva = !!goals;
  const ligPct = goals ? Math.min(100, Math.round((progress.tentativas / (goals.meta_ligacoes || 30)) * 100)) : 0;
  const aprvPct = goals ? Math.min(100, Math.round((progress.aproveitados / (goals.meta_aproveitados || 5)) * 100)) : 0;
  const visPct = goals ? Math.min(100, Math.round((progress.visitasMarcadas / (goals.meta_visitas_marcadas || 3)) * 100)) : 0;

  const allMetasComplete = goals && ligPct >= 100 && aprvPct >= 100 && visPct >= 100;
  useEffect(() => {
    if (allMetasComplete && !metaCelebrated) {
      setMetaCelebrated(true);
      setShowMetaCelebration(true);
      setConfettiTrigger(prev => prev + 1);
    }
  }, [allMetasComplete, metaCelebrated]);

  // While roles are still loading, show a brief loader instead of rendering the full dashboard
  if (roleLoading) {
    return (
      <LoadingState
        title="Preparando seu painel..."
        description="Verificando seu perfil e permissões."
      />
    );
  }

  // Admin/Gestor should not see corretor dashboard
  if (isGestor || isAdmin) {
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

  const radar = radarData || { totalLeads: 0, totalNegocios: 0, rankingPos: 0, totalBrokers: 1, ptsToNext: 0, myPts: 0, totalWithPoints: 0 };

  const greetingData = getDynamicGreeting({
    nome: nome || "Corretor",
    rankingPos: radar.rankingPos,
    slaExpired: 0,
    streak: 0,
    myPts: radar.myPts,
    totalWithPoints: radar.totalWithPoints,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-56px-2rem)] px-0 sm:px-4 md:px-6 lg:px-8 py-4 overflow-auto">
      <ConfettiBurst trigger={confettiTrigger} intensity="moderate" />
      <MetaCelebration show={showMetaCelebration} nome={nome || "Corretor"} onDismiss={() => setShowMetaCelebration(false)} />

      {/* HEADER */}
      <div className="mb-4">
        <GreetingBar
          name={nome || "Corretor"}
          avatarUrl={avatarUrl}
          subtitle={greetingData.subtitle}
        />
      </div>

      {/* STATUS BAR */}
      <div className="mb-4">
        <RoletaStatusBar />
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4 flex-1 min-h-0">

        {/* ===== COLUNA ESQUERDA ===== */}
        <div className="flex flex-col gap-4">

          {/* 3 Cards Contadores */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="grid grid-cols-3 gap-3">
              <Card className="cursor-pointer hover:border-orange-300 hover:shadow-card-hover transition-all duration-150" onClick={() => navigate("/pipeline-leads")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertCircle className="h-4 w-4 text-danger-500" />
                    <span className="text-xs font-medium text-muted-foreground">Leads</span>
                  </div>
                  <p className="text-3xl lg:text-4xl font-bold leading-none text-foreground">{radar.totalLeads}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">total</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary/30 hover:shadow-card-hover transition-all duration-150" onClick={() => navigate("/pipeline-negocios")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-medium text-muted-foreground">Negócios</span>
                  </div>
                  <p className={`text-3xl lg:text-4xl font-bold leading-none ${radar.totalNegocios > 0 ? "text-purple-500" : "text-foreground"}`}>{radar.totalNegocios}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">ativos</p>
                </CardContent>
              </Card>

              <Card className={`cursor-pointer hover:shadow-card-hover transition-all duration-150 ${radar.rankingPos === 1 ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50" : "hover:border-primary/30"}`} onClick={() => navigate("/corretor/call")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className={`h-4 w-4 ${radar.rankingPos === 1 ? "text-amber-500" : "text-warning"}`} />
                    <span className="text-xs font-medium text-muted-foreground">Ranking</span>
                  </div>
                  <p className={`text-3xl lg:text-4xl font-bold leading-none ${radar.rankingPos === 1 ? "text-amber-600" : "text-foreground"}`}>#{radar.rankingPos || "–"}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">de {radar.totalBrokers}</p>
                  {radar.ptsToNext > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-0.5">{radar.ptsToNext}pts p/ subir</p>
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
                onClick={() => navigate("/pipeline-leads")}
              >
                <Kanban className="h-6 w-6 shrink-0" />
                <div className="text-left">
                  <p className="text-base font-bold uppercase tracking-wide leading-tight">Gestão de Leads</p>
                  <p className="text-[10px] font-normal opacity-80">Pipeline</p>
                </div>
              </motion.button>
            </div>
            {!metaSalva && (
              <p className="text-xs text-amber-500 text-center mt-2 flex items-center justify-center gap-1">
                Defina sua meta ao lado para liberar →
              </p>
            )}
          </motion.div>

          {/* Agenda do Dia — Visitas + Reuniões */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <DashboardAgendaPreview />
          </motion.div>

          {/* Rankings — 3 tabs preview */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <DashboardRankingsPreview />
          </motion.div>

          {/* Pulse Feed */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <PulseFeed />
          </motion.div>

          {/* Finalizar Trabalho do Dia */}
          {metaSalva && progress.tentativas > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full h-9 gap-2 text-xs text-muted-foreground hover:text-destructive border-border/60" disabled={finalizando}>
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
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className={!metaSalva ? "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-background rounded-xl" : ""}
          >
            {!metaSalva || editingMeta ? (
              <DailyProgressCard progress={progress} goals={goals} saveGoals={async (a, b, c, d) => { await saveGoals(a, b, c, d); setEditingMeta(false); }} variant="full" />
            ) : (
              <Card className="border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Meta do Dia</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {goals?.status === "aprovado" && (
                        <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-700 border-emerald-500/30">✅ Aprovada</Badge>
                      )}
                      {goals?.status === "pendente" && (
                        <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-500/15 text-amber-700 border-amber-500/30">⏳ Aguardando aprovação</Badge>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => setEditingMeta(true)}>Editar</Button>
                    </div>
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

          {/* Agenda de Tarefas */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <MinhaAgendaWidget />
          </motion.div>

          {/* Meu Desempenho */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <DashboardDesempenhoWidget />
          </motion.div>

          {/* Mini Academia */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <MiniAcademiaWidget />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
