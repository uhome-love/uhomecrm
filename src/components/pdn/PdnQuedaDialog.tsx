import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Archive, Recycle, ClipboardX } from "lucide-react";
import type { PdnRow } from "@/hooks/usePdn";

export type QuedaAction = "pdn_apenas" | "descartar" | "inativar";

interface Props {
  row: PdnRow | null;
  onClose: () => void;
  onConfirm: (action: QuedaAction, motivo: string) => void;
}

/** Diálogo unificado de queda: escolhe se apenas marca no PDN, descarta o lead
 * (reengajável) ou inativa (arquiva definitivamente). Só aparecem as opções
 * possíveis conforme o tipo da linha (manual x pipeline). */
export function PdnQuedaDialog({ row, onClose, onConfirm }: Props) {
  const [motivo, setMotivo] = useState("");
  const [action, setAction] = useState<QuedaAction>("pdn_apenas");
  useEffect(() => {
    setMotivo("");
    setAction(row?.pipelineLeadId ? "descartar" : "pdn_apenas");
  }, [row]);

  const canReal = !!row?.pipelineLeadId;

  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar {row?.nome} como caiu</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">O que fazer com este lead?</p>
          <div className="space-y-2">
            {canReal && (
              <ActionOption
                selected={action === "descartar"}
                onSelect={() => setAction("descartar")}
                icon={<Recycle className="h-4 w-4 text-amber-600" />}
                title="Descartar (reengajável)"
                desc="Move o lead para Descarte no pipeline. Volta para nutrição / oferta ativa. Corretor recebe aviso."
              />
            )}
            {canReal && (
              <ActionOption
                selected={action === "inativar"}
                onSelect={() => setAction("inativar")}
                icon={<Archive className="h-4 w-4 text-red-600" />}
                title="Inativar definitivo"
                desc="Arquiva o lead. Não volta em campanhas nem reengajamento. Corretor recebe aviso."
              />
            )}
            <ActionOption
              selected={action === "pdn_apenas"}
              onSelect={() => setAction("pdn_apenas")}
              icon={<ClipboardX className="h-4 w-4 text-muted-foreground" />}
              title="Somente no PDN"
              desc="Marca como caiu apenas na sua planilha do PDN. Não altera o pipeline do corretor."
            />
          </div>
        </div>

        <Textarea
          autoFocus
          value={motivo}
          placeholder="Motivo (ex.: desistiu, sem crédito, comprou em outro lugar)…"
          onChange={(e) => setMotivo(e.target.value)}
          className="min-h-[80px]"
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant={action === "pdn_apenas" ? "default" : "destructive"}
            onClick={() => onConfirm(action, motivo.trim())}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionOption({ selected, onSelect, icon, title, desc }: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
        selected ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border hover:bg-muted/40"
      }`}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}
