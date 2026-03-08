import { useState, useMemo } from "react";
import { useAcademia, CATEGORIAS, type Trilha } from "@/hooks/useAcademia";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, BookOpen, Play, Clock, Star, Award, Plus, GraduationCap, ArrowRight, Lock, Trophy, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Gradient map for trilha categories ──
const TRILHA_GRADIENTS: Record<string, string> = {
  treinamento_sistema: "from-[#1e3a5f] to-[#0e7490]",
  empreendimentos: "from-emerald-700 to-emerald-500",
  tecnicas_vendas: "from-amber-700 to-orange-500",
  objecoes_scripts: "from-purple-700 to-pink-500",
  processos: "from-slate-700 to-blue-500",
};
const TRILHA_ICONS: Record<string, string> = {
  treinamento_sistema: "🖥️",
  empreendimentos: "🏠",
  tecnicas_vendas: "📞",
  objecoes_scripts: "🎯",
  processos: "⚙️",
};

// ── "Coming soon" placeholder trilhas ──
const COMING_SOON = [
  { titulo: "Empreendimentos Uhome", icon: "🏠", gradient: "from-emerald-700 to-emerald-500" },
  { titulo: "Técnicas de Vendas", icon: "📞", gradient: "from-amber-700 to-orange-500" },
  { titulo: "Objeções e Scripts", icon: "🎯", gradient: "from-purple-700 to-pink-500" },
];

