import { useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import PerformanceV3 from "@/components/performance/v3/PerformanceV3";

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

  const subVisoes = views.find((v) => v.id === viewAtual.id)?.ids ?? [];

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

        {/* Navegação: visões (chips) + sub-visão (select) */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <nav
            aria-label="Visões da Performance"
            className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {views.map((v) => {
              const Icon = v.icon;
              const active = v.id === viewAtual.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => selecionar(v.ids[0])}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </nav>

          {subVisoes.length > 1 && (
            <Select value={secao} onValueChange={(v) => selecionar(v as UnifiedSectionId)}>
              <SelectTrigger className="h-8 w-[210px] text-xs" aria-label="Sub-visão">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subVisoes.map((id) => {
                  const s = getUnifiedSection(id);
                  const Icon = s.icon;
                  return (
                    <SelectItem key={id} value={id} className="text-xs">
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} />
                        {s.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-5 sm:px-6">
        {atual.engine === "perf3" && <PerformanceV3 />}

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
