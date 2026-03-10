import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Home, Briefcase } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectImovel: () => void;
  onSelectReuniao: () => void;
}

export default function VisitaTypeSelector({ open, onClose, onSelectImovel, onSelectReuniao }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-bold">
            Qual o objetivo da visita?
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onSelectImovel}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border/60 bg-card hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Home className="h-7 w-7 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">Visita de Imóvel</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Apresentação, decorado, stand</p>
            </div>
          </button>

          <button
            onClick={onSelectReuniao}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border/60 bg-card hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <Briefcase className="h-7 w-7 text-amber-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">Reunião de Negócio</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Negociação, contrato, entrega</p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
