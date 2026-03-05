import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, MessageCircle, Mail, Target, Trophy, CheckCircle, History, Flame, ArrowRight, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCorretorDailyStats, useCorretorDailyGoals, useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function CorretorHome() {
  const { stats } = useCorretorDailyStats();
  const { goals, saveGoals } = useCorretorDailyGoals();
  const motivation = useDailyMotivation();
  const navigate = useNavigate();

  const [metaLig, setMetaLig] = useState(goals?.meta_ligacoes?.toString() || "30");
  const [metaAprov, setMetaAprov] = useState(goals?.meta_aproveitados?.toString() || "5");
  const [metaVisitas, setMetaVisitas] = useState(goals?.meta_visitas_marcadas?.toString() || "3");
  const [editing, setEditing] = useState(!goals);

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

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" /> Central do Corretor
        </h1>
        <p className="text-sm text-muted-foreground">Foco, meta e execução. Seu dia começa aqui.</p>
      </div>

      {/* Motivation Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0 mt-0.5">
              <Flame className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">🔥 Motivação do Dia</p>
              <p className="text-sm font-medium text-foreground mt-1 italic">"{motivation}"</p>
              <p className="text-[10px] text-muted-foreground mt-1">Meta, ritmo e execução.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Daily Goals */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
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
                <Button size="sm" className="col-span-3" onClick={handleSaveGoals}>Salvar Meta do Dia</Button>
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

      {/* Auto-progress Stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Ligações", value: stats.ligacoes, icon: Phone, color: "text-emerald-600" },
            { label: "WhatsApps", value: stats.whatsapps, icon: MessageCircle, color: "text-green-600" },
            { label: "E-mails", value: stats.emails, icon: Mail, color: "text-blue-500" },
            { label: "Taxa Aprov.", value: `${stats.taxa_aproveitamento}%`, icon: CheckCircle, color: "text-primary" },
          ].map((item, i) => (
            <Card key={item.label}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0`}>
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

      {/* Points */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="border-primary/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pontos} pts</p>
                <p className="text-[10px] text-muted-foreground">Pontuação de hoje</p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1 text-xs">
              {stats.aproveitados} aproveitados · {stats.tentativas} tentativas
            </Badge>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Access */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-14 gap-2 text-base bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate("/oferta-ativa")}
          >
            <Phone className="h-5 w-5" /> Entrar em Oferta Ativa
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 gap-2 text-base"
            onClick={() => navigate("/oferta-ativa?tab=aproveitados")}
          >
            <CheckCircle className="h-5 w-5" /> Meus Aproveitados
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 gap-2 text-base"
            onClick={() => navigate("/oferta-ativa?tab=ranking")}
          >
            <Trophy className="h-5 w-5" /> Meu Ranking
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 gap-2 text-base"
            onClick={() => navigate("/oferta-ativa?tab=ranking")}
          >
            <History className="h-5 w-5" /> Meu Histórico
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
