import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, CheckCircle, Trophy, Lock, LogOut, Kanban, CalendarDays, Bot, FileEdit, BarChart3, AlertCircle, Clock, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import DailyProgressCard from "@/components/corretor/DailyProgressCard";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import CorretorListSelection from "@/components/oferta-ativa/CorretorListSelection";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";

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

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-success";
  if (pct >= 70) return "bg-primary";
  if (pct >= 40) return "bg-warning";
  return "bg-danger-500/70";
}

export default function CorretorDashboard() {
  const { progress, goals, saveGoals } = useCorretorProgress();
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const motivation = useDailyMotivation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("central");
  const [nome, setNome] = useState("");
  const [finalizando, setFinalizando] = useState(false);

  // Radar data
  const { data: radarData } = useQuery({
    queryKey: ["corretor-radar", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      // Leads pending contact
      const { count: pendingLeads } = await (supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true }) as any)
        .eq("corretor_id", user!.id)
        .is("proxima_acao", null);

      // SLA expired
      const slaThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: slaExpired } = await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user!.id)
        .lt("stage_changed_at", slaThreshold);

      // Visits today
      const { data: visitas } = await supabase
        .from("visitas")
        .select("horario")
        .eq("corretor_id", user!.id)
        .eq("data", today)
        .order("horario");

      // Ranking position
      const { data: rankingData } = await supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id")
        .gte("created_at", today + "T00:00:00");

      const counts: Record<string, number> = {};
      rankingData?.forEach(r => { counts[r.corretor_id] = (counts[r.corretor_id] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const myPos = sorted.findIndex(([id]) => id === user!.id) + 1;
      const totalBrokers = sorted.length || 1;
      const nextAbove = myPos > 1 ? sorted[myPos - 2]?.[1] - (counts[user!.id] || 0) : 0;

      return {
        pendingLeads: pendingLeads || 0,
        slaExpired: slaExpired || 0,
        visitas: visitas || [],
        rankingPos: myPos || totalBrokers,
        totalBrokers,
        ptsToNext: Math.max(0, nextAbove),
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
    });
  }, [user]);

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

  const ligPct = goals ? Math.min(100, Math.round((progress.tentativas / (goals.meta_ligacoes || 30)) * 100)) : 0;
  const aprvPct = goals ? Math.min(100, Math.round((progress.aproveitados / (goals.meta_aproveitados || 5)) * 100)) : 0;
  const visPct = goals ? Math.min(100, Math.round((progress.visitasMarcadas / (goals.meta_visitas_marcadas || 3)) * 100)) : 0;

  const radar = radarData || { pendingLeads: 0, slaExpired: 0, visitas: [], rankingPos: 0, totalBrokers: 1, ptsToNext: 0 };

  return (
    <div className="flex flex-col h-[calc(100vh-56px-2rem)] max-w-2xl mx-auto px-4 md:px-6 py-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 min-h-0">
        <TabsList className="grid w-full grid-cols-4 h-auto shrink-0">
          <TabsTrigger value="central" className="gap-1 text-xs py-2">
            <Zap className="h-3.5 w-3.5" /> Rotina
          </TabsTrigger>
          <TabsTrigger value="discagem" className="gap-1 text-xs py-2" disabled={!metaSalva}>
            {!metaSalva && <Lock className="h-3 w-3" />}
            <Phone className="h-3.5 w-3.5" /> Call
          </TabsTrigger>
          <TabsTrigger value="aproveitados" className="gap-1 text-xs py-2">
            <CheckCircle className="h-3.5 w-3.5" /> Aprov.
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1 text-xs py-2">
            <Trophy className="h-3.5 w-3.5" /> Ranking
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Central (Briefing Matinal) ── */}
        <TabsContent value="central" className="flex-1 min-h-0 overflow-auto mt-4">
          <div className="flex flex-col gap-5 pb-4">

            {/* BLOCO 1 — Saudação */}
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                <img src={homiMascot} alt="Homi" className="h-10 w-10 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-foreground">
                  Fala, <span className="text-primary">{nome || "Corretor"}</span>! 💪
                </h1>
                <p className="text-sm text-muted-foreground truncate">{motivation}</p>
              </div>
            </motion.div>

            {/* BLOCO 2 — Radar do Dia */}
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="grid grid-cols-3 gap-3">
                {/* Leads */}
                <Card
                  className="cursor-pointer hover:border-primary/30 hover:shadow-card-hover transition-all duration-150"
                  onClick={() => navigate("/pipeline")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertCircle className="h-3.5 w-3.5 text-danger-500" />
                      <span className="text-xs font-medium text-muted-foreground">Leads</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground leading-none">{radar.pendingLeads}</p>
                    <p className="text-xs text-muted-foreground mt-1">p/ contatar</p>
                    {radar.slaExpired > 0 && (
                      <p className="text-[11px] text-danger-500 font-medium mt-0.5">{radar.slaExpired} SLA expirado</p>
                    )}
                  </CardContent>
                </Card>

                {/* Agenda */}
                <Card
                  className="cursor-pointer hover:border-primary/30 hover:shadow-card-hover transition-all duration-150"
                  onClick={() => navigate("/agenda-visitas")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">Agenda</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground leading-none">{radar.visitas.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {radar.visitas.length === 1 ? "visita" : "visitas"}
                    </p>
                    {radar.visitas.length > 0 && (
                      <p className="text-[11px] text-primary font-medium mt-0.5">
                        {radar.visitas.map((v: any) => v.horario?.slice(0, 5)).join(" · ")}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Ranking */}
                <Card
                  className="cursor-pointer hover:border-primary/30 hover:shadow-card-hover transition-all duration-150"
                  onClick={() => setActiveTab("ranking")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Trophy className="h-3.5 w-3.5 text-warning" />
                      <span className="text-xs font-medium text-muted-foreground">Ranking</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground leading-none">
                      #{radar.rankingPos || "–"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">de {radar.totalBrokers}</p>
                    {radar.ptsToNext > 0 && (
                      <p className="text-[11px] text-warning-700 font-medium mt-0.5">{radar.ptsToNext}pts p/ subir</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>

            {/* BLOCO 3 — Meta do Dia */}
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {!metaSalva ? (
                <DailyProgressCard
                  progress={progress}
                  goals={goals}
                  saveGoals={saveGoals}
                  variant="full"
                />
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
                      { emoji: "🔥", label: "Tentativas", value: progress.tentativas, max: goals?.meta_ligacoes || 30, pct: ligPct },
                      { emoji: "✅", label: "Aproveitados", value: progress.aproveitados, max: goals?.meta_aproveitados || 5, pct: aprvPct },
                      { emoji: "📅", label: "Visitas", value: progress.visitasMarcadas, max: goals?.meta_visitas_marcadas || 3, pct: visPct },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{item.emoji} {item.label}</span>
                          <span className="text-xs font-bold text-foreground">{item.value}/{item.max}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={`h-full rounded-full ${getProgressColor(item.pct)}`}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </motion.div>

            {/* BLOCO 4 — Botões de Ação */}
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  disabled={!metaSalva}
                  className={`h-20 flex-col gap-1.5 rounded-xl text-base font-bold ${
                    metaSalva
                      ? "bg-primary hover:bg-primary-600 text-primary-foreground"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                  onClick={() => metaSalva && setActiveTab("discagem")}
                >
                  {!metaSalva ? <Lock className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                  {metaSalva ? "Iniciar Call" : "🔒 Iniciar Call"}
                  <span className="text-xs font-normal opacity-70">Oferta Ativa</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-1.5 rounded-xl text-base font-bold"
                  onClick={() => navigate("/pipeline")}
                >
                  <Kanban className="h-5 w-5" />
                  Gestão de Leads
                  <span className="text-xs font-normal text-muted-foreground">Pipeline</span>
                </Button>
              </div>
              {!metaSalva && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Defina sua meta acima para liberar a discagem.
                </p>
              )}
            </motion.div>

            {/* Links secundários */}
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Agenda", icon: CalendarDays, path: "/agenda-visitas" },
                  { label: "HOMI", icon: Bot, path: "/homi" },
                  { label: "Scripts", icon: FileEdit, path: "/scripts" },
                  { label: "Desempenho", icon: BarChart3, path: "/corretor/resumo" },
                ].map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    className="h-auto flex-col gap-1 py-3 text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </Button>
                ))}
              </div>
            </motion.div>

            {/* Finalizar Trabalho */}
            {metaSalva && progress.tentativas > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full h-9 gap-2 text-xs text-muted-foreground hover:text-destructive"
                      disabled={finalizando}
                    >
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
        </TabsContent>

        {/* ── Tab: Discagem ── */}
        <TabsContent value="discagem" className="flex-1 min-h-0 overflow-auto mt-4">
          <CorretorListSelection />
        </TabsContent>

        {/* ── Tab: Aproveitados ── */}
        <TabsContent value="aproveitados" className="flex-1 min-h-0 overflow-auto mt-4">
          <AproveitadosPanel />
        </TabsContent>

        {/* ── Tab: Ranking ── */}
        <TabsContent value="ranking" className="flex-1 min-h-0 overflow-auto mt-4">
          <RankingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
