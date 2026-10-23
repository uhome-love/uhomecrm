import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JornadaNegocioForm } from "./JornadaNegocioForm";

interface Props {
  leadId: string;
  etapa: { id: string; tipo: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function JornadaNegocioDialog({ leadId, etapa, onClose, onSaved }: Props) {
  if (!etapa) return null;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto" onClick={event => event.stopPropagation()}>
      <DialogHeader><DialogTitle>Jornada do negócio</DialogTitle></DialogHeader>
      <JornadaNegocioForm leadId={leadId} etapaId={etapa.id} tipo={etapa.tipo}
        onCancel={onClose} onSaved={() => { onSaved(); onClose(); }} />
    </DialogContent>
  </Dialog>;
}