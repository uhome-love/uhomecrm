import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ClipboardCheck } from "lucide-react";

export type ResultadoVisita =
  | "gostou_quer_proposta"
  | "gostou_vai_pensar"
  | "nao_gostou"
  | "nao_compareceu"
  | "reagendar"
  | "quer_ver_outro"
  | "continuar_visitando";

export const RESULTADO_OPTIONS: { value: ResultadoVisita; label: string; emoji: string; desc: string }[] = [
  { value: "gostou_quer_proposta", label: "Quer proposta", emoji: "🔥", desc: "→ Pós-Visita (alinhar c/ gerente)" },
  { value: "continuar_visitando", label: "Continuar visitando", emoji: "🏠", desc: "→ Pós-Visita" },
  { value: "quer_ver_outro", label: "Ver outras opções", emoji: "🔎", desc: "→ Pós-Visita" },
  { value: "gostou_vai_pensar", label: "Vai pensar", emoji: "🤔", desc: "→ Pós-Visita" },
  { value: "nao_gostou", label: "Não gostou", emoji: "👎", desc: "→ Pós-Visita (descarte sugerido)" },
  { value: "reagendar", label: "Reagendar", emoji: "🔄", desc: "→ Visita marcada" },
  { value: "nao_compareceu", label: "Não compareceu", emoji: "👻", desc: "→ Aquecimento" },
];

export const RESULTADO_LABELS: Record<string, string> = Object.fromEntries(
  RESULTADO_OPTIONS.map(o => [o.value, `${o.emoji} ${o.label}`])
);

// Objeções padronizadas (chip de 1 clique). Alinhado ao que aparece nas visitas reais
// do Casa Tua: prazo de entrega, renda/financiamento, decisão em família.
const OBJECAO_OPTIONS = [
  "Preço",
  "Prazo de entrega",
  "Renda / financiamento",
  "Decisão em família",
  "Localização",
  "Tamanho / planta",
  "Quer comparar",
  "Outra",
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
  data_proxima_acao?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: ResultadoVisita, observacoes?: string, feedback?: Omit<FeedbackCompleto, "resultado" | "observacoes">) => Promise<void>;
  nomeCliente: string;
}

// chip reutilizável (single-select)
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default function VisitaResultadoDialog({ open, onClose, onSubmit, nomeCliente }: Props) {
  const [selected, setSelected] = useState<ResultadoVisita | null>(null);
  const [obs, setObs] = useState("");
  const [objecao, setObjecao] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [dataProximaAcao, setDataProximaAcao] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setObs("");
      setObjecao("");
      setTemperatura("");
      setProximaAcao("");
      setDataProximaAcao("");
      setSubmitting(false);
    }
  }, [open]);

  // Regras de obrigatoriedade. Toda visita que REALIZOU (não é no-show nem reagendamento)
  // exige registro completo, é o gargalo da venda que estamos fechando.
  const realizou = !!selected && !["nao_compareceu", "reagendar"].includes(selected);
  const exigeObjecao = realizou && selected !== "gostou_quer_proposta";
  const faltaObrigatorio =
    !selected ||
    (realizou && (!temperatura || !proximaAcao.trim() || !dataProximaAcao || !obs.trim())) ||
    (exigeObjecao && !objecao);

  const handleSubmit = async () => {
    if (!selected || faltaObrigatorio) return;
    setSubmitting(true);
    try {
      const feedbackExtra = {
        objecao: objecao || undefined,
        temperatura: temperatura || undefined,
        proxima_acao: proximaAcao || undefined,
        data_proxima_acao: dataProximaAcao || undefined,
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
          {/* 1. O que aconteceu? */}
          <div>
            <Label className="text-xs font-semibold">1. O que aconteceu na visita? *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
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
          </div>

          {/* 2. Temperatura */}
          {realizou && (
            <div>
              <Label className="text-xs font-semibold">2. Temperatura do lead *</Label>
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

          {/* 3. Objeção (obrigatória quando não é "quer proposta") */}
          {exigeObjecao && (
            <div>
              <Label className="text-xs font-semibold">3. Qual a objeção? *</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {OBJECAO_OPTIONS.map(o => (
                  <Chip key={o} active={objecao === o} onClick={() => setObjecao(objecao === o ? "" : o)}>{o}</Chip>
                ))}
              </div>
            </div>
          )}

          {/* 4. Próximo passo + quando */}
          {realizou && (
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <Label className="text-xs font-semibold">4. Próximo passo *</Label>
                <Textarea
                  value={proximaAcao}
                  onChange={e => setProximaAcao(e.target.value)}
                  placeholder="Ex: Enviar proposta, ligar para tratar o prazo de entrega..."
                  rows={2}
                  className="mt-1.5 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Quando *</Label>
                <Input
                  type="date"
                  value={dataProximaAcao}
                  onChange={e => setDataProximaAcao(e.target.value)}
                  className="mt-1.5 h-9 text-xs"
                />
              </div>
            </div>
          )}

          {/* 5. Observação (sempre obrigatória quando realizou) */}
          <div>
            <Label className="text-xs font-semibold">
              {realizou ? "5. Observação *" : "Observação"}
            </Label>
            <Textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="O que o cliente falou, contexto da objeção, detalhes que ajudem o gerente e a LIA..."
              rows={3}
              className="mt-1.5 text-xs"
            />
          </div>

          {faltaObrigatorio && selected && realizou && (
            <p className="text-[11px] text-amber-600">
              Preencha temperatura, {exigeObjecao ? "objeção, " : ""}próximo passo com data e observação para registrar.
            </p>
          )}

          <Button
            className="w-full gap-2"
            disabled={faltaObrigatorio || submitting}
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
