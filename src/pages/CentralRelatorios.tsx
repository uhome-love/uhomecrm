import { useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import {
  UNIFIED_GROUPS,
  UNIFIED_SECTIONS,
  DEFAULT_UNIFIED_SECTION,
  SECTION_ALIASES,
  getUnifiedSection,
  isUnifiedSection,
  type UnifiedSectionId,
} from "@/components/central-v2/unifiedSections";
import { useCentralUrlState } from "@/components/central-v2/useCentralUrlState";
import { CentralHeader } from "@/components/central-v2/CentralHeader";
import { SectionRouterView } from "@/components/central-v2/SectionRouterView";
import { ReportBuilder } from "@/components/central-v2/report/ReportBuilder";
import PerformanceHub, { type PerfTab } from "@/components/performance/PerformanceHub";

/**
 * Central de Relatórios — hub único de resultado do CRM.
 *
 * Absorve a antiga Central de Performance (`/ranking`, `/performance`).
 * A seção ativa vive na URL (`?secao=`), com três motores de dados:
 * SSOT (`rpc_metricas`), relatórios operacionais (`get_relatorio_*`) e o
 * construtor de relatório por equipe.
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
  const grupos = UNIFIED_GROUPS.map((g) => ({
    ...g,
    ids: g.ids.filter((id) => disponiveis.some((s) => s.id === id)),
  })).filter((g) => g.ids.length > 0);

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Cabeçalho único */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3.5 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display truncate text-xl leading-tight text-foreground sm:text-2xl">
              Central de Relatórios
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {soCorretor
                ? "Seus números, progresso e relatório 1:1"
                : "Resultado, performance e relatórios · fonte única de verdade"}
            </p>
          </div>
        </div>

        {/* Navegação por grupos */}
        <nav
          aria-label="Seções da Central de Relatórios"
          className="mt-3 flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {grupos.map((g, gi) => (
            <div key={g.label} className="flex items-center gap-1">
              {gi > 0 && <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />}
              {g.ids.map((id) => {
                const s = getUnifiedSection(id);
                const Icon = s.icon;
                const active = id === secao;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selecionar(id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 py-5 sm:px-6">
        {atual.engine === "ssot" && (
          <PerformanceHub
            tab={secao as PerfTab}
            onNavigate={(t) => selecionar(t as UnifiedSectionId)}
          />
        )}

        {atual.engine === "central" && atual.centralId && (
          <div className="flex flex-col gap-4">
            <CentralHeader state={{ ...state, secao: atual.centralId }} onChange={update} hideTitle />
            <SectionRouterView state={{ ...state, secao: atual.centralId }} />
          </div>
        )}

        {atual.engine === "builder" && <ReportBuilder />}

        <p className="mt-8 text-[11px] text-muted-foreground/70">Fonte: {atual.fonte}</p>
      </main>
    </div>
  );
}
