// =============================================================================
// RegistrarHorarioDialog — Popup para o gestor registrar presença/saída/falta.
//   - "chegada": registra horário de chegada → status na_empresa
//   - "saida"  : registra horário de saída  → status saiu
//   - "falta"  : marca faltou (sem horário)  → status falta
// =============================================================================
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Retorna "HH:mm" no fuso BRT. */
function nowHHmmBRT(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

/** Combina data (YYYY-MM-DD BRT) + hora "HH:mm" em ISO timestamptz. */
function combinarBRT(dataBRT: string, hhmm: string): string {
  return `${dataBRT}T${hhmm}:00-03:00`;
}

export type TipoHorario = "chegada" | "saida" | "falta";

interface Props {
  open: boolean;
  tipo: TipoHorario;
  dataBRT: string; // YYYY-MM-DD
  corretorNome: string;
  turnoLabel: string;
  onCancel: () => void;
  /** Para "chegada"/"saida" recebe ISO; para "falta" recebe string vazia. */
  onConfirm: (isoTimestamp: string) => void;
  isSubmitting?: boolean;
}

export function RegistrarHorarioDialog({
  open,
  tipo,
  dataBRT,
  corretorNome,
  turnoLabel,
  onCancel,
  onConfirm,
  isSubmitting,
}: Props) {
  const [hora, setHora] = useState<string>(nowHHmmBRT());

  useEffect(() => {
    if (open) setHora(nowHHmmBRT());
  }, [open]);

  const isFalta = tipo === "falta";
  const titulo =
    tipo === "chegada"
      ? "Registrar chegada"
      : tipo === "saida"
        ? "Registrar saída"
        : "Marcar falta";
  const descricao = isFalta
    ? `Confirma que ${corretorNome} faltou neste turno?`
    : tipo === "chegada"
      ? `Que horas ${corretorNome} chegou na empresa?`
      : `Que horas ${corretorNome} saiu da empresa?`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {descricao}
            <br />
            <span className="text-[11px] text-muted-foreground">
              Turno {turnoLabel} · {dataBRT}
            </span>
          </DialogDescription>
        </DialogHeader>

        {!isFalta && (
          <div className="grid gap-2 py-2">
            <Label htmlFor="horario">Horário</Label>
            <Input
              id="horario"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              step={60}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Padrão: horário atual. Ajuste se o corretor chegou/saiu em outro
              momento.
            </p>
          </div>
        )}

        {isFalta && (
          <p className="text-[12px] text-muted-foreground py-2">
            Esse registro fica no histórico do corretor. Para reverter, marque
            "Presente" no mesmo turno.
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant={isFalta ? "destructive" : "default"}
            onClick={() => {
              if (isFalta) return onConfirm("");
              if (!hora) return;
              onConfirm(combinarBRT(dataBRT, hora));
            }}
            disabled={(!isFalta && !hora) || isSubmitting}
          >
            {isSubmitting
              ? "Salvando..."
              : isFalta
                ? "Confirmar falta"
                : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
