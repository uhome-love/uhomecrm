import { useState, useMemo } from "react";
import { useAcademia, CATEGORIAS, NIVEL_CONFIG, type Trilha } from "@/hooks/useAcademia";
import { useNavigate } from "react-router-dom";
import { Loader2, BookOpen, Play, Clock, Star, Award, Plus, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function TrilhaCard({ trilha, progress, duration, onClick }: {
  trilha: Trilha;
  progress: { total: number; completed: number; percent: number; started: boolean };
  duration: number;
  onClick: () => void;
}) {
  const nivel = NIVEL_CONFIG[trilha.nivel || "iniciante"];
  const cat = CATEGORIAS.find(c => c.key === trilha.categoria);

  return (
    <button onClick={onClick} className="group text-left rounded-xl border border-border/60 bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200">
      {/* Thumbnail */}
      <div className="relative h-36 bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
        {trilha.thumbnail_url ? (
          <img src={trilha.thumbnail_url} alt={trilha.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Badges on thumbnail */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {cat && <Badge className={cn("text-[9px] px-1.5 py-0 h-4 border", cat.color)}>{cat.label.split(" ")[0]}</Badge>}
          {nivel && <Badge className={cn("text-[9px] px-1.5 py-0 h-4 border", nivel.color)}>{nivel.label}</Badge>}
        </div>
        {progress.percent === 100 && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 h-4 border-0">✅ Concluída</Badge>
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="h-10 w-10 rounded-full bg-primary/90 flex items-center justify-center shadow-xl">
            <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-tight">{trilha.titulo}</h3>
        {trilha.descricao && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{trilha.descricao}</p>
        )}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><BookOpen className="h-3 w-3" />{progress.total} aulas</span>
          {duration > 0 && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{duration}min</span>}
          {trilha.xp_total ? <span className="flex items-center gap-0.5"><Star className="h-3 w-3" />{trilha.xp_total} XP</span> : null}
        </div>
        {/* Progress bar */}
        {progress.started && (
          <div className="space-y-1">
            <Progress value={progress.percent} className="h-1.5" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{progress.completed}/{progress.total} aulas</span>
              <span className="text-[10px] font-bold text-primary">{progress.percent}%</span>
            </div>
          </div>
        )}
        <Button size="sm" className="w-full h-8 text-xs gap-1.5 mt-1" variant={progress.started ? "default" : "outline"}>
          <Play className="h-3 w-3" />
          {progress.percent === 100 ? "Revisar" : progress.started ? "Continuar" : "Começar"}
        </Button>
      </div>
    </button>
  );
}

export default function AcademiaPage() {
  const navigate = useNavigate();
  const {
    trilhas, totalXp, studyLevel, getTrilhaProgress, getTrilhaDuration,
    certificados, completedTrilhasCount, completedAulasCount, canManage, loading,
  } = useAcademia();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return trilhas;
    return trilhas.filter(t => t.categoria === categoryFilter);
  }, [trilhas, categoryFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando Academia...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            🎓 Academia Uhome
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Trilhas de conhecimento e desenvolvimento do time</p>
        </div>
        {canManage && (
          <Button onClick={() => navigate("/academia/gerenciar")} className="gap-1.5">
            <Plus className="h-4 w-4" /> Gerenciar
          </Button>
        )}
      </div>

      {/* PROGRESS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl mb-1">{studyLevel.emoji}</div>
          <p className="text-lg font-black text-foreground">{totalXp}</p>
          <p className="text-[10px] text-muted-foreground">XP Total</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl mb-1">✅</div>
          <p className="text-lg font-black text-foreground">{completedTrilhasCount}</p>
          <p className="text-[10px] text-muted-foreground">Trilhas concluídas</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl mb-1">📚</div>
          <p className="text-lg font-black text-foreground">{completedAulasCount}</p>
          <p className="text-[10px] text-muted-foreground">Aulas assistidas</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl mb-1">🏅</div>
          <p className="text-lg font-black text-foreground">{certificados.length}</p>
          <p className="text-[10px] text-muted-foreground">Certificados</p>
        </div>
      </div>

      {/* CATEGORY FILTERS */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setCategoryFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
            categoryFilter === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-muted/60 text-muted-foreground border-transparent hover:bg-muted"
          )}
        >
          Todas
        </button>
        {CATEGORIAS.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategoryFilter(categoryFilter === cat.key ? "all" : cat.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
              categoryFilter === cat.key
                ? cat.color + " shadow-sm"
                : "bg-muted/60 text-muted-foreground border-transparent hover:bg-muted"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* TRILHAS GRID */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(t => (
            <TrilhaCard
              key={t.id}
              trilha={t}
              progress={getTrilhaProgress(t.id)}
              duration={getTrilhaDuration(t.id)}
              onClick={() => navigate(`/academia/trilha/${t.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-foreground font-bold text-lg mb-1">Nenhuma trilha disponível</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            {categoryFilter !== "all" ? "Nenhuma trilha nesta categoria." : "Em breve, novas trilhas estarão disponíveis."}
          </p>
        </div>
      )}
    </div>
  );
}