function TrilhaCard({ trilha, progress, duration, onClick }: {
  trilha: Trilha;
  progress: { total: number; completed: number; percent: number; started: boolean };
  duration: number;
  onClick: () => void;
}) {
  const gradient = TRILHA_GRADIENTS[trilha.categoria || ""] || "from-slate-600 to-slate-800";
  const icon = TRILHA_ICONS[trilha.categoria || ""] || "📚";

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "group relative text-left rounded-xl overflow-hidden h-52 w-full",
        "shadow-lg hover:shadow-xl transition-shadow duration-300",
        "border border-white/10 hover:border-white/30"
      )}
    >
      {/* Gradient bg */}
      <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-5">
        <div>
          <span className="text-5xl drop-shadow-lg">{icon}</span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white leading-tight">{trilha.titulo}</h3>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <span>{progress.total} aulas</span>
            {trilha.xp_total ? <span>⭐ {trilha.xp_total} XP</span> : null}
          </div>
          {/* Progress bar */}
          {progress.started && (
            <div className="space-y-1">
              <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-xs text-white/80 font-medium">{progress.percent}%</span>
            </div>
          )}
          {progress.percent === 100 && (
            <Badge className="bg-emerald-500/80 text-white border-0 text-[10px]">✅ Concluída</Badge>
          )}
        </div>
      </div>

      {/* Hover play overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
        <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <Play className="h-5 w-5 text-white ml-0.5" />
        </div>
      </div>
    </motion.button>
  );
}

function ComingSoonCard({ titulo, icon, gradient }: { titulo: string; icon: string; gradient: string }) {
  return (
    <div className={cn(
      "relative rounded-xl overflow-hidden h-52 w-full opacity-60 cursor-not-allowed",
      "border border-white/5"
    )}>
      <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative h-full flex flex-col items-center justify-center p-5 text-center gap-3">
        <span className="text-5xl opacity-50">{icon}</span>
        <h3 className="text-base font-bold text-white/70">{titulo}</h3>
        <Badge className="bg-white/10 text-white/60 border-white/10 gap-1 text-xs">
          <Lock className="h-3 w-3" /> Em breve
        </Badge>
      </div>
    </div>
  );
}

export default function AcademiaPage() {
  const navigate = useNavigate();
  const {
    trilhas, aulas, totalXp, studyLevel, getTrilhaProgress, getTrilhaDuration,
    certificados, completedTrilhasCount, completedAulasCount, canManage, loading,
    progresso, getAulaStatus,
  } = useAcademia();

  // Find "continue where you left off" — first incomplete aula across all trilhas
  const continueData = useMemo(() => {
    for (const trilha of trilhas) {
      const trilhaAulas = aulas.filter(a => a.trilha_id === trilha.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      const progress = getTrilhaProgress(trilha.id);
      if (progress.started && progress.percent < 100) {
        const nextAula = trilhaAulas.find(a => getAulaStatus(a.id) !== "concluida");
        if (nextAula) {
          return { trilha, aula: nextAula, progress };
        }
      }
    }
    return null;
  }, [trilhas, aulas, getTrilhaProgress, getAulaStatus]);

  // Compute overall progress
  const overallProgress = useMemo(() => {
    const totalAulas = aulas.length;
    if (totalAulas === 0) return 0;
    return Math.round((completedAulasCount / totalAulas) * 100);
  }, [aulas.length, completedAulasCount]);

  // Filter out "coming soon" trilhas that already exist in DB
  const existingCategories = new Set(trilhas.map(t => t.categoria));
  const comingSoonFiltered = COMING_SOON.filter(cs => {
    const catKey = cs.titulo.includes("Empreendimentos") ? "empreendimentos" :
                   cs.titulo.includes("Vendas") ? "tecnicas_vendas" :
                   cs.titulo.includes("Objeções") ? "objecoes_scripts" : "";
    return !existingCategories.has(catKey);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando Academia...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            🎓 Academia Uhome
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sua jornada de conhecimento</p>
        </div>
        {canManage && (
          <Button onClick={() => navigate("/academia/gerenciar")} variant="outline" className="gap-1.5">
            <Plus className="h-4 w-4" /> ⚙️ Gerenciar
          </Button>
        )}
      </div>

      {/* ── SEU PROGRESSO ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-5 border border-blue-500/20"
        style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(147,51,234,0.08))" }}
      >
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-500" /> SEU PROGRESSO
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <Progress value={overallProgress} className="flex-1 h-3" />
              <span className="text-sm font-bold text-primary">{overallProgress}%</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-foreground">{completedAulasCount}/{aulas.length}</span> aulas
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-foreground">{totalXp}</span> XP
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Trophy className="h-4 w-4 text-purple-500" />
                <span className="font-semibold text-foreground">{certificados.length}</span> Certificados
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-lg">{studyLevel.emoji}</span>
                <span className="font-semibold text-foreground">{studyLevel.label}</span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── CONTINUE DE ONDE PAROU ── */}
      {continueData && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl p-4 border-l-4 border-l-blue-500 border border-blue-500/10"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.04), rgba(6,182,212,0.04))" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">📌</span>
            <h3 className="text-sm font-bold text-foreground">Continue de onde parou</h3>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                🎯 {continueData.aula.titulo}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Trilha: {continueData.trilha.titulo}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${continueData.progress.percent}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">{continueData.progress.percent}%</span>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => navigate(`/academia/trilha/${continueData.trilha.id}`)}
            >
              Continuar <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── TRILHAS DISPONÍVEIS ── */}
      <div>
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          🗂️ Trilhas Disponíveis
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trilhas.map((t, i) => (
            <TrilhaCard
              key={t.id}
              trilha={t}
              progress={getTrilhaProgress(t.id)}
              duration={getTrilhaDuration(t.id)}
              onClick={() => navigate(`/academia/trilha/${t.id}`)}
            />
          ))}
          {/* Coming Soon placeholders */}
          {comingSoonFiltered.map((cs, i) => (
            <ComingSoonCard key={cs.titulo} {...cs} />
          ))}
        </div>

        {trilhas.length === 0 && comingSoonFiltered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-foreground font-bold text-lg mb-1">Nenhuma trilha disponível</h3>
            <p className="text-muted-foreground text-sm">Em breve, novas trilhas estarão disponíveis.</p>
          </div>
        )}
      </div>
    </div>
  );
}
