import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
import { Undo2, TrendingDown, RotateCcw, Trash2 } from "lucide-react";

interface Props {
  row: PdnRow;
  onMudarEtapa: (row: PdnRow, grupo: PdnGrupo) => void;
  onLimparEtapa: (row: PdnRow) => void;
  onAvisar: (row: PdnRow, mensagem: string) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
  onRemove: (row: PdnRow) => void;
  onClose: () => void;
}

/**
 * Aba Etapa — mover no PDN, marcar risco/queda, remover.
 * "Avisar corretor" foi eliminado: o corretor é notificado automaticamente
 * quando o gestor publica uma observação ou muda a etapa.
 */
export function PdnTabEtapa({
  row,
  onMudarEtapa, onLimparEtapa, onQueda, onReativar, onRemove, onClose,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <Label>Etapa no pipeline</Label>
          <Badge variant="secondary" className="text-[10px]">espelho do pipeline</Badge>
        </div>
        <Select value={row.grupo} onValueChange={(v) => onMudarEtapa(row, v as PdnGrupo)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PDN_GRUPOS.map(g => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">Mudar a etapa aqui move o lead no pipeline real e avisa o corretor.</p>
      </div>

      {row.caiu ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
          <div className="mb-2"><span className="font-medium text-red-600 dark:text-red-400">Caiu:</span> {row.motivoQueda || "sem motivo"}</div>
          <Button variant="outline" size="sm" onClick={() => { onReativar(row); onClose(); }}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reativar negócio
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => { onQueda(row); onClose(); }}>
          <TrendingDown className="mr-1.5 h-3.5 w-3.5" /> Marcar como caiu
        </Button>
      )}

      <div className="pt-2 border-t">
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { onRemove(row); onClose(); }}>
          <Trash2 className="mr-1.5 h-4 w-4" /> Marcar como caiu / descartar
        </Button>
      </div>
    </div>
  );
}
