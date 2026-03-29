/**
 * DailyProgressCard — Shared progress card component
 * 
 * Used by BOTH CorretorHome and DialingModeWithScript.
 * Renders the exact same data from useCorretorProgress.
 * 
 * Variants:
 * - "full": Expanded view with edit, used in CorretorHome
 * - "compact": Inline summary, used in DialingModeWithScript
 */

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Flame, CalendarCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { CorretorProgress } from "@/hooks/useCorretorProgress";
import type { CorretorGoals } from "@/hooks/useCorretorDailyStats";

interface Props {
  progress: CorretorProgress;
  goals: CorretorGoals | null | undefined;
  saveGoals: (metaLig: number, metaAprov: number, metaVis: number, obs?: string) => Promise<void>;
  variant: "full" | "compact";
}

export default function DailyProgressCard({ progress, goals, saveGoals, variant }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [metaLig, setMetaLig] = useState("30");
  const [metaAprov, setMetaAprov] = useState("5");
  const [metaVis, setMetaVis] = useState("3");

  // Sync local edit state from goals (single source)
  useEffect(() => {
    if (goals) {
      setMetaLig(goals.meta_ligacoes.toString());
      setMetaAprov(goals.meta_aproveitados.toString());
      setMetaVis(goals.meta_visitas_marcadas.toString());
    }
  }, [goals?.meta_ligacoes, goals?.meta_aproveitados, goals?.meta_visitas_marcadas]);

  // Auto-save default goals when null (no record) — corretor sees progress immediately
  useEffect(() => {
    if (goals === null) {
      saveGoals(30, 5, 3).catch(e => console.error("Erro ao salvar meta default:", e));
    }
  }, [goals]);


  const handleSave = async () => {
    try {
      await saveGoals(parseInt(metaLig) || 30, parseInt(metaAprov) || 5, parseInt(metaVis) || 3);
      setEditing(false);
      toast.success("Meta salva! 🎯");
      queryClient.invalidateQueries({ queryKey: ["corretor-daily-goals"] });
    } catch (e: any) {
      console.error("Erro ao salvar meta:", e);
      toast.error("Erro ao salvar meta: " + (e?.message || "Erro desconhecido"));
    }
  };

  const openEditor = () => {
    setMetaLig(progress.metaLigacoes.toString());
    setMetaAprov(progress.metaAproveitados.toString());
    setMetaVis(progress.metaVisitas.toString());
    setEditing(true);
  };

  // === EDITOR (shared between both variants) ===
  if (editing) {
    const editorContent = (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">
          {variant === "full" ? "Meta do Dia" : "Editar Metas"}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Ligações</label>
            <Input type="number" value={metaLig} onChange={e => setMetaLig(e.target.value)} className="h-8 mt-0.5 rounded-lg" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Aproveitados</label>
            <Input type="number" value={metaAprov} onChange={e => setMetaAprov(e.target.value)} className="h-8 mt-0.5 rounded-lg" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Visitas</label>
            <Input type="number" value={metaVis} onChange={e => setMetaVis(e.target.value)} className="h-8 mt-0.5 rounded-lg" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className={`${variant === "full" ? "col-span-3" : "flex-1"} h-7 text-xs rounded-lg`} onClick={handleSave}>
            Salvar meta
          </Button>
          {goals && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancelar</Button>
          )}
        </div>
      </div>
    );

    if (variant === "compact") {
      return <div className="p-3 rounded-xl border border-border bg-card shadow-card">{editorContent}</div>;
    }
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Meta do Dia
            </h3>
          </div>
          {editorContent}
        </CardContent>
      </Card>
    );
  }

  // === DISPLAY MODE ===

  // Compact variant (DialingModeWithScript)
  if (variant === "compact") {
    return (
      <div className="p-3 rounded-xl border border-border bg-card shadow-card space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Flame className="h-4 w-4 text-primary" />
              <span className="font-bold text-foreground">{progress.tentativas}</span>
              <span className="text-muted-foreground text-[10px]">/ {progress.metaLigacoes}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Target className="h-4 w-4 text-emerald-500" />
              <span className="font-bold text-foreground">{progress.aproveitados}</span>
              <span className="text-muted-foreground text-[10px]">/ {progress.metaAproveitados}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <CalendarCheck className="h-4 w-4 text-amber-500" />
              <span className="font-bold text-foreground">{progress.visitasMarcadas}</span>
              <span className="text-muted-foreground text-[10px]">/ {progress.metaVisitas}</span>
            </div>
            <span className="text-xs font-bold text-primary">{progress.pontos} pts</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={openEditor}>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
            {progress.todasMissoesCumpridas ? (
              <Badge variant="secondary" className="text-[10px] gap-1">🏆 Todas as metas!</Badge>
            ) : progress.missaoCumprida ? (
              <Badge variant="secondary" className="text-[10px] gap-1">🔥 Missão cumprida!</Badge>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Progress value={progress.progLigacoes} className="h-1.5" />
          <Progress value={progress.progAproveitados} className="h-1.5" />
          <Progress value={progress.progVisitas} className="h-1.5" />
        </div>
      </div>
    );
  }

  // Full variant (CorretorHome)
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Meta do Dia
          </h3>
          <div className="flex items-center gap-2">
            {progress.todasMissoesCumpridas ? (
              <Badge variant="secondary" className="text-[10px] gap-1">🏆 Todas as metas!</Badge>
            ) : progress.missaoCumprida ? (
              <Badge variant="secondary" className="text-[10px] gap-1">🔥 Meta batida!</Badge>
            ) : null}
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={openEditor}>Editar</Button>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Tentativas</span>
              <span className="font-bold text-foreground">{progress.tentativas} / {progress.metaLigacoes}</span>
            </div>
            <Progress value={progress.progLigacoes} className="h-2.5" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Aproveitados</span>
              <span className="font-bold text-foreground">{progress.aproveitados} / {progress.metaAproveitados}</span>
            </div>
            <Progress value={progress.progAproveitados} className="h-2.5" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Visitas a Marcar</span>
              <span className="font-bold text-foreground">{progress.visitasMarcadas} / {progress.metaVisitas}</span>
            </div>
            <Progress value={progress.progVisitas} className="h-2.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
