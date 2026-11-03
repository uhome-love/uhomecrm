import { useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import {
  UNIFIED_VIEWS,
  UNIFIED_SECTIONS,
  DEFAULT_UNIFIED_SECTION,
  SECTION_ALIASES,
  getUnifiedSection,
  getViewOfSection,
  isUnifiedSection,
  type UnifiedSectionId,
} from "@/components/central-v2/unifiedSections";
import { useCentralUrlState } from "@/components/central-v2/useCentralUrlState";
import { CentralHeader } from "@/components/central-v2/CentralHeader";
import { SectionRouterView } from "@/components/central-v2/SectionRouterView";
import { VisaoPipelineExtra } from "@/components/central-v2/VisaoPipelineExtra";
import { ReportBuilder } from "@/components/central-v2/report/ReportBuilder";
import PerformanceHub, { type PerfTab } from "@/components/performance/PerformanceHub";
import PerformancePro from "@/components/performance/hub/PerformancePro";

const ForecastContent = lazy(() => import("@/components/central/ForecastContent"));

/**
 * Performance — hub único de resultado do CRM.
 *
 * Absorve a antiga Central de Relatórios e a Central de Performance
 * (`/ranking`, `/performance`). A navegação é de 2 níveis: 5 visões (chips)
 * × sub-visões (select). A sub-visão ativa vive na URL (`?secao=`).
 */
export default function CentralRelatorios() {
  const [params, setParams] = useSearchParams();
  const { isAdmin, isGestor, isDiretor, isCorretor, loading: rolesLoading } = useUserRole();
  const { state, update } = useCentralUrlState();

  const soCorretor = isCorretor && !isGestor && !isAdmin && !isDiretor;

  const raw = params.get("secao") ?? params.get("visao");
  const secao: UnifiedSectionId = isUnifiedSection(raw)
    ? raw
    : (raw && SECTION_ALIASES[raw]) || DEFAULT_UNIFIED_SECTION;

  const disponiveis = useMemo(
    () => UNIFIED_SECTIONS.filter((s) => (soCorretor ? s.corretor : true)),
    [soCorretor]
  );

  const selecionar = useCallback(
    (id: UnifiedSectionId) => {
      const next = new URLSearchParams(params);
      next.set("secao", id);
      next.delete("visao");
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  // Corretor sem visão de gestão não acessa seções de equipe.
  useEffect(() => {
    if (rolesLoading) return;
    if (!disponiveis.some((s) => s.id === secao)) selecionar(DEFAULT_UNIFIED_SECTION);
  }, [rolesLoading, disponiveis, secao, selecionar]);

  const atual = getUnifiedSection(secao);
  const viewAtual = getViewOfSection(secao);

  const views = useMemo(
    () =>
      UNIFIED_VIEWS.map((v) => ({
        ...v,
        ids: v.ids.filter((id) => disponiveis.some((s) => s.id === id)),
      })).filter((v) => v.ids.length > 0),
    [disponiveis]
  );


  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Cabeçalho único do hub */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3.5 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-xl leading-tight text-foreground sm:text-2xl">
              Performance
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {soCorretor
                ? "Seus números, progresso e relatório 1:1"
                : "Resultado, funil e equipe · fonte única de verdade"}
            </p>
          </div>
        </div>

        {/* Navegação única: todas as visões num só seletor, agrupadas */}
        <nav aria-label="Visões da Performance" className="mt-3 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/60 p-1">
          {views.map((v, vi) => (
            <div key={v.id} className="flex items-center gap-0.5">
              {vi > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-border" />}
              {v.ids.map((id) => {
                const sec = getUnifiedSection(id);
                const Icon = sec.icon;
                const active = id === secao;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selecionar(id)}
                    aria-current={active ? "page" : undefined}
                    title={v.label}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all",
                      active ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} />
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 py-5 sm:px-6">
        {atual.engine === "perf3" && <PerformancePro />}

        {atual.engine === "ssot" && (
          <div className="flex flex-col gap-6">
            <PerformanceHub
              tab={secao as PerfTab}
              onNavigate={(t) => selecionar(t as UnifiedSectionId)}
            />
            {secao === "visao" && !soCorretor && <VisaoPipelineExtra state={state} />}
          </div>
        )}

        {atual.engine === "central" && atual.centralId && (
          <div className="flex flex-col gap-4">
            <CentralHeader state={{ ...state, secao: atual.centralId }} onChange={update} hideTitle />
            <SectionRouterView state={{ ...state, secao: atual.centralId }} />
          </div>
        )}

        {atual.engine === "builder" && <ReportBuilder />}

        {atual.engine === "forecast" && (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <ForecastContent />
          </Suspense>
        )}

        <p className="mt-8 text-[11px] text-muted-foreground/70">Fonte: {atual.fonte}</p>
      </main>
    </div>
  );
}
