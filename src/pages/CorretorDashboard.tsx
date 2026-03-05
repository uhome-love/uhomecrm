import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, CheckCircle, Trophy, Target, Flame, MessageCircle, Mail, ArrowRight, Lock, LogOut, Sparkles, Star, Zap, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useCorretorDailyStats, useCorretorDailyGoals, useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import CorretorListSelection from "@/components/oferta-ativa/CorretorListSelection";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";
import ScoringLegend from "@/components/oferta-ativa/ScoringLegend";

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
import homiMascot from "@/assets/homi-mascot.png";

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

// Level badge based on points
function getLevelInfo(pontos: number) {
  if (pontos >= 50) return { label: "Lenda", emoji: "👑", color: "text-amber-400" };
  if (pontos >= 30) return { label: "Mestre", emoji: "⭐", color: "text-purple-500" };
  if (pontos >= 15) return { label: "Veterano", emoji: "🔥", color: "text-orange-500" };
  if (pontos >= 5) return { label: "Ativo", emoji: "💪", color: "text-blue-500" };
  return { label: "Iniciante", emoji: "🌱", color: "text-emerald-500" };
}

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 70) return "bg-primary";
  if (pct >= 40) return "bg-amber-500";
  return "bg-destructive/70";
}

export default function CorretorDashboard() {
  const { stats } = useCorretorDailyStats();
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const { goals, saveGoals } = useCorretorDailyGoals();
  const motivation = useDailyMotivation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("central");
  const [nome, setNome] = useState("");
  const [metaLig, setMetaLig] = useState(goals?.meta_ligacoes?.toString() || "30");
  const [metaAprov, setMetaAprov] = useState(goals?.meta_aproveitados?.toString() || "5");
  const [metaVisitas, setMetaVisitas] = useState(goals?.meta_visitas_marcadas?.toString() || "3");
  const [editing, setEditing] = useState(!goals);
  const [finalizando, setFinalizando] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [prevAproveitados, setPrevAproveitados] = useState(0);

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
      const dates = new Set(data.map(d => new Date(d.created_at).toISOString().split("T")[0]));
      let count = 0;
      const check = new Date();
      for (let i = 0; i < 30; i++) {
        if (dates.has(check.toISOString().split("T")[0])) {
          count++;
          check.setDate(check.getDate() - 1);
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

  useEffect(() => {
    setMetaLig(goals?.meta_ligacoes?.toString() || "30");
    setMetaAprov(goals?.meta_aproveitados?.toString() || "5");
    setMetaVisitas(goals?.meta_visitas_marcadas?.toString() || "3");
    setEditing(!goals);
  }, [goals]);

  // Celebration on new aproveitado
  useEffect(() => {
    if (stats.aproveitados > prevAproveitados && prevAproveitados > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    }
    setPrevAproveitados(stats.aproveitados);
  }, [stats.aproveitados]);

  if (!roleLoading && (isGestor || isAdmin)) {
    return <Navigate to="/" replace />;
  }

  const metaLigacoes = goals?.meta_ligacoes || 30;
  const metaAproveitados = goals?.meta_aproveitados || 5;
  const metaVisitasM = goals?.meta_visitas_marcadas || 3;
  const progLig = Math.min(100, Math.round((stats.tentativas / metaLigacoes) * 100));
  const progAprov = Math.min(100, Math.round((stats.aproveitados / metaAproveitados) * 100));
  const progVisitas = Math.min(100, Math.round((stats.visitas_marcadas / metaVisitasM) * 100));
  const metaSalva = !!goals;
  const level = getLevelInfo(stats.pontos);
  const allGoalsMet = progLig >= 100 && progAprov >= 100;

  const handleSaveGoals = async () => {
    await saveGoals(parseInt(metaLig) || 30, parseInt(metaAprov) || 5, parseInt(metaVisitas) || 3);
    setEditing(false);
    toast.success("Meta do dia salva! Discagem liberada. 🚀");
  };

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
          <div className="text-2xl">{level.emoji}</div>
          <p className={`text-[10px] font-bold ${level.color}`}>{level.label}</p>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="central" className="gap-1.5 text-xs py-2">
            <Target className="h-3.5 w-3.5" /> Central
          </TabsTrigger>
          <TabsTrigger value="discagem" className="gap-1.5 text-xs py-2" disabled={!metaSalva}>
            {!metaSalva && <Lock className="h-3 w-3" />}
            <Phone className="h-3.5 w-3.5" /> Discagem
          </TabsTrigger>
          <TabsTrigger value="aproveitados" className="gap-1.5 text-xs py-2">
            <CheckCircle className="h-3.5 w-3.5" /> Aproveitados
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5 text-xs py-2">
            <Trophy className="h-3.5 w-3.5" /> Ranking
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Central ── */}
        <TabsContent value="central" className="space-y-4 mt-4">
          {/* Celebration Banner */}
          <AnimatePresence>
            {allGoalsMet && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-primary/10 to-amber-500/10">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl mb-1">🏆🎉🔥</p>
                    <p className="text-sm font-bold text-foreground">MISSÃO DO DIA CUMPRIDA!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Você é uma máquina! Continue assim para subir no ranking.</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Motivation */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0 mt-0.5">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">💬 Mensagem do Dia</p>
                  <p className="text-sm font-medium text-foreground mt-1 italic">"{motivation}"</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Daily Goals */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="lg:col-span-2">
              <Card className={`h-full ${!metaSalva ? "ring-2 ring-primary/40 border-primary/30" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" /> Meta do Dia
                      {!metaSalva && (
                        <Badge variant="destructive" className="text-[10px] h-5 animate-pulse">
                          Obrigatória
                        </Badge>
                      )}
                    </h3>
                    {metaSalva && !editing && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditing(true)}>Editar</Button>
                    )}
                  </div>

                  {editing ? (
                    <div className="space-y-3">
                      {!metaSalva && (
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                          ⚠️ Defina sua meta do dia. A aba Discagem será liberada após salvar.
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase">Tentativas</label>
                          <Input type="number" value={metaLig} onChange={e => setMetaLig(e.target.value)} className="h-9 mt-1" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase">Aproveitados</label>
                          <Input type="number" value={metaAprov} onChange={e => setMetaAprov(e.target.value)} className="h-9 mt-1" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase">Visitas</label>
                          <Input type="number" value={metaVisitas} onChange={e => setMetaVisitas(e.target.value)} className="h-9 mt-1" />
                        </div>
                        <Button size="sm" className="col-span-3 gap-1.5" onClick={handleSaveGoals}>
                          <Zap className="h-4 w-4" /> {metaSalva ? "Atualizar Meta" : "Salvar e Liberar Discagem 🚀"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[
                        { label: "Tentativas", current: stats.tentativas, meta: metaLigacoes, prog: progLig },
                        { label: "Aproveitados", current: stats.aproveitados, meta: metaAproveitados, prog: progAprov },
                        { label: "Visitas a Marcar", current: stats.visitas_marcadas, meta: metaVisitasM, prog: progVisitas },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-bold text-foreground flex items-center gap-1">
                              {item.current} / {item.meta}
                              {item.prog >= 100 && <span className="text-emerald-500">✓</span>}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                            <motion.div
                              className={`h-2.5 rounded-full transition-colors ${getProgressColor(item.prog)}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, item.prog)}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Points & Level */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-primary/10 h-full">
                <CardContent className="p-4 flex flex-col items-center justify-center h-full gap-2">
                  <div className="text-3xl">{level.emoji}</div>
                  <p className={`text-xs font-bold ${level.color} uppercase tracking-wider`}>{level.label}</p>
                  <motion.p
                    key={stats.pontos}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-4xl font-bold text-foreground"
                  >
                    {stats.pontos}
                  </motion.p>
                  <p className="text-[10px] text-muted-foreground">pontos hoje</p>
                  <div className="w-full mt-2 space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{stats.aproveitados} aprov.</span>
                      <span>{stats.tentativas} tent.</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{stats.taxa_aproveitamento}% taxa</span>
                      {(streak || 0) >= 1 && <span className="text-orange-500 font-semibold">🔥 {streak}d</span>}
                    </div>
                  </div>

                  {/* Level Legend */}
                  <div className="w-full mt-3 pt-3 border-t border-border space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground text-center uppercase tracking-wider">Níveis</p>
                    {[
                      { emoji: "🌱", label: "Iniciante", range: "0–4 pts", color: "text-emerald-500" },
                      { emoji: "💪", label: "Ativo", range: "5–14 pts", color: "text-blue-500" },
                      { emoji: "🔥", label: "Veterano", range: "15–29 pts", color: "text-orange-500" },
                      { emoji: "⭐", label: "Mestre", range: "30–49 pts", color: "text-purple-500" },
                      { emoji: "👑", label: "Lenda", range: "50+ pts", color: "text-amber-400" },
                    ].map((lv) => (
                      <div key={lv.label} className={`flex items-center justify-between text-[10px] ${lv.label === level.label ? "font-bold" : "opacity-60"}`}>
                        <span className={lv.color}>{lv.emoji} {lv.label}</span>
                        <span className="text-muted-foreground">{lv.range}</span>
                      </div>
                    ))}
                    <p className="text-[9px] text-muted-foreground text-center mt-1.5 leading-tight">
                      +3 pts por aproveitado · +1 pt por tentativa
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Stats Grid */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Ligações", value: stats.ligacoes, icon: Phone, color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
                { label: "WhatsApps", value: stats.whatsapps, icon: MessageCircle, color: "text-green-600", bgColor: "bg-green-500/10" },
                { label: "E-mails", value: stats.emails, icon: Mail, color: "text-blue-500", bgColor: "bg-blue-500/10" },
                { label: "Taxa Aprov.", value: `${stats.taxa_aproveitamento}%`, icon: TrendingUp, color: "text-primary", bgColor: "bg-primary/10" },
              ].map((item) => (
                <Card key={item.label} className="overflow-hidden">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bgColor} shrink-0`}>
                      <item.icon className={`h-5 w-5 ${item.color}`} />
                    </div>
                    <div>
                      <motion.p
                        key={String(item.value)}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="text-xl font-bold text-foreground leading-none"
                      >
                        {item.value}
                      </motion.p>
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* Scoring Legend */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <ScoringLegend />
          </motion.div>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {metaSalva ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="flex-1 h-14 gap-2 text-base bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all"
                  onClick={() => setActiveTab("discagem")}
                >
                  <Phone className="h-5 w-5" /> Iniciar o Call <ArrowRight className="h-5 w-5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-14 gap-2 text-base border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={finalizando || stats.tentativas === 0}
                    >
                      <LogOut className="h-5 w-5" /> Finalizar Trabalho
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Finalizar trabalho do dia?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>Suas estatísticas serão enviadas ao gerente:</p>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="text-center p-2 rounded-lg bg-muted">
                            <p className="text-lg font-bold text-foreground">{stats.tentativas}</p>
                            <p className="text-[10px] text-muted-foreground">tentativas</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted">
                            <p className="text-lg font-bold text-emerald-600">{stats.aproveitados}</p>
                            <p className="text-[10px] text-muted-foreground">aproveitados</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted">
                            <p className="text-lg font-bold text-primary">{stats.pontos}</p>
                            <p className="text-[10px] text-muted-foreground">pontos</p>
                          </div>
                        </div>
                        {!allGoalsMet && (
                          <p className="text-xs text-amber-600 mt-2">⚠️ Você ainda não bateu todas as metas. Tem certeza?</p>
                        )}
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
            ) : (
              <Card className="border-muted bg-muted/30">
                <CardContent className="p-4 text-center">
                  <Lock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Salve sua meta do dia acima para liberar a discagem 🔓</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
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
