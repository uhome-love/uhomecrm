import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowLeft, Flame, Target, Trophy, Clock, Zap, CheckCircle, Pause, X, ChevronRight, Loader2 } from "lucide-react";
import CorretorListSelection from "@/components/oferta-ativa/CorretorListSelection";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSidebar } from "@/components/ui/sidebar";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/gamification";
import { toast } from "sonner";

const homiMascot = "/images/homi-mascot-opt.png";

type CallPhase = "warmup" | "launching" | "session";

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 70) return "bg-primary";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500/70";
}

// ── Floating particles (CSS-only) ──
function Particles() {
  const particles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 1 + Math.random() * 2,
      opacity: 0.15 + Math.random() * 0.35,
      duration: 8 + Math.random() * 7,
      delay: Math.random() * 10,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            bottom: "-10px",
            animation: `particle-rise ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes particle-rise {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-110vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Whoosh sound effect ──
function playWhoosh() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // silently fail if AudioContext not available
  }
}

export default function CorretorCall() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { progress, goals } = useCorretorProgress();
  const { isGestor, isAdmin } = useUserRole();
  const [phase, setPhase] = useState<CallPhase>("warmup");
  const [nome, setNome] = useState("");
  const [activeTab, setActiveTab] = useState("call");
  const { setOpen, open } = useSidebar();
  const [hasInteracted, setHasInteracted] = useState(false);
  const prevOpenRef = useRef(open);

  // Track user interaction for sound
  useEffect(() => {
    const handler = () => setHasInteracted(true);
    window.addEventListener("click", handler, { once: true });
    return () => window.removeEventListener("click", handler);
  }, []);

  // Play whoosh on mount if user already interacted
  useEffect(() => {
    if (hasInteracted) playWhoosh();
  }, [hasInteracted]);

  // Auto-collapse sidebar on mount, restore previous state on unmount
  useEffect(() => {
    prevOpenRef.current = open;
    setOpen(false);
    return () => { setOpen(prevOpenRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // Ranking data
      const { data: rankingData } = await supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id, pontos")
        .gte("created_at", today + "T00:00:00");

      const points: Record<string, number> = {};
      rankingData?.forEach(r => {
        points[r.corretor_id] = (points[r.corretor_id] || 0) + (r.pontos || 0);
      });

      const sorted = Object.entries(points).sort((a, b) => b[1] - a[1]);
      const myPos = sorted.findIndex(([id]) => id === user!.id) + 1;
      const myPts = points[user!.id] || 0;
      const aboveId = myPos > 1 ? sorted[myPos - 2]?.[0] : null;
      const belowId = myPos === 1 && sorted.length > 1 ? sorted[1]?.[0] : null;
      const abovePts = aboveId ? points[aboveId] : 0;

      let aboveName = "";
      if (aboveId) {
        const { data: profile } = await (supabase.from("profiles").select("nome") as any).eq("user_id", aboveId).single();
        aboveName = profile?.nome?.split(" ")[0] || "Líder";
      }
      let belowName = "";
      if (belowId) {
        const { data: profile } = await (supabase.from("profiles").select("nome") as any).eq("user_id", belowId).single();
        belowName = profile?.nome?.split(" ")[0] || "#2";
      }

      // Count leads available for this corretor specifically
      const now = new Date().toISOString();
      const { count: myQueueCount } = await supabase
        .from("oferta_ativa_leads")
        .select("id", { count: "exact", head: true })
        .in("status", ["na_fila", "em_cooldown"])
        .or(`proxima_tentativa_apos.is.null,proxima_tentativa_apos.lt.${now}`);

      const queueLeads = myQueueCount || 0;
      const estMinutes = Math.min(120, queueLeads * 2); // cap at 2h

      return {
        rankingPos: myPos || sorted.length + 1,
        totalBrokers: sorted.length || 1,
        myPts,
        aboveName,
        abovePts,
        belowName,
        ptsToNext: Math.max(0, abovePts - myPts),
        queueLeads,
        estMinutes,
        isLeader: myPos === 1 && sorted.length > 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const w = warmupData || { rankingPos: 0, totalBrokers: 1, myPts: 0, aboveName: "", abovePts: 0, belowName: "", ptsToNext: 0, queueLeads: 0, estMinutes: 0, isLeader: false };

  const ligPct = Math.min(100, Math.round((progress.tentativas / progress.metaLigacoes) * 100));
  const aprvPct = Math.min(100, Math.round((progress.aproveitados / progress.metaAproveitados) * 100));

  const currentLevel = getLevel(progress.pontos);
  const nextLevel = getNextLevel(progress.pontos);
  const levelProg = getLevelProgress(progress.pontos);
  const ligacoesFaltam = Math.max(0, progress.metaLigacoes - progress.tentativas);
  const ligacoesParaProximo = nextLevel ? Math.max(0, Math.ceil((nextLevel.minPoints - progress.pontos) / 3)) : 0;

  // Format estimated time
  const estLabel = w.estMinutes >= 120 ? "2h+" : w.estMinutes >= 60 ? `~${Math.floor(w.estMinutes / 60)}h${(w.estMinutes % 60) > 0 ? (w.estMinutes % 60).toString().padStart(2, "0") : ""}` : `~${w.estMinutes}min`;

  // Streak data placeholder (could come from DB)
  const streakDays = progress.tentativas > 0 ? 3 : 0;

  const handleStartSession = () => {
    setPhase("launching");
    setTimeout(() => {
      setPhase("session");
    }, 600);
  };

  if (!metaSalva) return null;

  // ── WARMUP: IMMERSIVE BATTLE ENTRY ──
  if (phase === "warmup" || phase === "launching") {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto"
        style={{
          background: "radial-gradient(ellipse at center, #0F1E3D 0%, #060D1F 60%, #020610 100%)",
        }}
      >
        <Particles />

        {/* ZONA 1 — TOPO */}
        <div className="relative z-10 w-full max-w-2xl px-6 pt-6 flex items-center justify-between">
          <button
            onClick={() => navigate("/corretor")}
            className="text-neutral-400 text-sm hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar à Central
          </button>
          {streakDays > 0 && (
            <span className="text-neutral-400 text-sm flex items-center gap-1">
              🔥 <span className="text-white font-semibold">{streakDays} dias</span> seguidos
            </span>
          )}
        </div>

        {/* ZONA 2 — IDENTIDADE */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center text-center mt-8 px-6"
        >
          {/* Homi avatar with pulse */}
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" style={{ animationDuration: "3s" }} />
            <img src={homiMascot} alt="Homi" className="h-14 w-14 object-contain relative z-10" />
          </div>

          <p className="text-[#60A5FA] text-sm font-semibold tracking-[0.3em] uppercase mb-2">
            ✦ MODO BATALHA ✦
          </p>

          <h1 className="text-5xl font-black text-white mb-6 leading-tight">
            Sua Missão de Hoje
          </h1>

          {/* Metas card */}
          <div className="flex gap-4 bg-white/[0.08] border border-white/[0.15] rounded-2xl px-8 py-5">
            <div className="text-center min-w-[80px]">
              <p className="text-3xl font-bold text-white">🔥 {progress.metaLigacoes}</p>
              <p className="text-xs text-neutral-400 mt-0.5">ligações</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center min-w-[80px]">
              <p className="text-3xl font-bold text-white">✅ {progress.metaAproveitados}</p>
              <p className="text-xs text-neutral-400 mt-0.5">aproveit.</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center min-w-[80px]">
              <p className="text-3xl font-bold text-white">📅 {progress.metaVisitas}</p>
              <p className="text-xs text-neutral-400 mt-0.5">visitas</p>
            </div>
          </div>

          {/* Progress if already started today */}
          {progress.tentativas > 0 && (
            <div className="mt-4 flex gap-4 text-xs text-neutral-400">
              <span>🔥 {progress.tentativas}/{progress.metaLigacoes} feitas</span>
              <span>✅ {progress.aproveitados}/{progress.metaAproveitados} aprov.</span>
              <span>⭐ {progress.pontos}pts</span>
            </div>
          )}
        </motion.div>

        {/* ZONA 3 — CONTEXTO RIVAL */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="relative z-10 w-full max-w-lg px-6 mt-8 space-y-4"
        >
          {/* Ranking rivalry card */}
          {w.rankingPos > 0 && (
            <div
              className="rounded-2xl p-4 bg-white/[0.05] border border-transparent"
              style={{
                borderImage: "linear-gradient(135deg, #60A5FA, #A78BFA) 1",
                borderImageSlice: 1,
              }}
            >
              {w.isLeader ? (
                <div className="space-y-1">
                  <p className="text-white font-bold flex items-center gap-2">
                    👑 Você lidera o ranking!
                  </p>
                  {w.belowName && (
                    <p className="text-neutral-300 text-sm">
                      🥈 {w.belowName} está em #2
                    </p>
                  )}
                  <p className="text-neutral-400 text-sm italic">
                    "Defende o trono. Ninguém tira isso de quem executa." 🔥
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-white font-bold">
                    📍 Você está em #{w.rankingPos} — <span className="text-[#60A5FA]">{w.ptsToNext}pts atrás</span>
                  </p>
                  {w.aboveName && (
                    <p className="text-neutral-300 text-sm">
                      🥇 {w.aboveName} lidera com {w.abovePts}pts
                    </p>
                  )}
                  <p className="text-neutral-400 text-sm italic">
                    "Uma boa sessão vira o jogo." ⚡
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Level progression */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white font-medium flex items-center gap-1.5">
                {currentLevel.emoji} {currentLevel.label}
              </span>
              {nextLevel && (
                <span className="text-neutral-400 text-xs">
                  {ligacoesParaProximo} ligações para virar {nextLevel.emoji} {nextLevel.label}
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-white/[0.12] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${levelProg}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full rounded-full bg-[#60A5FA]"
              />
            </div>
          </div>
        </motion.div>

        {/* ZONA 4 — AÇÃO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="relative z-10 w-full max-w-lg px-6 mt-8 mb-12 flex flex-col items-center space-y-5"
        >
          {/* Queue info */}
          <p className="text-sm text-neutral-400 flex items-center gap-3">
            <span className="flex items-center gap-1">📋 {w.queueLeads} leads na sua fila</span>
            <span>·</span>
            <span className="flex items-center gap-1">⏱ {estLabel} estimado</span>
          </p>

          {/* MAIN CTA */}
          <AnimatePresence mode="wait">
            {phase === "warmup" ? (
              <motion.button
                key="start"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleStartSession}
                className="w-full max-w-[480px] h-[72px] rounded-2xl text-xl font-black text-white uppercase tracking-wider flex items-center justify-center gap-3 cursor-pointer border-0 outline-none"
                style={{
                  background: "linear-gradient(135deg, #16A34A, #15803D)",
                  boxShadow: "0 0 60px rgba(22,163,74,0.6), 0 0 120px rgba(22,163,74,0.2)",
                  animation: "pulse-glow 2s ease-in-out infinite",
                }}
              >
                <Flame className="h-6 w-6" /> COMEÇAR AGORA
              </motion.button>
            ) : (
              <motion.div
                key="launching"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-[480px] h-[72px] rounded-2xl text-lg font-bold text-white uppercase tracking-wider flex flex-col items-center justify-center gap-1"
                style={{
                  background: "linear-gradient(135deg, #16A34A, #15803D)",
                  boxShadow: "0 0 60px rgba(22,163,74,0.6)",
                }}
              >
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Preparando sessão...
                </span>
                <div className="w-3/4 h-1 rounded-full bg-white/30 overflow-hidden mt-1">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-white rounded-full"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Secondary links */}
          <div className="flex flex-col items-center gap-2 text-sm">
            <button
              onClick={handleStartSession}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              Escolher leads manualmente →
            </button>
            <button
              onClick={() => navigate("/corretor")}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              ← Voltar à Central
            </button>
          </div>
        </motion.div>

        {/* Pulse glow animation */}
        <style>{`
          @keyframes pulse-glow {
            0% { box-shadow: 0 0 40px rgba(22,163,74,0.4), 0 0 80px rgba(22,163,74,0.1); }
            50% { box-shadow: 0 0 80px rgba(22,163,74,0.8), 0 0 140px rgba(22,163,74,0.3); }
            100% { box-shadow: 0 0 40px rgba(22,163,74,0.4), 0 0 80px rgba(22,163,74,0.1); }
          }
        `}</style>
      </div>
    );
  }

  // ── IMMERSIVE SESSION SCREEN ──
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] max-w-full">
      {/* ═══ TOP SESSION BAR ═══ */}
      <div className="shrink-0 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="px-4 py-2.5 max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-red-500" />
                <span className="text-sm font-bold text-foreground">Sessão em andamento</span>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                <span>🔥 <strong className="text-foreground">{progress.tentativas}</strong>/{progress.metaLigacoes} ligações</span>
                <span>✅ <strong className="text-emerald-600">{progress.aproveitados}</strong>/{progress.metaAproveitados} aprov.</span>
                <span>⭐ <strong className="text-primary">{progress.pontos}pts</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/corretor")}
              >
                <Pause className="h-3 w-3" /> Pausar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
                onClick={() => navigate("/corretor")}
              >
                <X className="h-3 w-3" /> Encerrar
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  animate={{ width: `${ligPct}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full rounded-full ${getProgressColor(ligPct)}`}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-medium shrink-0 tabular-nums">{ligPct}% da meta</span>
          </div>

          {nextLevel && ligacoesFaltam > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[10px] font-semibold ${currentLevel.color}`}>{currentLevel.emoji} {currentLevel.label}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className={`text-[10px] font-semibold ${nextLevel.color}`}>{nextLevel.emoji} {nextLevel.label}</span>
              <span className="text-[10px] text-muted-foreground">: faltam {ligacoesFaltam} ligações</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ SESSION CONTENT ═══ */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-4">
        <div className="max-w-[1600px] mx-auto">
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
