import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, CheckCircle, Trophy, Target, Flame, MessageCircle, Mail, ArrowRight, Lock, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useCorretorDailyStats, useCorretorDailyGoals, useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CorretorListSelection from "@/components/oferta-ativa/CorretorListSelection";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";
import ScoringLegend from "@/components/oferta-ativa/ScoringLegend";
import { toast } from "sonner";

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

  // Gestores/Admins devem usar o Centro de Comando, não a Central do Corretor
  if (!roleLoading && (isGestor || isAdmin)) {
    return <Navigate to="/" replace />;
  }

  const metaLigacoes = goals?.meta_ligacoes || 30;
  const metaAproveitados = goals?.meta_aproveitados || 5;
  const metaVisitasM = goals?.meta_visitas_marcadas || 3;
  const progLig = Math.min(100, Math.round((stats.tentativas / metaLigacoes) * 100));
  const progAprov = Math.min(100, Math.round((stats.aproveitados / metaAproveitados) * 100));
  const metaSalva = !!goals;

  const handleSaveGoals = async () => {
    await saveGoals(parseInt(metaLig) || 30, parseInt(metaAprov) || 5, parseInt(metaVisitas) || 3);
    setEditing(false);
    toast.success("Meta do dia salva! Discagem liberada.");
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
        toast.success(`Trabalho finalizado! ${result.tentativas} tentativas e ${result.aproveitados} aproveitados enviados ao gerente.`);
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
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {nome ? (
            <>Bem-vindo(a), <span className="text-primary">{nome}</span>!</>
          ) : (
            <>Bem-vindo(a), <span className="text-primary">Corretor</span>!</>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">Central do Corretor — foco, meta e execução</p>
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
          {/* Motivation */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0 mt-0.5">
                  <Flame className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">🔥 Motivação do Dia</p>
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
                          <label className="text-[10px] text-muted-foreground uppercase">Meta Ligações</label>
                          <Input type="number" value={metaLig} onChange={e => setMetaLig(e.target.value)} className="h-9 mt-1" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase">Meta Aproveitados</label>
                          <Input type="number" value={metaAprov} onChange={e => setMetaAprov(e.target.value)} className="h-9 mt-1" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase">Meta Visitas a Marcar</label>
                          <Input type="number" value={metaVisitas} onChange={e => setMetaVisitas(e.target.value)} className="h-9 mt-1" />
                        </div>
                        <Button size="sm" className="col-span-3" onClick={handleSaveGoals}>
                          {metaSalva ? "Atualizar Meta" : "Salvar Meta e Liberar Discagem"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Tentativas</span>
                          <span className="font-bold text-foreground">{stats.tentativas} / {metaLigacoes}</span>
                        </div>
                        <Progress value={progLig} className="h-2.5" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Aproveitados</span>
                          <span className="font-bold text-foreground">{stats.aproveitados} / {metaAproveitados}</span>
                        </div>
                        <Progress value={progAprov} className="h-2.5" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Points */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-primary/10 h-full">
                <CardContent className="p-4 flex flex-col items-center justify-center h-full gap-2">
                  <Trophy className="h-8 w-8 text-primary" />
                  <p className="text-3xl font-bold text-foreground">{stats.pontos} pts</p>
                  <p className="text-[10px] text-muted-foreground">Pontuação de hoje</p>
                  <Badge variant="outline" className="gap-1 text-xs mt-1">
                    {stats.aproveitados} aprov. · {stats.tentativas} tent.
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Stats Grid */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Ligações", value: stats.ligacoes, icon: Phone, color: "text-emerald-600" },
                { label: "WhatsApps", value: stats.whatsapps, icon: MessageCircle, color: "text-green-600" },
                { label: "E-mails", value: stats.emails, icon: Mail, color: "text-blue-500" },
                { label: "Taxa Aprov.", value: `${stats.taxa_aproveitamento}%`, icon: CheckCircle, color: "text-primary" },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground leading-none">{item.value}</p>
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
                  className="flex-1 h-14 gap-2 text-base bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setActiveTab("discagem")}
                >
                  <Phone className="h-5 w-5" /> Iniciar Discagem <ArrowRight className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 gap-2 text-base border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={handleFinalizarTrabalho}
                  disabled={finalizando || stats.tentativas === 0}
                >
                  <LogOut className="h-5 w-5" /> {finalizando ? "Enviando..." : "Finalizar Trabalho"}
                </Button>
              </div>
            ) : (
              <Card className="border-muted bg-muted/30">
                <CardContent className="p-4 text-center">
                  <Lock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Salve sua meta do dia acima para liberar a discagem</p>
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
