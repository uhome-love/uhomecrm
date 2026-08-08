import { PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, RotateCcw, TrendingDown, Trash2, Undo2 } from "lucide-react";
import { ObsSelector, StatusSelector } from "./cells";
import { GRUPO_LABEL_UI, PREV_GRUPO } from "./constants";

export function MobileCard({ r, onSave, onRemove, onQueda, onReativar, onMudarEtapa, onOpenRow, selected, onToggleSelected }: {
  r: PdnRow;
  onSave: (row: PdnRow, patch: Partial<Pick<PdnRow, "status" | "observacoes" | "empreendimento" | "vgv">>) => void;
  onRemove: (row: PdnRow) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
  onMudarEtapa: (row: PdnRow, grupo: PdnGrupo) => void;
  onAvisar?: (row: PdnRow, mensagem: string) => void;
  onOpenRow: (row: PdnRow) => void;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  return (
    <div className={`space-y-2 p-3 ${r.emRisco ? "bg-amber-500/5" : ""} ${selected ? "bg-primary/5" : ""} ${r.caiu ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Checkbox className="mt-0.5" checked={selected} onCheckedChange={onToggleSelected} aria-label="Selecionar" />
          <div className="min-w-0">
            <button type="button" onClick={() => onOpenRow(r)} className="flex items-center gap-1.5 text-left font-medium hover:text-primary">
              {r.emRisco && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
              <span className="truncate underline-offset-2 hover:underline">{r.nome}</span>
            </button>
            <div className="text-xs text-muted-foreground">
              {r.empreendimento !== "—" ? r.empreendimento : "Sem empreendimento"} · {r.data ? formatBRT(r.data, "dd/MM/yy") : "—"}
            </div>
          </div>
        </div>
        <div className="text-right text-sm font-semibold">{r.vgv > 0 ? fmtMoney(r.vgv, "short") : "—"}</div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{r.corretor}{r.equipe !== "—" ? ` · ${r.equipe}` : ""}</span>
        <StatusSelector value={r.status} onChange={(v) => onSave(r, { status: v })} />
      </div>
      <div className="flex items-center gap-2">
        <Select value={r.grupo} onValueChange={(v) => onMudarEtapa(r, v as PdnGrupo)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PDN_GRUPOS.map(g => <SelectItem key={g.key} value={g.key} className="text-xs">{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {r.caiu && r.motivoQueda ? (
        <div className="rounded-md bg-red-500/5 px-2 py-1 text-xs"><span className="font-medium text-red-600 dark:text-red-400">Queda:</span> {r.motivoQueda}</div>
      ) : (
        <ObsSelector value={r.observacoes} pipelineLeadId={r.pipelineLeadId} row={r} onChange={(v) => onSave(r, { observacoes: v })} />
      )}
      <div className="flex items-center justify-end gap-1">
        {r.caiu ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onReativar(r)}>
            <RotateCcw className="mr-1 h-3 w-3" /> Reativar
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => onQueda(r)}>
            <TrendingDown className="mr-1 h-3 w-3" /> Caiu
          </Button>
        )}
        {(() => {
          const prev = PREV_GRUPO[r.grupo];
          if (!r.caiu && prev) {
            return (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-amber-600"
                title={`Regredir para ${GRUPO_LABEL_UI[prev]}`}
                onClick={() => onMudarEtapa(r, prev)}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            );
          }
          return (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Marcar como caiu / descartar" onClick={() => onRemove(r)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          );
        })()}
      </div>
    </div>
  );
}
