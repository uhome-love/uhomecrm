import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
import { Undo2, TrendingDown, RotateCcw, Trash2 } from "lucide-react";

interface Props {
  row: PdnRow;
  riscoManual: boolean; setRiscoManual: (v: boolean) => void;
  riscoMotivo: string; setRiscoMotivo: (v: string) => void;
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
  row, riscoManual, setRiscoManual, riscoMotivo, setRiscoMotivo,
  onMudarEtapa, onLimparEtapa, onQueda, onReativar, onRemove, onClose,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <Label>Etapa no PDN</Label>
          {row.etapaAjustada && <Badge variant="secondary" className="text-[10px]">ajustada pelo gestor</Badge>}
        </div>
        <Select value={row.grupo} onValueChange={(v) => onMudarEtapa(row, v as PdnGrupo)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PDN_GRUPOS.map(g => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {!row.isManual && row.etapaAjustada && (
          <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs text-muted-foreground" onClick={() => onLimparEtapa(row)}>
            <Undo2 className="mr-1 h-3 w-3" /> Voltar à etapa do pipeline ({PDN_GRUPOS.find(g => g.key === row.grupoOrigem)?.label})
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">Mudar a etapa aqui reorganiza o PDN e avisa o corretor automaticamente.</p>
      </div>

      <div className="rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={riscoManual} onChange={(e) => setRiscoManual(e.target.checked)} className="h-4 w-4" />
          Marcar em risco
        </label>
        {riscoManual && (
          <Textarea value={riscoMotivo} onChange={(e) => setRiscoMotivo(e.target.checked ? riscoMotivo : e.target.value)} className="mt-2 min-h-[60px]" placeholder="Motivo do risco…" />
        )}
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
          <Trash2 className="mr-1.5 h-4 w-4" /> {row.isManual ? "Excluir" : "Remover da planilha"}
        </Button>
      </div>
    </div>
  );
}
