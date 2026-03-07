import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, CheckCircle, Trophy, Target, Flame, Lock, LogOut, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import DailyProgressCard from "@/components/corretor/DailyProgressCard";
import AchievementsBadges from "@/components/corretor/AchievementsBadges";
import YesterdayComparison from "@/components/corretor/YesterdayComparison";
import QuickLinksGrid from "@/components/corretor/QuickLinksGrid";
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

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 70) return "bg-primary";
  if (pct >= 40) return "bg-amber-500";
  return "bg-destructive/70";
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
  const [syncingLeads, setSyncingLeads] = useState(false);

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
      const dates = new Set(data.map(d => {
        const dt = new Date(d.created_at);
        return dt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      }));
      let count = 0;
      const todayBrt = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
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

  if (!roleLoading && (isGestor || isAdmin)) {
    return <Navigate to="/" replace />;
  }

  const metaSalva = !!goals;
  const levelEmoji = progress.level.split(" ")[0];
  const levelLabel = progress.level.split(" ").slice(1).join(" ");

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

  // Progress percentages
  const ligPct = goals ? Math.min(100, Math.round((progress.tentativas / (goals.meta_ligacoes || 30)) * 100)) : 0;
  const aprvPct = goals ? Math.min(100, Math.round((progress.aproveitados / (goals.meta_aproveitados || 5)) * 100)) : 0;
  const visPct = goals ? Math.min(100, Math.round((progress.visitasMarcadas / (goals.meta_visitas_marcadas || 3)) * 100)) : 0;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto pb-24">
      {/* 1️⃣ HEADER */}
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="relative shrink-0"
        >
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center overflow-hidden shadow-lg">
            <img src={homiMascot} alt="Homi" className="h-12 w-12 object-contain" />
          </div>
          {(streak || 0) >= 2 && (
            <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">🔥</div>
          )}
        </motion.div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold text-foreground truncate">
            Fala, <span className="text-primary">{nome || "Corretor"}</span>! 💪
          </h1>
          <p className="text-xs text-muted-foreground">Bora fazer acontecer hoje</p>
        </div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center shrink-0">
          <div className="text-2xl">{levelEmoji}</div>
          <p className={`text-[10px] font-bold ${progress.levelColor}`}>{levelLabel}</p>
        </motion.div>
      </div>

      {/* FRASE DO DIA — abaixo do header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">💬 Frase do Dia</p>
            <p className="text-xs text-foreground italic">"{motivation}"</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="central" className="gap-1 text-[11px] py-2">
            <Target className="h-3.5 w-3.5" /> Home
          </TabsTrigger>
          <TabsTrigger value="discagem" className="gap-1 text-[11px] py-2" disabled={!metaSalva}>
            {!metaSalva && <Lock className="h-3 w-3" />}
            <Phone className="h-3.5 w-3.5" /> Call
          </TabsTrigger>
          <TabsTrigger value="aproveitados" className="gap-1 text-[11px] py-2">
            <CheckCircle className="h-3.5 w-3.5" /> Aprov.
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1 text-[11px] py-2">
            <Trophy className="h-3.5 w-3.5" /> Ranking
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Central ── */}
        <TabsContent value="central" className="space-y-4 mt-4">
          {/* 2️⃣ DISPONIBILIDADE & ROLETA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <CorretorDisponibilidadePanel />
          </motion.div>


          {/* 4️⃣ ATALHOS RÁPIDOS */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <QuickLinksGrid />
          </motion.div>

          {/* 5️⃣ META DO DIA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            {!metaSalva ? (
              <DailyProgressCard
                progress={progress}
                goals={goals}
                saveGoals={saveGoals}
                variant="full"
              />
            ) : (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">⊙ Meta do Dia</p>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => { /* toggle edit inline */ }}>Editar</Button>
                  </div>
                  {[
                    { label: "Tentativas", value: progress.tentativas, max: goals?.meta_ligacoes || 30, pct: ligPct },
                    { label: "Aproveitados", value: progress.aproveitados, max: goals?.meta_aproveitados || 5, pct: aprvPct },
                    { label: "Visitas", value: progress.visitasMarcadas, max: goals?.meta_visitas_marcadas || 3, pct: visPct },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
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

            {/* ACTION BUTTONS — below Meta do Dia */}
            <div className="flex gap-3 mt-3">
              <Button
                size="sm"
                disabled={!metaSalva}
                className={`flex-1 h-10 gap-2 text-xs font-bold rounded-xl ${
                  metaSalva
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
                onClick={() => {
                  if (metaSalva) setActiveTab("discagem");
                }}
              >
                {!metaSalva ? <Lock className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                {metaSalva ? "Iniciar Call" : "🔒 Iniciar Call"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={syncingLeads}
                className="flex-1 h-10 gap-2 text-xs font-bold rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => navigate("/pipeline")}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar Pipeline
              </Button>
            </div>
            {!metaSalva && (
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Defina sua meta do dia para liberar a discagem.
              </p>
            )}
          </motion.div>

          {/* 6️⃣ RANKING / PONTUAÇÃO */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{levelEmoji}</span>
                    <div>
                      <p className={`text-sm font-bold ${progress.levelColor}`}>{levelLabel}</p>
                      <p className="text-[10px] text-muted-foreground">{progress.pontos} pts hoje</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(streak || 0) >= 1 && (
                      <Badge variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1">
                        <Flame className="h-3 w-3" /> {streak}d
                      </Badge>
                    )}
                    <Progress value={progress.levelProgress} className="w-16 h-1.5" />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <AchievementsBadges progress={progress} streak={streak || 0} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 7️⃣ PERFORMANCE HOJE */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">📊 Performance Hoje</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Ligações", value: progress.tentativas, color: "text-primary" },
                    { label: "WhatsApp", value: 0, color: "text-emerald-600" },
                    { label: "E-mails", value: 0, color: "text-blue-600" },
                    { label: "Visitas", value: progress.visitasMarcadas, color: "text-amber-600" },
                    { label: "Taxa", value: `${progress.taxaAproveitamento}%`, color: "text-primary" },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <motion.p
                        key={String(item.value)}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className={`text-lg font-bold ${item.color} leading-none`}
                      >
                        {item.value}
                      </motion.p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
                {/* VS Ontem */}
                <div className="mt-3 pt-3 border-t border-border">
                  <YesterdayComparison progress={progress} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Finalizar Trabalho */}
          {metaSalva && progress.tentativas > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-10 gap-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
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
