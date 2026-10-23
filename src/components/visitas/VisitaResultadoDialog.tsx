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
  | "quer_ver_outro"
  | "continuar_visitando";

export const RESULTADO_OPTIONS: { value: ResultadoVisita; label: string; emoji: string; desc: string }[] = [
  { value: "gostou_quer_proposta", label: "Quer proposta", emoji: "🔥", desc: "→ Pós-Visita (alinhar c/ gerente)" },
  { value: "continuar_visitando", label: "Continuar visitando", emoji: "🏠", desc: "→ Pós-Visita" },
  { value: "quer_ver_outro", label: "Ver outras opções", emoji: "🔎", desc: "→ Pós-Visita" },
  { value: "gostou_vai_pensar", label: "Vai pensar", emoji: "🤔", desc: "→ Pós-Visita" },
  { value: "nao_gostou", label: "Não gostou", emoji: "👎", desc: "→ Pós-Visita (descarte sugerido)" },
  { value: "reagendar", label: "Reagendar", emoji: "🔄", desc: "→ Visita marcada" },
  { value: "nao_compareceu", label: "Não compareceu (No Show)", emoji: "🚫", desc: "→ Aquecimento + follow-up" },
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
  nova_data?: string;
  nova_hora?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (resultado: ResultadoVisita, observacoes?: string, feedback?: Omit<FeedbackCompleto, "resultado" | "observacoes">) => Promise<void>;
  nomeCliente: string;
  /** Resultado já selecionado ao abrir (ex.: No Show). */
  defaultResultado?: ResultadoVisita | null;
  /** Modo bloqueio: não fecha por X, Esc ou clique fora. */
  blocking?: boolean;
  /** Texto extra no topo (ex.: "Visita de hoje 15:00 · 1 de 3"). */
  subtitulo?: string;
  /** Data/hora marcadas (YYYY-MM-DD / HH:mm) — bloqueia resultado antes do horário. */
  dataVisita?: string | null;
  horaVisita?: string | null;
}

const MIN_OBS = 10;

/** True se a visita (BRT) ainda não chegou no horário marcado. */
export function visitaAindaNaoAconteceu(data?: string | null, hora?: string | null): boolean {
  if (!data) return false;
  const marcada = new Date(`${data}T${(hora || "00:00").slice(0, 5)}:00-03:00`).getTime();
  return marcada > Date.now();
}

export default function VisitaResultadoDialog({ open, onClose, onSubmit, nomeCliente, defaultResultado, blocking, subtitulo, dataVisita, horaVisita }: Props) {
  const visitaFutura = visitaAindaNaoAconteceu(dataVisita, horaVisita);
  const [selected, setSelected] = useState<ResultadoVisita | null>(null);
  const [obs, setObs] = useState("");
  const [objecao, setObjecao] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");
  const hojeBRT = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const faltaReagenda = selected === "reagendar" && (!novaData || !novaHora);

  useEffect(() => {
    if (open) {
      setSelected(defaultResultado ?? null);
      setObs("");
      setObjecao("");
      setTemperatura("");
      setProximaAcao("");
      setNovaData("");
      setNovaHora("");
      setSubmitting(false);
    }
  }, [open, defaultResultado]);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const feedbackExtra = {
        objecao: objecao || undefined,
        temperatura: temperatura || undefined,
        proxima_acao: proximaAcao || undefined,
        nova_data: selected === "reagendar" ? novaData : undefined,
        nova_hora: selected === "reagendar" ? novaHora : undefined,
      };
      await onSubmit(selected, obs || undefined, feedbackExtra);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !blocking) onClose(); }}>
      <DialogContent
        className={`sm:max-w-lg max-h-[90vh] overflow-y-auto ${blocking ? "[&>button:last-child]:hidden" : ""}`}
        onEscapeKeyDown={(e) => { if (blocking) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (blocking) e.preventDefault(); }}
        onInteractOutside={(e) => { if (blocking) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            {blocking ? "Visita sem resultado registrado" : "Resultado da Visita"}
          </DialogTitle>
          {subtitulo && <p className="text-xs font-semibold text-destructive">{subtitulo}</p>}
          <DialogDescription className="text-xs">
            Registre o resultado da visita de <strong>{nomeCliente}</strong> para mover a oportunidade automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resultado */}
          <div className="grid grid-cols-2 gap-2">
            {RESULTADO_OPTIONS.map(opt => {
              const bloqueado = visitaFutura && opt.value !== "reagendar";
              return (
              <button
                key={opt.value}
                type="button"
                disabled={bloqueado}
                onClick={() => setSelected(opt.value)}
                className={`rounded-lg border p-3 text-left transition-all hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
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
              );
            })}
          </div>
          {visitaFutura && (
            <p className="text-xs font-medium text-destructive">
              A visita ainda não aconteceu ({dataVisita!.split("-").reverse().slice(0, 2).join("/")}{horaVisita ? ` às ${horaVisita.slice(0, 5)}` : ""}). Só dá para reagendar até lá.
            </p>
          )}
          <div className="hidden">
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

          {selected === "reagendar" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Nova data <span className="text-destructive">*</span></Label>
                <input type="date" min={hojeBRT} value={novaData} onChange={e => setNovaData(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Novo horário <span className="text-destructive">*</span></Label>
                <input type="time" value={novaHora} onChange={e => setNovaHora(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
              </div>
              {faltaReagenda && <p className="col-span-2 text-[11.5px] font-medium text-destructive">Informe a nova data e horário da visita.</p>}
            </div>
          )}

          {/* Observações — obrigatória (alimenta a história do lead) */}
          <div>
            <Label className="text-xs">Observações <span className="text-destructive">*</span></Label>
            <Textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="O que rolou na visita? Ex: gostou da vista, achou o valor ok, vai decidir com a esposa"
              rows={2}
            />
            {selected && obs.trim().length < MIN_OBS && (
              <p className="mt-1 text-[11.5px] font-medium text-destructive">
                {selected === "nao_compareceu"
                  ? "Conte o que aconteceu no No Show (ex.: cliente não atendeu, desmarcou em cima da hora)."
                  : "Escreva o que aconteceu na visita para registrar."}
              </p>
            )}
          </div>

          <Button
            className="w-full gap-2"
            disabled={!selected || obs.trim().length < MIN_OBS || faltaReagenda || submitting}
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
