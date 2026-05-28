import { Download, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSection, type CentralSectionId } from "./sections";

interface Props {
  secao: CentralSectionId;
  onOpenSidebar: () => void;
}

export function CentralHeader({ secao, onOpenSidebar }: Props) {
  const s = getSection(secao);

  const handleExport = () => {
    window.dispatchEvent(new CustomEvent("central:export-pdf", { detail: { secao } }));
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Abrir navegação"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-central-display truncate text-2xl leading-tight text-foreground sm:text-[28px]">
              Central de Relatórios
            </h1>
            <p className="truncate text-sm text-muted-foreground">{s.label}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
          <Download className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Exportar PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>
    </header>
  );
}
