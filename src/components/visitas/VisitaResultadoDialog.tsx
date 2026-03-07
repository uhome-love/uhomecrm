import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ClipboardCheck } from "lucide-react";

export type ResultadoVisita =
  | "gostou_quer_proposta"
  | "gostou_vai_pensar"
  | "nao_gostou"
  | "nao_compareceu"
  | "reagendar"
  | "quer_ver_outro";

export const RESULTADO_OPTIONS: { value: ResultadoVisita; label: string; emoji: string; desc: string }[] = [
  { value: "gostou_quer_proposta", label: "Quer proposta", emoji: "🔥", desc: "→ Negociação" },
  { value: "gostou_vai_pensar", label: "Vai pensar", emoji: "🤔", desc: "→ Negociação" },
  { value: "nao_gostou", label: "Não gostou", emoji: "👎", desc: "→ Descarte" },
  { value: "nao_compareceu", label: "Não compareceu", emoji: "👻", desc: "→ Atendimento" },
  { value: "reagendar", label: "Reagendar", emoji: "🔄", desc: "→ Visita Marcada" },
  { value: "quer_ver_outro", label: "Quer ver outro", emoji: "🏠", desc: "→ Qualificação" },
];

export const RESULTADO_LABELS: Record<string, string> = Object.fromEntries(
  RESULTADO_OPTIONS.map(o => [o.value, `${o.emoji} ${o.label}`])
);

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: ResultadoVisita, observacoes?: string) => Promise<void>;
  nomeCliente: string;
}

export default function VisitaResultadoDialog({ open, onClose, onSubmit, nomeCliente }: Props) {
  const [selected, setSelected] = useState<ResultadoVisita | null>(null);
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onSubmit(selected, obs || undefined);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Resultado da Visita
          </DialogTitle>
          <DialogDescription className="text-xs">
            Registre o resultado da visita de <strong>{nomeCliente}</strong> para mover a oportunidade automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {RESULTADO_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                  selected === opt.value
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{opt.emoji}</span>
                  <span className="text-xs font-semibold">{opt.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>

          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Detalhes sobre a visita..."
              rows={2}
            />
          </div>

          <Button
            className="w-full gap-2"
            disabled={!selected || submitting}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar Resultado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
