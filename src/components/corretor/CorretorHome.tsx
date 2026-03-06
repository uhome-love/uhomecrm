import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, MessageCircle, Mail, Target, Trophy, CheckCircle, History, Flame, ArrowRight, Zap, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCorretorDailyStats, useCorretorDailyGoals, useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
const homiMascot = "/images/homi-mascot-opt.png";

export default function CorretorHome() {
  const { stats } = useCorretorDailyStats();
  const { goals, saveGoals } = useCorretorDailyGoals();
  const motivation = useDailyMotivation();
  const navigate = useNavigate();

  const [metaLig, setMetaLig] = useState("30");
  const [metaAprov, setMetaAprov] = useState("5");
  const [metaVisitas, setMetaVisitas] = useState("3");
  const [editing, setEditing] = useState(false);

  // Sync local state when goals load from DB
  useEffect(() => {
    if (goals) {
      setMetaLig(goals.meta_ligacoes.toString());
      setMetaAprov(goals.meta_aproveitados.toString());
      setMetaVisitas(goals.meta_visitas_marcadas.toString());
      setEditing(false);
    } else if (goals === null) {
      // No goals saved yet for today, show editor
      setEditing(true);
    }
  }, [goals?.id, goals?.meta_ligacoes, goals?.meta_aproveitados, goals?.meta_visitas_marcadas]);

  const metaLigacoes = goals?.meta_ligacoes || 30;
  const metaAproveitados = goals?.meta_aproveitados || 5;
  const metaVisitasMarcar = goals?.meta_visitas_marcadas || 3;
  const progLig = Math.min(100, Math.round((stats.tentativas / metaLigacoes) * 100));
  const progAprov = Math.min(100, Math.round((stats.aproveitados / metaAproveitados) * 100));
  const progVisitas = Math.min(100, Math.round((stats.visitas_marcadas / metaVisitasMarcar) * 100));

  const handleSaveGoals = async () => {
    await saveGoals(parseInt(metaLig) || 30, parseInt(metaAprov) || 5, parseInt(metaVisitas) || 3);
    setEditing(false);
    toast.success("Meta do dia salva!");
  };

  // Gamification level
  const totalPontos = stats.pontos;
  const level = totalPontos >= 50 ? "👑 Lenda" : totalPontos >= 30 ? "⭐ Mestre" : totalPontos >= 15 ? "🔥 Veterano" : totalPontos >= 5 ? "💪 Ativo" : "🌱 Iniciante";
  const levelColor = totalPontos >= 50 ? "text-amber-500" : totalPontos >= 30 ? "text-purple-500" : totalPontos >= 15 ? "text-orange-500" : totalPontos >= 5 ? "text-emerald-500" : "text-muted-foreground";
  const nextLevel = totalPontos >= 50 ? 50 : totalPontos >= 30 ? 50 : totalPontos >= 15 ? 30 : totalPontos >= 5 ? 15 : 5;
  const levelProgress = Math.min(100, Math.round((totalPontos / nextLevel) * 100));

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

      {/* Daily Goals */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Meta do Dia
              </h3>
              {goals && !editing && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditing(true)}>Editar</Button>
              )}
            </div>

            {editing ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-medium">Meta Ligações</label>
                  <Input type="number" value={metaLig} onChange={e => setMetaLig(e.target.value)} className="h-9 mt-1 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-medium">Meta Aproveitados</label>
                  <Input type="number" value={metaAprov} onChange={e => setMetaAprov(e.target.value)} className="h-9 mt-1 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-medium">Meta Visitas</label>
                  <Input type="number" value={metaVisitas} onChange={e => setMetaVisitas(e.target.value)} className="h-9 mt-1 rounded-lg" />
                </div>
                <Button size="sm" className="col-span-3 rounded-lg" onClick={handleSaveGoals}>Salvar Meta do Dia</Button>
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
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Visitas a Marcar</span>
                    <span className="font-bold text-foreground">{stats.visitas_marcadas} / {metaVisitasMarcar}</span>
                  </div>
                  <Progress value={progVisitas} className="h-2.5" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Performance Cards */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Ligações", value: stats.ligacoes, icon: Phone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "WhatsApps", value: stats.whatsapps, icon: MessageCircle, color: "text-green-500", bg: "bg-green-500/10" },
            { label: "E-mails", value: stats.emails, icon: Mail, color: "text-primary", bg: "bg-primary/10" },
            { label: "Taxa Aprov.", value: `${stats.taxa_aproveitamento}%`, icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
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
                  <p className="text-2xl font-display font-extrabold text-foreground">{stats.pontos} pts</p>
                  <p className="text-[10px] text-muted-foreground">Pontuação de hoje</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className={`gap-1 text-xs font-bold ${levelColor}`}>
                  {level}
                </Badge>
                <p className="text-[9px] text-muted-foreground mt-0.5">{totalPontos}/{nextLevel} pts</p>
              </div>
            </div>
            <Progress value={levelProgress} className="h-1.5" />
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
