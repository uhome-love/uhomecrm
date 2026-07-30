import { lazy, Suspense, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, GraduationCap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAcademia } from "@/hooks/useAcademia";
import { AcademiaHero } from "@/components/academia/AcademiaHero";
import { AcademiaStatsStrip } from "@/components/academia/AcademiaStatsStrip";
import { TrilhaRail } from "@/components/academia/TrilhaRail";
import { TrilhaPosterCard, ComingSoonPosterCard } from "@/components/academia/TrilhaPosterCard";
import { MeuProgressoTab } from "@/components/academia/MeuProgressoTab";
import { CertificadosTab } from "@/components/academia/CertificadosTab";
import { RAIL_ORDER, normalizeCategoria } from "@/components/academia/trilhaVisual";

const AcademiaGerenciarPage = lazy(() => import("@/pages/AcademiaGerenciarPage"));

const COMING_SOON: Record<string, { titulo: string; icon: string; gradient: string }> = {
  empreendimentos: { titulo: "Empreendimentos Uhome", icon: "🏠", gradient: "from-emerald-700 to-emerald-500" },
  tecnicas_vendas: { titulo: "Técnicas de Vendas", icon: "📞", gradient: "from-amber-700 to-orange-500" },
  objecoes_scripts: { titulo: "Objeções e Scripts", icon: "🎯", gradient: "from-purple-700 to-pink-500" },
};

export default function AcademiaPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const {
    trilhas, aulas, totalXp, studyLevel, getTrilhaProgress,
    certificados, completedTrilhasCount, completedAulasCount, canManage, loading, getAulaStatus,
  } = useAcademia();

  const tab = params.get("tab") || "trilhas";
  const setTab = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "trilhas") next.delete("tab"); else next.set("tab", v);
    setParams(next, { replace: true });
  };

  // Continue de onde parou
  const continueData = useMemo(() => {
    for (const trilha of trilhas) {
      const progress = getTrilhaProgress(trilha.id);
      if (progress.started && progress.percent < 100) {
        const trilhaAulas = aulas.filter(a => a.trilha_id === trilha.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        const nextAula = trilhaAulas.find(a => getAulaStatus(a.id) !== "concluida");
        if (nextAula) return { trilha, aula: nextAula, progress };
      }
    }
    return null;
  }, [trilhas, aulas, getTrilhaProgress, getAulaStatus]);

  const emAndamento = useMemo(
    () => trilhas.filter(t => { const p = getTrilhaProgress(t.id); return p.started && p.percent < 100; }),
    [trilhas, getTrilhaProgress]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando Academia...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">🎓 Academia Uhome</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sua jornada de conhecimento · nível <b className="text-foreground">{studyLevel.emoji} {studyLevel.label}</b>
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList>
          <TabsTrigger value="trilhas">Trilhas</TabsTrigger>
          <TabsTrigger value="progresso">Meu progresso</TabsTrigger>
          <TabsTrigger value="certificados">Certificados</TabsTrigger>
          {canManage && <TabsTrigger value="gerenciar">Gerenciar</TabsTrigger>}
        </TabsList>

        <TabsContent value="trilhas" className="space-y-7 mt-0">
          {continueData && (
            <AcademiaHero
              trilha={continueData.trilha}
              aula={continueData.aula}
              percent={continueData.progress.percent}
              onContinuar={() => navigate(`/academia/aula/${continueData.aula.id}`)}
              onVerTrilha={() => navigate(`/academia/trilha/${continueData.trilha.id}`)}
            />
          )}

          <AcademiaStatsStrip
            aulasConcluidas={completedAulasCount}
            aulasTotal={aulas.length}
            xp={totalXp}
            trilhasConcluidas={completedTrilhasCount}
            certificados={certificados.length}
          />

          {emAndamento.length > 0 && (
            <TrilhaRail titulo="▶️ Continue assistindo" hint="trilhas iniciadas">
              {emAndamento.map(t => (
                <TrilhaPosterCard key={t.id} trilha={t} progress={getTrilhaProgress(t.id)} onClick={() => navigate(`/academia/trilha/${t.id}`)} />
              ))}
            </TrilhaRail>
          )}

          {RAIL_ORDER.map(({ key, label, hint }) => {
            const doGrupo = trilhas.filter(t => normalizeCategoria(t.categoria) === key);
            const soon = doGrupo.length === 0 ? COMING_SOON[key] : null;
            if (doGrupo.length === 0 && !soon) return null;
            return (
              <TrilhaRail key={key} titulo={label} hint={hint}>
                {doGrupo.map(t => (
                  <TrilhaPosterCard key={t.id} trilha={t} progress={getTrilhaProgress(t.id)} onClick={() => navigate(`/academia/trilha/${t.id}`)} />
                ))}
                {soon && <ComingSoonPosterCard {...soon} />}
              </TrilhaRail>
            );
          })}

          {/* Trilhas sem categoria reconhecida */}
          {(() => {
            const known = new Set(RAIL_ORDER.map(r => r.key));
            const outras = trilhas.filter(t => !known.has(normalizeCategoria(t.categoria)));
            if (outras.length === 0) return null;
            return (
              <TrilhaRail titulo="📚 Outras trilhas">
                {outras.map(t => (
                  <TrilhaPosterCard key={t.id} trilha={t} progress={getTrilhaProgress(t.id)} onClick={() => navigate(`/academia/trilha/${t.id}`)} />
                ))}
              </TrilhaRail>
            );
          })()}

          {trilhas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-foreground font-bold text-lg mb-1">Nenhuma trilha disponível</h3>
              <p className="text-muted-foreground text-sm">Em breve, novas trilhas estarão disponíveis.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="progresso" className="mt-0">
          <MeuProgressoTab />
        </TabsContent>

        <TabsContent value="certificados" className="mt-0">
          <CertificadosTab />
        </TabsContent>

        {canManage && (
          <TabsContent value="gerenciar" className="mt-0">
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
              <AcademiaGerenciarPage showHeader={false} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
