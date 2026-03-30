import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface RadarFullscreenModalProps {
  open: boolean;
  onClose: () => void;
  leadNome: string;
}

export default function RadarFullscreenModal({ open, onClose, leadNome }: RadarFullscreenModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-center shrink-0">
          <h2 className="text-base font-bold text-foreground">Radar — {leadNome}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body — 2 colunas */}
        <div className="flex flex-1 overflow-hidden">
          {/* Coluna esquerda — Perfil */}
          <div className="w-[320px] min-w-[320px] border-r border-border p-4 overflow-y-auto">
            <p className="text-sm text-muted-foreground">Perfil do Lead (em breve)</p>
          </div>

          {/* Coluna direita — Imóveis */}
          <div className="flex-1 p-4 overflow-y-auto">
            <p className="text-sm text-muted-foreground">Imóveis compatíveis (em breve)</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-between items-center shrink-0">
          <span className="text-sm text-muted-foreground">0 selecionados</span>
          <Button disabled className="bg-emerald-600 text-white hover:bg-emerald-700">
            Criar Vitrine
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
