import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PdnRow } from "@/hooks/usePdn";

export interface AcaoState {
  status: string; setStatus: (v: string) => void;
  obs: string; setObs: (v: string) => void;
}

interface Props {
  row: PdnRow;
  state: AcaoState;
}

/**
 * Aba Anotação — o overlay do gestor é só isto: status interno + observação.
 * Todo o resto (dados do lead, timeline, tarefas) vive no pipeline.
 */
export function PdnTabAcao({ state }: Props) {
  const { status, setStatus, obs, setObs } = state;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Status interno</Label>
        <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Ex.: aguardando aprovação do banco" />
      </div>
      <div className="space-y-1">
        <Label>Observação</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} className="min-h-[140px]" placeholder="Anotações do gestor…" />
        <p className="text-[11px] text-muted-foreground">
          Use <span className="font-medium">Salvar e publicar</span> no rodapé para gravar a observação no histórico do lead e avisar o corretor.
        </p>
      </div>
    </div>
  );
}
