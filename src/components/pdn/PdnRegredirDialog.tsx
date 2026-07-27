import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Undo2 } from "lucide-react";
import type { PdnGrupo, PdnRow } from "@/hooks/usePdn";
import type { PdnDestino } from "@/lib/pdnSyncEngine";

const GRUPO_LABEL: Record<PdnDestino | "caidos", string> = {
  qualificacao: "Qualificação",
  aquecimento: "Aquecimento",
  visita_realizada: "Visita Realizada",
  em_negociacao: "Em Negociação",
  contrato: "Contrato",
  ganho: "Ganho",
  caidos: "Caídos",
};

// Ordem canônica ascendente. Só regride PARA etapas anteriores à atual.
const ORDER: PdnDestino[] = ["qualificacao", "aquecimento", "visita_realizada", "em_negociacao", "contrato", "ganho"];

interface Props {
  row: PdnRow | null;
  onClose: () => void;
  onConfirm: (grupoDestino: PdnDestino, motivo: string) => void;
}


/**
 * Diálogo de regressão de etapa no PDN.
 * - Escolha da etapa destino (só anteriores à atual).
 * - Motivo obrigatório (mín. 3 chars).
 * - Confirma que o corretor será notificado.
 */
export function PdnRegredirDialog({ row, onClose, onConfirm }: Props) {
  const grupoAtual = row?.grupo ?? null;

  const opcoes = useMemo<PdnGrupo[]>(() => {
    if (!grupoAtual) return [];
    const idx = ORDER.indexOf(grupoAtual);
    if (idx <= 0) return [];
    return ORDER.slice(0, idx).reverse(); // etapa imediatamente anterior primeiro
  }, [grupoAtual]);

  const [destino, setDestino] = useState<PdnGrupo | null>(null);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setMotivo("");
    setDestino(opcoes[0] ?? null);
  }, [row, opcoes]);

  const canConfirm = !!destino && motivo.trim().length >= 3;

  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Undo2 className="h-4 w-4 text-amber-600" />
            Regredir {row?.nome} no pipeline
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            Etapa atual: <strong>{grupoAtual ? GRUPO_LABEL[grupoAtual] : "—"}</strong>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Regredir para</Label>
            <div className="grid gap-2">
              {opcoes.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setDestino(g)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                    destino === g
                      ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <span className="font-medium">{GRUPO_LABEL[g]}</span>
                  {destino === g && (
                    <span className="text-[10px] font-semibold uppercase text-primary">selecionada</span>
                  )}
                </button>
              ))}
              {opcoes.length === 0 && (
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Não há etapa anterior para regredir.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Motivo da regressão</Label>
            <Textarea
              autoFocus
              value={motivo}
              placeholder="Ex.: proposta não foi aceita, cliente pediu mais tempo, documentos incompletos…"
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-[11px] text-muted-foreground">
              O corretor receberá uma notificação com a nova etapa e o motivo.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!canConfirm}
            onClick={() => {
              if (!destino) return;
              onConfirm(destino, motivo.trim());
            }}
          >
            Confirmar regressão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
