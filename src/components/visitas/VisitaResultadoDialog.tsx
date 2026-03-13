import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const OBJECAO_OPTIONS = [
  "Preço alto",
  "Localização",
  "Tamanho do imóvel",
  "Prazo de entrega",
  "Condições de pagamento",
  "Quer mais opções",
  "Indeciso(a)",
  "Outro",
];

const TEMPERATURA_OPTIONS = [
  { value: "muito_quente", label: "🔥 Muito quente", desc: "Alto interesse, decisão próxima" },
  { value: "quente", label: "⚡ Quente", desc: "Interessado, precisa de follow-up" },
  { value: "morno", label: "🌡️ Morno", desc: "Interesse moderado" },
  { value: "frio", label: "🧊 Frio", desc: "Pouco interesse" },
];

export interface FeedbackCompleto {
  resultado: ResultadoVisita;
  observacoes?: string;
  objecao?: string;
  temperatura?: string;
  proxima_acao?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: ResultadoVisita, observacoes?: string, feedback?: Omit<FeedbackCompleto, "resultado" | "observacoes">) => Promise<void>;
  nomeCliente: string;
}

export default function VisitaResultadoDialog({ open, onClose, onSubmit, nomeCliente }: Props) {
  const [selected, setSelected] = useState<ResultadoVisita | null>(null);
  const [obs, setObs] = useState("");
  const [objecao, setObjecao] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setObs("");
      setObjecao("");
      setTemperatura("");
      setProximaAcao("");
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const feedbackExtra = {
        objecao: objecao || undefined,
        temperatura: temperatura || undefined,
        proxima_acao: proximaAcao || undefined,
      };
      await onSubmit(selected, obs || undefined, feedbackExtra);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
          {/* Resultado */}
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

          {/* Temperatura do lead */}
          {selected && selected !== "nao_compareceu" && (
            <div>
              <Label className="text-xs font-semibold">🌡️ Temperatura atualizada do lead</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                {TEMPERATURA_OPTIONS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTemperatura(t.value)}
                    className={`rounded-lg border px-3 py-2 text-left transition-all text-xs ${
                      temperatura === t.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "hover:border-muted-foreground/30"
                    }`}
                  >
                    <span className="font-semibold">{t.label}</span>
                    <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Objeção principal */}
          {selected && !["nao_compareceu", "gostou_quer_proposta"].includes(selected) && (
            <div>
              <Label className="text-xs font-semibold">🚧 Objeção principal (opcional)</Label>
              <Select value={objecao} onValueChange={setObjecao}>
                <SelectTrigger className="h-9 text-xs mt-1.5">
                  <SelectValue placeholder="Selecione a objeção..." />
                </SelectTrigger>
                <SelectContent>
                  {OBJECAO_OPTIONS.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Próxima ação */}
          {selected && (
            <div>
              <Label className="text-xs font-semibold">📋 Próxima ação</Label>
              <Textarea
                value={proximaAcao}
                onChange={e => setProximaAcao(e.target.value)}
                placeholder="Ex: Enviar proposta, ligar em 2 dias, reagendar para sábado..."
                rows={2}
                className="mt-1.5 text-xs"
              />
            </div>
          )}

          {/* Observações */}
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
