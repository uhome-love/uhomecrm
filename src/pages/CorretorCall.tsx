import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowLeft, Flame, Target, Trophy, Users, Clock, Zap, CheckCircle } from "lucide-react";
import CorretorListSelection from "@/components/oferta-ativa/CorretorListSelection";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const homiMascot = "/images/homi-mascot-opt.png";

type CallPhase = "warmup" | "session";

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-success";
  if (pct >= 70) return "bg-primary";
  if (pct >= 40) return "bg-warning";
  return "bg-danger-500/70";
}

export default function CorretorCall() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { progress, goals } = useCorretorProgress();
  const { isGestor, isAdmin } = useUserRole();
  const [phase, setPhase] = useState<CallPhase>("warmup");
  const [nome, setNome] = useState("");
  const [activeTab, setActiveTab] = useState("call");

  // Check meta exists
  const metaSalva = !!goals;

  useEffect(() => {
    if (!metaSalva) {
      toast.warning("Defina sua meta do dia antes de iniciar o Call!");
      navigate("/corretor", { replace: true });
    }
  }, [metaSalva, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
    });
  }, [user]);

  // Ranking & leads data for warmup screen
  const { data: warmupData } = useQuery({
    queryKey: ["call-warmup", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      // Ranking
      const { data: rankingData } = await supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id, pontos")
        .gte("created_at", today + "T00:00:00");

      const points: Record<string, number> = {};
      const names: Record<string, string> = {};
      rankingData?.forEach(r => {
        points[r.corretor_id] = (points[r.corretor_id] || 0) + (r.pontos || 0);
      });

      const sorted = Object.entries(points).sort((a, b) => b[1] - a[1]);
      const myPos = sorted.findIndex(([id]) => id === user!.id) + 1;
      const myPts = points[user!.id] || 0;
      const aboveId = myPos > 1 ? sorted[myPos - 2]?.[0] : null;
      const abovePts = aboveId ? points[aboveId] : 0;

      // Get name of person above
      let aboveName = "";
      if (aboveId) {
        const { data: profile } = await (supabase.from("profiles").select("nome") as any).eq("user_id", aboveId).single();
        aboveName = profile?.nome?.split(" ")[0] || "Líder";
      }

      // Available leads count
      const now = new Date().toISOString();
      const { count: availableLeads } = await supabase
        .from("oferta_ativa_leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "na_fila");

      return {
        rankingPos: myPos || sorted.length + 1,
        totalBrokers: sorted.length || 1,
        myPts,
        aboveName,
        abovePts,
        ptsToNext: Math.max(0, abovePts - myPts),
        availableLeads: availableLeads || 0,
        estimatedMinutes: Math.round((availableLeads || 0) * 2), // ~2min per lead
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const w = warmupData || { rankingPos: 0, totalBrokers: 1, myPts: 0, aboveName: "", abovePts: 0, ptsToNext: 0, availableLeads: 0, estimatedMinutes: 0 };

  const ligPct = Math.min(100, Math.round((progress.tentativas / progress.metaLigacoes) * 100));
  const aprvPct = Math.min(100, Math.round((progress.aproveitados / progress.metaAproveitados) * 100));

  if (!metaSalva) return null;

  // ── WARMUP SCREEN ──
  if (phase === "warmup") {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6"
        >
          {/* Back button */}
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => navigate("/corretor")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar à Central
          </Button>

          {/* Mission card */}
          <Card className="border-primary/20 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-primary to-primary/60" />
            <CardContent className="p-6 space-y-5">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-bold text-foreground">Sua missão de hoje</h1>
                </div>
                <p className="text-base text-muted-foreground">
                  <span className="font-bold text-foreground">{progress.metaLigacoes}</span> ligações · <span className="font-bold text-foreground">{progress.metaAproveitados}</span> aproveitados
                </p>
              </div>

              {/* Progress so far (if already started) */}
              {progress.tentativas > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-muted/50 border border-border">
                  <p className="text-xs font-medium text-muted-foreground text-center">Progresso até agora</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">🔥 Tentativas</span>
                        <span className="font-bold text-foreground">{progress.tentativas}/{progress.metaLigacoes}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div animate={{ width: `${ligPct}%` }} className={`h-full rounded-full ${getProgressColor(ligPct)}`} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">✅ Aproveitados</span>
                        <span className="font-bold text-foreground">{progress.aproveitados}/{progress.metaAproveitados}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div animate={{ width: `${aprvPct}%` }} className={`h-full rounded-full ${getProgressColor(aprvPct)}`} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ranking info */}
              {w.rankingPos > 0 && (
                <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 space-y-1">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-warning" />
                    <span className="text-sm font-semibold text-foreground">
                      Você está em <span className="text-primary">#{w.rankingPos}</span> no ranking
                    </span>
                  </div>
                  {w.ptsToNext > 0 && w.aboveName && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {w.aboveName} tem {w.abovePts}pts. Você tem {w.myPts}pts. <span className="font-bold text-warning-700">{w.ptsToNext} pontos para ultrapassá-lo.</span>
                    </p>
                  )}
                  {w.ptsToNext === 0 && w.rankingPos === 1 && (
                    <p className="text-xs text-success pl-6 font-medium">🏆 Você lidera o ranking!</p>
                  )}
                </div>
              )}

              {/* Available leads */}
              <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Leads disponíveis: <span className="font-bold text-foreground">{w.availableLeads}</span>
                </span>
                {w.estimatedMinutes > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> ~{w.estimatedMinutes > 60 ? `${Math.round(w.estimatedMinutes / 60)}h${(w.estimatedMinutes % 60).toString().padStart(2, "0")}` : `${w.estimatedMinutes}min`}
                  </span>
                )}
              </div>

              {/* CTA */}
              <Button
                size="lg"
                className="w-full h-14 text-lg font-bold gap-2 bg-primary hover:bg-primary-600 rounded-xl"
                onClick={() => setPhase("session")}
              >
                <Flame className="h-5 w-5" /> COMEÇAR AGORA
              </Button>

              <button
                className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center"
                onClick={() => setPhase("session")}
              >
                Escolher leads manualmente →
              </button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── SESSION SCREEN ──
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] max-w-full">
      {/* Progress bar (always visible at top) */}
      <div className="shrink-0 px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1">🔥 <strong className="text-foreground">{progress.tentativas}/{progress.metaLigacoes}</strong></span>
            <span className="flex items-center gap-1">✅ <strong className="text-foreground">{progress.aproveitados}/{progress.metaAproveitados}</strong></span>
            <span className="flex items-center gap-1">📅 <strong className="text-foreground">{progress.visitasMarcadas}/{progress.metaVisitas}</strong></span>
            <span className="flex items-center gap-1">⭐ <strong className="text-primary">{progress.pontos}pts</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => navigate("/corretor")}>
              <ArrowLeft className="h-3 w-3" /> Central
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              animate={{ width: `${ligPct}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full rounded-full ${getProgressColor(ligPct)}`}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{ligPct}% da meta</p>
        </div>
      </div>

      {/* Session content with tabs */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 h-auto mb-4">
              <TabsTrigger value="call" className="gap-1 text-xs py-2">
                <Phone className="h-3.5 w-3.5" /> Call
              </TabsTrigger>
              <TabsTrigger value="aproveitados" className="gap-1 text-xs py-2">
                <CheckCircle className="h-3.5 w-3.5" /> Aproveitados
              </TabsTrigger>
              <TabsTrigger value="ranking" className="gap-1 text-xs py-2">
                <Trophy className="h-3.5 w-3.5" /> Ranking
              </TabsTrigger>
            </TabsList>

            <TabsContent value="call" className="mt-0">
              <CorretorListSelection />
            </TabsContent>
            <TabsContent value="aproveitados" className="mt-0">
              <AproveitadosPanel />
            </TabsContent>
            <TabsContent value="ranking" className="mt-0">
              <RankingPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
