import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Star, Trophy } from "lucide-react";
import { useAcademia } from "@/hooks/useAcademia";
import { gradientOf, iconOf } from "./trilhaVisual";
import { cn } from "@/lib/utils";

export function MeuProgressoTab() {
  const { trilhas, aulas, totalXp, studyLevel, getTrilhaProgress, completedAulasCount, certificados } = useAcademia();
  const overall = aulas.length ? Math.round((completedAulasCount / aulas.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="text-lg">{studyLevel.emoji}</span> Nível {studyLevel.label}
        </div>
        <div className="flex items-center gap-3">
          <Progress value={overall} className="flex-1 h-3" />
          <span className="text-sm font-bold text-primary">{overall}%</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-blue-500" /><b className="text-foreground">{completedAulasCount}/{aulas.length}</b> aulas</span>
          <span className="flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-500" /><b className="text-foreground">{totalXp}</b> XP</span>
          <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-purple-500" /><b className="text-foreground">{certificados.length}</b> certificados</span>
        </div>
      </div>

      <div className="space-y-2">
        {trilhas.map((t) => {
          const p = getTrilhaProgress(t.id);
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className={cn("h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br flex items-center justify-center text-lg", gradientOf(t.categoria))}>
                {iconOf(t.categoria)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{t.titulo}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Progress value={p.percent} className="h-1.5 flex-1" />
                  <span className="text-[11px] text-muted-foreground w-9 text-right">{p.percent}%</span>
                </div>
              </div>
              {p.percent === 100 && <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Concluída</Badge>}
            </div>
          );
        })}
        {trilhas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma trilha disponível ainda.</p>}
      </div>
    </div>
  );
}
