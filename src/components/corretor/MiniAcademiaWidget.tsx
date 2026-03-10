import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Play, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MiniAcademiaWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["mini-academia", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get all published trilhas
      const { data: trilhas } = await supabase
        .from("academia_trilhas")
        .select("id, titulo")
        .eq("publicada", true)
        .order("ordem");

      if (!trilhas?.length) return { pending: [], totalDone: 0, totalAulas: 0 };

      // Get all aulas
      const { data: aulas } = await supabase
        .from("academia_aulas")
        .select("id, titulo, trilha_id, ordem, tipo, duracao_minutos")
        .in("trilha_id", trilhas.map(t => t.id))
        .order("ordem");

      // Get user progress
      const { data: progresso } = await supabase
        .from("academia_progresso")
        .select("aula_id, status")
        .eq("corretor_id", user!.id);

      const doneSet = new Set(
        progresso?.filter(p => p.status === "concluida").map(p => p.aula_id) || []
      );

      const trilhaMap = Object.fromEntries(trilhas.map(t => [t.id, t.titulo]));

      const pending = (aulas || [])
        .filter(a => !doneSet.has(a.id))
        .slice(0, 3)
        .map(a => ({
          id: a.id,
          titulo: a.titulo,
          trilha: trilhaMap[a.trilha_id || ""] || "",
          tipo: a.tipo,
          duracao: a.duracao_minutos || 5,
          trilha_id: a.trilha_id,
        }));

      return {
        pending,
        totalDone: doneSet.size,
        totalAulas: aulas?.length || 0,
      };
    },
  });

  const { pending = [], totalDone = 0, totalAulas = 0 } = data || {};
  const pct = totalAulas > 0 ? Math.round((totalDone / totalAulas) * 100) : 0;

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Academia Uhome</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => navigate("/academia")}>
            Ver tudo
          </Button>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Progresso geral</span>
            <span className="text-xs font-bold text-foreground">{totalDone}/{totalAulas} aulas · {pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Pending lessons */}
        {pending.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Próximas aulas:</p>
            {pending.map((aula) => (
              <button
                key={aula.id}
                onClick={() => navigate(`/academia/trilha/${aula.trilha_id}`)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Play className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{aula.titulo}</p>
                  <p className="text-[10px] text-muted-foreground">{aula.trilha} · {aula.duracao}min</p>
                </div>
              </button>
            ))}
          </div>
        ) : totalAulas > 0 ? (
          <div className="flex flex-col items-center gap-1 py-3">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <p className="text-xs font-medium text-foreground">Todas as aulas concluídas! 🎉</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhuma trilha disponível</p>
        )}
      </CardContent>
    </Card>
  );
}
