import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { CentralHeader } from "@/components/central-v2/CentralHeader";
import { CentralSidebar } from "@/components/central-v2/CentralSidebar";
import { CentralFilters } from "@/components/central-v2/CentralFilters";
import { SectionRouterView } from "@/components/central-v2/SectionRouterView";
import { useCentralUrlState } from "@/components/central-v2/useCentralUrlState";
import {
  CENTRAL_SECTIONS,
  DEFAULT_SECTION,
  isCentralSection,
  type CentralSectionId,
} from "@/components/central-v2/sections";
import { exportGeral } from "@/lib/centralPdf";

const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  CENTRAL_SECTIONS.map((s) => [s.id, s.label])
);

const PERIODO_LABELS: Record<string, string> = {
  hoje: "Hoje",
  semana: "Semana atual",
  mes: "Mês atual",
  trimestre: "Trimestre atual",
  custom: "Período personalizado",
};

/**
 * Mapeia o parâmetro legado ?visao= para a nova seção.
 * Retorna null quando deve redirecionar para outra rota.
 */
function normalizeLegacyVisao(visao: string | null): CentralSectionId | "redirect-1-1" | null {
  if (!visao) return null;
  if (visao === "um-a-um") return "redirect-1-1";
  if (isCentralSection(visao)) return visao;
  return DEFAULT_SECTION;
}

export default function CentralRelatoriosV2() {
  const [params, setParams] = useSearchParams();
  const visao = params.get("visao");

  const legacyDecision = useMemo(() => normalizeLegacyVisao(visao), [visao]);

  useEffect(() => {
    if (!legacyDecision || legacyDecision === "redirect-1-1") return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("visao");
        if (!next.get("secao")) next.set("secao", legacyDecision);
        return next;
      },
      { replace: true }
    );
  }, [legacyDecision, setParams]);

  if (legacyDecision === "redirect-1-1") {
    return <Navigate to="/relatorios-1-1" replace />;
  }

  return <CentralRelatoriosV2Inner />;
}

function CentralRelatoriosV2Inner() {
  const { state, update } = useCentralUrlState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleSelect = (id: CentralSectionId) => {
    update({ secao: id });
    setMobileOpen(false);
  };

  // Listener do botão "Exportar PDF" do header.
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ secao?: CentralSectionId }>).detail;
      const secao = detail?.secao ?? state.secao;
      const isGeral = secao === "geral";
      try {
        setIsExporting(true);
        await exportGeral({
          periodoLabel: PERIODO_LABELS[state.periodo] ?? state.periodo,
          equipeLabel: state.equipe ? "Equipe selecionada" : "Todas as equipes",
          targetId: isGeral ? "central-relatorio-geral" : "central-relatorio-secao",
          subtitulo: isGeral
            ? "Visão geral consolidada"
            : `Seção: ${SECTION_LABELS[secao] ?? secao}`,
        });
      } catch (err) {
        console.error("[CentralRelatoriosV2] export error", err);
        toast({
          title: "Falha ao gerar PDF",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
      } finally {
        setIsExporting(false);
      }
    };
    window.addEventListener("central:export-pdf", handler);
    return () => window.removeEventListener("central:export-pdf", handler);
  }, [state.periodo, state.equipe, toast]);

  return (
    <div className="min-h-full bg-background">
      <CentralHeader secao={state.secao} onOpenSidebar={() => setMobileOpen(true)} />

      <div className="grid lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-border bg-card lg:block">
          <div className="sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
            <CentralSidebar secaoAtiva={state.secao} onSelect={handleSelect} />
          </div>
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="pt-6">
              <CentralSidebar secaoAtiva={state.secao} onSelect={handleSelect} />
            </div>
          </SheetContent>
        </Sheet>

        <main className="flex flex-col gap-4 p-4 sm:p-6">
          <CentralFilters state={state} onChange={update} />
          <div id="central-relatorio-secao">
            <SectionRouterView state={state} />
          </div>
        </main>
      </div>

      {isExporting && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="central-card pointer-events-auto px-5 py-3 text-sm text-foreground">
            Gerando PDF…
          </div>
        </div>
      )}
    </div>
  );
}
