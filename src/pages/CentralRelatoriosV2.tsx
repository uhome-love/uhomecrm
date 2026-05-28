import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CentralHeader } from "@/components/central-v2/CentralHeader";
import { CentralSidebar } from "@/components/central-v2/CentralSidebar";
import { CentralFilters } from "@/components/central-v2/CentralFilters";
import { EmptyStateView } from "@/components/central-v2/EmptyStateView";
import { useCentralUrlState } from "@/components/central-v2/useCentralUrlState";
import { DEFAULT_SECTION, isCentralSection, type CentralSectionId } from "@/components/central-v2/sections";

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

  // Normalização do legado: roda em useEffect para evitar setState no render.
  // Calcula em useMemo a decisão; o useEffect aplica.
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

  const handleSelect = (id: CentralSectionId) => {
    update({ secao: id });
    setMobileOpen(false);
  };

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
          <EmptyStateView secao={state.secao} />
        </main>
      </div>
    </div>
  );
}
