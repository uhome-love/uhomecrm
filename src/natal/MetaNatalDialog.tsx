import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { brlCurto, metaValida, META_VGV_MINIMA, visitasParaVgv } from "./missao";
import { CAMPANHA_FIM } from "./config";

const OPCOES = [1_000_000, 1_500_000, 2_000_000];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metaInicial: number;
  visitasInicial: number;
  onSalvar: (vgv: number, visitas: number) => Promise<void>;
}

export function MetaNatalDialog({ open, onOpenChange, metaInicial, visitasInicial, onSalvar }: Props) {
  const [vgv, setVgv] = useState(metaInicial);
  const [outro, setOutro] = useState(!OPCOES.includes(metaInicial));
  const [visitas, setVisitas] = useState(visitasInicial);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) { setVgv(metaInicial); setOutro(!OPCOES.includes(metaInicial)); setVisitas(visitasInicial); }
  }, [open, metaInicial, visitasInicial]);

  const total = visitasParaVgv(vgv);
  const semanas = Math.max(1, Math.ceil((Date.parse(CAMPANHA_FIM) - Date.now()) / (7 * 86_400_000)));
  const valido = metaValida(vgv);

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      await onSalvar(vgv, visitas);
      toast.success("Meta de Natal salva! Bora buscar 🔑");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar a meta. Tente de novo.");
    } finally { setSalvando(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src="/natal/chave_de_ouro_com_laco.svg" alt="" className="h-7 w-7" /> Qual é a sua meta de Natal?
          </DialogTitle>
          <DialogDescription>De 02/11 a 18/12. O mínimo é R$ 1 milhão: dá para mirar mais alto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-semibold">VGV assinado</p>
          <div className="grid grid-cols-4 gap-2">
            {OPCOES.map((o) => (
              <Button key={o} type="button" variant={!outro && vgv === o ? "default" : "outline"} className="h-auto flex-col py-2 text-xs"
                onClick={() => { setOutro(false); setVgv(o); }}>
                {brlCurto(o)}{o === META_VGV_MINIMA && <span className="text-[10px] opacity-70">mínimo</span>}
              </Button>
            ))}
            <Button type="button" variant={outro ? "default" : "outline"} className="text-xs" onClick={() => setOutro(true)}>Outro</Button>
          </div>
          {outro && (
            <Input inputMode="numeric" placeholder="Ex.: 3000000" value={vgv ? String(vgv) : ""}
              onChange={(e) => setVgv(Number(e.target.value.replace(/\D/g, "")) || 0)} />
          )}
          {!valido && <p className="text-xs text-destructive">O mínimo é R$ 1.000.000.</p>}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Visitas realizadas por semana</p>
          <div className="flex items-center gap-3">
            <Button type="button" size="icon" variant="outline" aria-label="Menos" onClick={() => setVisitas((v) => Math.max(1, v - 1))}><Minus className="h-4 w-4" /></Button>
            <span className="w-10 text-center text-2xl font-bold">{visitas}</span>
            <Button type="button" size="icon" variant="outline" aria-label="Mais" onClick={() => setVisitas((v) => Math.min(30, v + 1))}><Plus className="h-4 w-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">Hoje a média da Uhome é 1,3 por semana. A missão é chegar a 3 ou mais.</p>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          Com <b>{brlCurto(vgv)}</b>, você precisa de ~<b>{total}</b> visitas realizadas na campanha: <b>{Math.ceil(total / semanas)}</b> por semana.
          Para 3 realizadas, agende 6: metade dos clientes falta.
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Agora não</Button>
          <Button onClick={salvar} disabled={!valido || salvando}>{salvando ? "Salvando..." : "Salvar minha meta"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
