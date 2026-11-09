/** Janela "Como foi a ligação?" aberta ao finalizar a ligação (botão ou volta do discador). */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ResultadoBarra from "./ResultadoBarra";
import { formatarDuracao, type OrigemOA, type ResultadoOA } from "./tipos";

interface Props { aberto: boolean; nome: string; segundos: number; origem: OrigemOA; gravando: boolean; ultimo: ResultadoOA | null; onFechar: () => void; onResultado: (r: ResultadoOA) => void }

export default function ResultadoDialog({ aberto, nome, segundos, origem, gravando, ultimo, onFechar, onResultado }: Props) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !gravando) onFechar(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Como foi a ligação?</DialogTitle>
          <DialogDescription>{nome ? `${nome} · ` : ""}duração {formatarDuracao(segundos)}</DialogDescription>
        </DialogHeader>
        <ResultadoBarra origem={origem} gravando={gravando} fixo={false} destacar={false} ultimo={ultimo} onResultado={onResultado} semTitulo />
      </DialogContent>
    </Dialog>
  );
}
