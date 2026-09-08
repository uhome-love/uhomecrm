// PosLigacaoDialog — Oferta Ativa · Fase 5 · Bloco 3
// Popup pós-ligação estruturado em 2 passos: resultado → motivo (obrigatório) → observação livre.
// Substitui o campo livre atual da base direta. Consumido pelas telas "Bases ativas / Concentração".
// Ainda NÃO substitui o AttemptModal do Mutirão ao vivo (fluxo separado).

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  RESULTADOS_LIGACAO,
  ResultadoLigacao,
  getResultadoMeta,
} from "@/lib/motivosLigacao";

export interface PosLigacaoPayload {
  resultado: ResultadoLigacao;
  motivo: string;
  observacao: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  leadNome: string;
  onSubmit: (payload: PosLigacaoPayload) => Promise<void> | void;
}

const COLOR_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  emerald: { border: "border-emerald-500/60", bg: "bg-emerald-500/15", text: "text-emerald-300" },
  amber:   { border: "border-amber-500/60",   bg: "bg-amber-500/15",   text: "text-amber-300" },
  sky:     { border: "border-sky-500/60",     bg: "bg-sky-500/15",     text: "text-sky-300" },
  rose:    { border: "border-rose-500/60",    bg: "bg-rose-500/15",    text: "text-rose-300" },
};

export default function PosLigacaoDialog({ open, onClose, leadNome, onSubmit }: Props) {
  const [resultado, setResultado] = useState<ResultadoLigacao | "">("");
  const [motivo, setMotivo] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const meta = useMemo(() => (resultado ? getResultadoMeta(resultado) : undefined), [resultado]);

  useEffect(() => {
    if (!open) {
      setResultado("");
      setMotivo("");
      setObservacao("");
      setSubmitting(false);
    }
  }, [open]);

  // Ao trocar de resultado, limpa o motivo (a lista muda)
  useEffect(() => {
    setMotivo("");
  }, [resultado]);

  const canSubmit = !!resultado && !!motivo && !submitting;

  const handleSubmit = async () => {
    if (!resultado) { toast.error("Selecione como foi a ligação"); return; }
    if (!motivo)    { toast.error("Selecione o motivo"); return; }
    setSubmitting(true);
    try {
      await onSubmit({ resultado, motivo, observacao: observacao.trim() });
    } catch (err: any) {
      console.error("[PosLigacaoDialog] submit falhou", err);
      toast.error(err?.message ?? "Erro ao registrar resultado");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Como foi a ligação?</DialogTitle>
          <DialogDescription>
            Lead: <strong className="text-foreground">{leadNome}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Passo 1 — resultado */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Passo 1 · Resultado
          </p>
          <div className="grid grid-cols-2 gap-2">
            {RESULTADOS_LIGACAO.map((r) => {
              const selected = resultado === r.key;
              const styles = COLOR_STYLES[r.color];
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setResultado(r.key)}
                  className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                    selected
                      ? `${styles.border} ${styles.bg} ${styles.text}`
                      : "border-border hover:border-muted-foreground/40 text-foreground"
                  }`}
                >
                  <div className="text-sm font-medium">
                    {r.emoji} {r.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {r.descricao}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Passo 2 — motivo (obrigatório) */}
        {meta && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              Passo 2 · Motivo
              <Badge variant="outline" className="text-[10px]">obrigatório</Badge>
              <Badge variant="secondary" className="text-[10px] ml-auto">{meta.cooldownLabel}</Badge>
            </p>
            <div className="flex flex-wrap gap-2">
              {meta.motivos.map((m) => {
                const selected = motivo === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotivo(m)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      selected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border hover:border-muted-foreground/40 text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Observação livre — opcional */}
        {meta && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Observação <span className="normal-case">(opcional)</span>
            </p>
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Contexto livre — não obrigatório"
              maxLength={500}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              "Salvar e próximo"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
