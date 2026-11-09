/** Data e horário da visita marcada na ligação (obrigatórios para entrar na Agenda). */
import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const hojeBRT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export default function VisitaDialog({ aberto, nome, gravando, onFechar, onConfirmar }: {
  aberto: boolean; nome: string; gravando: boolean; onFechar: () => void; onConfirmar: (data: string, hora: string, nota: string) => void;
}) {
  const [data, setData] = useState(hojeBRT());
  const [hora, setHora] = useState("");
  const [nota, setNota] = useState("");
  useEffect(() => { if (aberto) { setData(hojeBRT()); setHora(""); setNota(""); } }, [aberto]);
  const agoraHM = new Date().toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const horaPassou = data === hojeBRT() && /^\d{2}:\d{2}$/.test(hora) && hora <= agoraHM;
  const valido = !!data && /^\d{2}:\d{2}$/.test(hora) && data >= hojeBRT() && !horaPassou;

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !gravando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-success" aria-hidden /> Visita marcada! 🎉</DialogTitle>
          <DialogDescription>Quando {nome || "o cliente"} vai visitar? A visita entra na sua Agenda.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="oa-visita-data">Dia</Label><Input id="oa-visita-data" type="date" min={hojeBRT()} value={data} onChange={(e) => setData(e.target.value)} className="h-11" /></div>
          <div className="space-y-1.5"><Label htmlFor="oa-visita-hora">Horário</Label><Input id="oa-visita-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-11" /></div>
        </div>
        {horaPassou && <p className="-mt-2 text-xs text-destructive">Esse horário já passou. Escolha um horário futuro.</p>}
        <div className="space-y-1.5"><Label htmlFor="oa-visita-nota">Observação (opcional)</Label><Input id="oa-visita-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: vem com a esposa" className="h-11" /></div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onFechar} disabled={gravando}>Cancelar</Button>
          <Button onClick={() => onConfirmar(data, hora, nota)} disabled={!valido || gravando} className="bg-success text-primary-foreground hover:bg-success-600">Salvar visita</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
