import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const MOTIVOS = [
  "Sem condição financeira",
  "Perfil não bate com o produto",
  "Já comprou em outro lugar",
  "Não quer mais contato",
  "Somente investidor",
  "Outro",
];

export function SemInteressePopup({
  open, onClose, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string, obs?: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sem interesse — motivo obrigatório</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <RadioGroup value={motivo} onValueChange={setMotivo}>
            {MOTIVOS.map((m) => (
              <div key={m} className="flex items-center space-x-2">
                <RadioGroupItem value={m} id={`m-${m}`} />
                <Label htmlFor={`m-${m}`} className="text-sm">{m}</Label>
              </div>
            ))}
          </RadioGroup>
          <Textarea placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              disabled={!motivo || loading}
              onClick={async () => {
                setLoading(true);
                try { await onConfirm(motivo, obs); setMotivo(""); setObs(""); } finally { setLoading(false); }
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
