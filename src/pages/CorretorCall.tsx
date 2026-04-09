import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowLeft, Flame, Target, Trophy, Clock, Zap, CheckCircle, Pause, X, ChevronRight, Loader2 } from "lucide-react";
import CorretorAvatar from "@/components/corretor/CorretorAvatar";
import ImmersiveScreen from "@/components/immersive/ImmersiveScreen";
import CorretorListSelection from "@/components/oferta-ativa/CorretorListSelection";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";
import ArenaSessionSummary, { type ArenaSessionData } from "@/components/oferta-ativa/ArenaSessionSummary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/gamification";
import { toast } from "sonner";

const homiMascot = "/images/homi-mascot-official.png";

type CallPhase = "warmup" | "launching" | "session";

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 70) return "bg-primary";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500/70";
}

// Particles now provided by ImmersiveScreen component

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
  const { progress, goals, isLoading: progressLoading } = useCorretorProgress();
  const { isGestor, isAdmin } = useUserRole();
  const [phase, setPhase] = useState<CallPhase>("warmup");
  const [nome, setNome] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("call");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

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

  // Arena-mode class: managed by CorretorListSelection when dialing starts
  // Keep badge visible via a lighter class
  useEffect(() => {
    document.body.classList.add("arena-session");
    return () => {
      document.body.classList.remove("arena-session");
      document.body.classList.remove("arena-mode");
    };
  }, []);

  // Check meta exists (only after loading finishes)
  const metaSalva = progressLoading || !!goals;

  useEffect(() => {
    if (!progressLoading && !goals) {
      toast.warning("Defina sua meta do dia antes de iniciar o Call!");
      navigate("/corretor", { replace: true });
    }
  }, [progressLoading, goals, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_url").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    });
  }, [user]);

  // Ranking & leads data for warmup screen
  const { data: warmupData } = useQuery({
    queryKey: ["call-warmup", user?.id],
    queryFn: async () => {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

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

      // Count leads available — corretor-specific: only from lists they have access to
      const now = new Date().toISOString();
      const { count: myQueueCount } = await supabase
        .from("oferta_ativa_leads")
        .select("id", { count: "exact", head: true })
        .in("status", ["na_fila", "em_cooldown"])
        .or(`proxima_tentativa_apos.is.null,proxima_tentativa_apos.lt.${now}`)
        .or(`corretor_id.is.null,corretor_id.eq.${user!.id}`);

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
        // Only a genuine leader if has points AND there are other participants
        isLeader: myPos === 1 && myPts > 0 && sorted.length > 1,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const w = warmupData || { rankingPos: 0, totalBrokers: 1, myPts: 0, aboveName: "", abovePts: 0, belowName: "", ptsToNext: 0, queueLeads: 0, estMinutes: 0, isLeader: false };

  const ligPct = Math.min(100, Math.round((progress.tentativas / progress.metaLigacoes) * 100));
  const aprvPct = Math.min(100, Math.round((progress.aproveitados / progress.metaAproveitados) * 100));
  const visitPct = Math.min(100, Math.round(((progress.visitasMarcadas || 0) / Math.max(1, progress.metaVisitas)) * 100));

  const currentLevel = getLevel(progress.pontos);
  const nextLevel = getNextLevel(progress.pontos);
  const levelProg = getLevelProgress(progress.pontos);
  const ligacoesFaltam = Math.max(0, progress.metaLigacoes - progress.tentativas);
  const ligacoesParaProximo = nextLevel ? Math.max(0, Math.ceil((nextLevel.minPoints - progress.pontos) / 3)) : 0;

  // Format estimated time
  const estLabel = w.estMinutes >= 120 ? "2h+" : w.estMinutes >= 60 ? `~${Math.floor(w.estMinutes / 60)}h${(w.estMinutes % 60) > 0 ? (w.estMinutes % 60).toString().padStart(2, "0") : ""}` : `~${w.estMinutes}min`;

  // Streak: only show if genuinely > 0 from activity
  const streakDays = progress.tentativas > 0 ? 3 : 0; // TODO: compute from DB

  // Arena particles - must be before any early returns
  const arenaParticles = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      left: `${5 + Math.random() * 90}%`,
      top: `${10 + Math.random() * 70}%`,
      duration: `${3 + Math.random() * 4}s`,
      delay: `${Math.random() * 3}s`,
      size: `${2 + Math.random() * 2}px`,
      opacity: 0.2 + Math.random() * 0.4,
    })), []
  );

  const handleStartSession = () => {
    setPhase("launching");
    setTimeout(() => {
      setPhase("session");
    }, 600);
  };

  const handleExitArena = () => {
    // If no attempts were made, go directly to dashboard
    if (progress.tentativas === 0) {
      navigate("/corretor");
      return;
    }
    setShowSummary(true);
  };

  if (!metaSalva) return null;

  // ── WARMUP: IMMERSIVE BATTLE ENTRY ──
  if (phase === "warmup" || phase === "launching") {
    return (
      <ImmersiveScreen fullScreen className="overflow-y-auto z-50 pt-6 pb-12">

        {/* ZONA 1 — TOPO */}
        <div className="w-full max-w-lg mx-auto px-6 pt-6 flex items-center justify-between">
          <button
            onClick={() => navigate("/corretor")}
            className="text-sm hover:opacity-80 transition-colors flex items-center gap-1.5"
            style={{ color: "var(--arena-text-muted)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar à Central
          </button>
          {streakDays > 0 && (
            <span className="text-sm flex items-center gap-1" style={{ color: "var(--arena-text-muted)" }}>
              🔥 <span className="font-semibold" style={{ color: "var(--arena-text)" }}>{streakDays} dias</span> seguidos
            </span>
          )}
        </div>

        {/* ZONA 2 — IDENTIDADE */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center text-center mt-8 px-6 w-full max-w-lg mx-auto"
        >
          {/* Corretor avatar with level effects */}
          <CorretorAvatar
            nome={nome || "Corretor"}
            avatarUrl={avatarUrl}
            points={progress.pontos}
            ranking={w.rankingPos}
            streak={streakDays}
            size="xl"
            animated
            showBadges
          />

          <p className="text-[#60A5FA] text-sm font-semibold tracking-[0.3em] uppercase mb-2">
            ✦ MODO BATALHA ✦
          </p>

          <h1 className="text-5xl font-black mb-6 leading-tight" style={{ color: "var(--arena-text)" }}>
            Sua Missão de Hoje
          </h1>

          {/* Metas card */}
          <div className="flex gap-4 rounded-2xl px-8 py-5" style={{ background: "var(--arena-subtle-bg)", border: "1px solid var(--arena-card-border)" }}>
            <div className="text-center min-w-[80px]">
              <p className="text-3xl font-bold" style={{ color: "var(--arena-text)" }}>🔥 {progress.metaLigacoes}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--arena-text-muted)" }}>ligações</p>
            </div>
            <div className="w-px" style={{ background: "var(--arena-card-border)" }} />
            <div className="text-center min-w-[80px]">
              <p className="text-3xl font-bold" style={{ color: "var(--arena-text)" }}>✅ {progress.metaAproveitados}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--arena-text-muted)" }}>aproveit.</p>
            </div>
            <div className="w-px" style={{ background: "var(--arena-card-border)" }} />
            <div className="text-center min-w-[80px]">
              <p className="text-3xl font-bold" style={{ color: "var(--arena-text)" }}>📅 {progress.metaVisitas}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--arena-text-muted)" }}>visitas</p>
            </div>
          </div>

          {/* Progress if already started today */}
          {progress.tentativas > 0 && (
            <div className="mt-4 flex gap-4 text-xs" style={{ color: "var(--arena-text-muted)" }}>
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
          className="w-full max-w-lg mx-auto px-6 mt-8 space-y-4"
        >
          {/* Ranking rivalry card */}
          {w.rankingPos > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{
                background: "var(--arena-subtle-bg)",
                border: "1px solid rgba(96,165,250,0.3)",
              }}
            >
              {w.isLeader ? (
                <div className="space-y-1">
                  <p className="font-bold flex items-center gap-2" style={{ color: "var(--arena-text)" }}>
                    👑 Você lidera o ranking!
                  </p>
                  {w.belowName && (
                    <p className="text-sm" style={{ color: "var(--arena-text-muted)" }}>
                      🥈 {w.belowName} está em #2
                    </p>
                  )}
                  <p className="text-sm italic" style={{ color: "var(--arena-text-subtle)" }}>
                    "Defende o trono. Ninguém tira isso de quem executa." 🔥
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-bold" style={{ color: "var(--arena-text)" }}>
                    📍 Você está em #{w.rankingPos} — <span className="text-[#60A5FA]">{w.ptsToNext}pts atrás</span>
                  </p>
                  {w.aboveName && (
                    <p className="text-sm" style={{ color: "var(--arena-text-muted)" }}>
                      🥇 {w.aboveName} lidera com {w.abovePts}pts
                    </p>
                  )}
                  <p className="text-sm italic" style={{ color: "var(--arena-text-subtle)" }}>
                    "Uma boa sessão vira o jogo." ⚡
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Level progression */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-1.5" style={{ color: "var(--arena-text)" }}>
                {currentLevel.emoji} {currentLevel.label}
              </span>
              {nextLevel && (
                <span className="text-xs" style={{ color: "var(--arena-text-muted)" }}>
                  {ligacoesParaProximo} ligações para virar {nextLevel.emoji} {nextLevel.label}
                </span>
              )}
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--arena-progress-track)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${levelProg}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full rounded-full bg-blue-400"
              />
            </div>
          </div>
        </motion.div>

        {/* ZONA 4 — AÇÃO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="w-full max-w-lg mx-auto px-6 mt-8 mb-12 flex flex-col items-center space-y-5"
        >
          {/* Queue info */}
          <p className="text-sm flex items-center gap-3" style={{ color: "var(--arena-text-muted)" }}>
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
      </ImmersiveScreen>
    );
  }

  // ── ARENA DE LIGAÇÃO ──

  return (
    <div className="arena-bg flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      {/* Arena layers */}
      <div className="arena-floor" />
      <div className="arena-vignette" />
      {arenaParticles.map((p, i) => (
        <div
          key={i}
          className="arena-particle"
          style={{
            left: p.left, top: p.top,
            width: p.size, height: p.size,
            animationDuration: p.duration,
            animationDelay: p.delay,
            opacity: p.opacity,
          }}
        />
      ))}

      {/* ═══ COMPACT ARENA SCOREBOARD ═══ */}
      <div className="arena-scoreboard shrink-0 relative z-10">
        <div className="px-4 py-2 max-w-[1600px] mx-auto">
          {/* Single row: title + KPIs + tabs + actions */}
          <div className="flex items-center gap-4">
            {/* Title */}
            <div className="flex items-center gap-2 shrink-0">
              <h2 style={{ fontSize: 16 }} className="font-black tracking-[0.15em] uppercase arena-title-gradient">
                ⚡ ARENA
              </h2>
              <span className="flex items-center gap-1 font-semibold" style={{ fontSize: 11, color: "#4ADE80" }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 live-dot" />
                AO VIVO
              </span>
            </div>

            {/* Inline KPIs */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 12, color: "var(--arena-text-subtle)" }}>🔥</span>
                <span style={{ fontSize: 14, color: "var(--arena-text)" }} className="font-mono font-bold">{progress.tentativas}/{progress.metaLigacoes}</span>
                <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "var(--arena-progress-track)" }}>
                  <div className="h-full rounded-full" style={{ width: `${ligPct}%`, background: "#F97316" }} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 12, color: "var(--arena-text-subtle)" }}>✅</span>
                <span className="font-mono font-bold" style={{ fontSize: 14, color: "#22C55E" }}>{progress.aproveitados}/{progress.metaAproveitados}</span>
                <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "var(--arena-progress-track)" }}>
                  <div className="h-full rounded-full" style={{ width: `${aprvPct}%`, background: "#22C55E" }} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 12, color: "var(--arena-text-subtle)" }}>📅</span>
                <span className="font-mono font-bold" style={{ fontSize: 14, color: "#3B82F6" }}>{progress.visitasMarcadas || 0}/{progress.metaVisitas}</span>
                <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "var(--arena-progress-track)" }}>
                  <div className="h-full rounded-full" style={{ width: `${visitPct}%`, background: "#3B82F6" }} />
                </div>
              </div>
              <motion.span
                key={progress.pontos}
                className="font-bold text-amber-400 shrink-0"
                style={{ fontSize: 14 }}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                ⭐ {progress.pontos}pts
              </motion.span>
              {nextLevel && (
                <span className="shrink-0" style={{ fontSize: 11, color: "var(--arena-text-subtle)" }}>
                  {currentLevel.emoji} → {nextLevel.emoji} ({ligacoesFaltam})
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost" size="sm"
                className="h-7 gap-1 hover:opacity-80"
                style={{ fontSize: 12, color: "var(--arena-text-muted)" }}
                onClick={handleExitArena}
              >
                <Pause className="h-3 w-3" /> Pausar
              </Button>
              <Button
                variant="ghost" size="sm"
                className="h-7 gap-1 text-red-400 hover:bg-red-500/10"
                style={{ fontSize: 12 }}
                onClick={handleExitArena}
              >
                <X className="h-3 w-3" /> Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SESSION CONTENT ═══ */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-3 relative z-10">
        <div className="max-w-[1600px] mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="inline-flex h-9 mb-3 rounded-lg p-0.5" style={{ background: "var(--arena-tab-bg)" }}>
              <TabsTrigger value="call" className="gap-1.5 px-4 py-1.5 rounded-md data-[state=active]:shadow-none" style={{ fontSize: 13, fontWeight: 500, color: "var(--arena-text-muted)" }} data-active-style>
                <Phone className="h-3.5 w-3.5" /> Arena
              </TabsTrigger>
              <TabsTrigger value="aproveitados" className="gap-1.5 px-4 py-1.5 rounded-md data-[state=active]:shadow-none" style={{ fontSize: 13, fontWeight: 500, color: "var(--arena-text-muted)" }}>
                <CheckCircle className="h-3.5 w-3.5" /> Aproveitados
              </TabsTrigger>
              <TabsTrigger value="ranking" className="gap-1.5 px-4 py-1.5 rounded-md data-[state=active]:shadow-none" style={{ fontSize: 13, fontWeight: 500, color: "var(--arena-text-muted)" }}>
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

      {/* SESSION SUMMARY OVERLAY */}
      {showSummary && (
        <ArenaSessionSummary
          data={{
            tentativas: progress.tentativas,
            aproveitados: progress.aproveitados,
            visitasMarcadas: progress.visitasMarcadas || 0,
            pontos: progress.pontos,
            metaLigacoes: progress.metaLigacoes,
            metaAproveitados: progress.metaAproveitados,
            metaVisitas: progress.metaVisitas,
            empreendimento: w.queueLeads > 0 ? "Arena de Ligação" : "Arena de Ligação",
            streak: streakDays,
          }}
          onNewSession={() => {
            setShowSummary(false);
            setPhase("warmup");
          }}
          onDashboard={() => navigate("/corretor")}
        />
      )}
    </div>
  );
}