/**
 * LiaDescartarDialog — espelho do DiscardLeadDialog do pipeline, aplicado ao Hub da LIA.
 *
 * Só afeta a caixa isolada da LIA (`lia_estado` / `lia_followups`).
 * NÃO altera nada em `pipeline_leads`.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban, Loader2 } from "lucide-react";
import { buildMotivoDescarte } from "@/lib/leadOutcome";
import {
  DISCARD_REASONS_REENGAJAVEL,
  DISCARD_REASONS_DEFINITIVO,
  getReasonByCode,
  reasonDisplay,
} from "@/lib/discardReasons";
import { useLiaDescartar, type LiaEstado } from "./useLiaHub";

interface Props {
  estado: LiaEstado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LiaDescartarDialog({ estado, open, onOpenChange }: Props) {
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [tipo, setTipo] = useState<"reengajavel" | "definitivo">("reengajavel");
  const descartar = useLiaDescartar();

  useEffect(() => {
    if (open) { setMotivo(""); setObs(""); setTipo("reengajavel"); }
  }, [open]);

  const reasons = tipo === "definitivo" ? DISCARD_REASONS_DEFINITIVO : DISCARD_REASONS_REENGAJAVEL;

  const handleConfirm = async () => {
    if (!estado || !motivo) return;
    const reason = getReasonByCode(motivo);
    const labelRaw = motivo === "outro" ? (obs.trim() || "Outro motivo") : (reason?.label || motivo);
    await descartar.mutateAsync({
      telefone: estado.telefone,
      tipo,
      motivo: buildMotivoDescarte(tipo, labelRaw),
    });
    onOpenChange(false);
  };

  const disabled = descartar.isPending || !motivo || (motivo === "outro" && !obs.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" /> Descartar / Inativar contato
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Selecione o motivo e o destino de{" "}
            <strong>{estado?.nome || estado?.telefone || "contato"}</strong> dentro da LIA.
            O lead do pipeline não é alterado.
          </p>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.code} value={r.code}>{reasonDisplay(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {motivo === "outro" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Descreva o motivo</Label>
              <Textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Descreva..."
                className="resize-none"
                rows={3}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">O que fazer com o contato? *</Label>
            <Select
              value={tipo}
              onValueChange={(v) => { setTipo(v as "reengajavel" | "definitivo"); setMotivo(""); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reengajavel">🔄 Descartar (pode ser retomado)</SelectItem>
                <SelectItem value="definitivo">⛔ Inativar definitivo (opt-out)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {tipo === "definitivo"
                ? "O contato entra em opt-out, os follow-ups pendentes são cancelados e a LIA não fala mais com ele."
                : "O contato vai para Descartados e pode ser retomado a qualquer momento."}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={descartar.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={disabled} className="gap-2">
            {descartar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
