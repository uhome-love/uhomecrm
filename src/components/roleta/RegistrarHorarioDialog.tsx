// =============================================================================
// RegistrarHorarioDialog — Popup para o gestor registrar o horário real de
// chegada ou saída do corretor no turno. Default = hora atual BRT.
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
  // Monta ISO com offset -03:00 (BRT sem DST desde 2019)
  return `${dataBRT}T${hhmm}:00-03:00`;
}

export type TipoHorario = "chegada" | "saida";

interface Props {
  open: boolean;
  tipo: TipoHorario;
  dataBRT: string; // YYYY-MM-DD
  corretorNome: string;
  turnoLabel: string;
  onCancel: () => void;
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

  // Reseta pra hora atual toda vez que abrir
  useEffect(() => {
    if (open) setHora(nowHHmmBRT());
  }, [open]);

  const titulo =
    tipo === "chegada" ? "Registrar chegada" : "Registrar saída";
  const descricao =
    tipo === "chegada"
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!hora) return;
              onConfirm(combinarBRT(dataBRT, hora));
            }}
            disabled={!hora || isSubmitting}
          >
            {isSubmitting ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
