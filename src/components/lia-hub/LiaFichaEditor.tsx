import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { nomeFicha, type FichaLia } from "./liaConhecimento";

export default function LiaFichaEditor({ produto, onClose, onSave, saving }: {
  produto: FichaLia; onClose: () => void; onSave: (ficha: string) => Promise<unknown>; saving: boolean;
}) {
  const [texto, setTexto] = useState(produto.ficha);
  const [revisar, setRevisar] = useState(false);
  const confirmar = async () => { try { await onSave(texto); onClose(); } catch { /* rascunho preservado; erro exibido pelo hook */ } };
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="sm:max-w-4xl" onEscapeKeyDown={(e) => { if (saving) e.preventDefault(); }} onInteractOutside={(e) => e.preventDefault()}>
      <DialogHeader><DialogTitle>{revisar ? "Revisar alterações" : "Editar ficha"} · {nomeFicha(produto)}</DialogTitle>
        <DialogDescription>Salvar atualiza o conhecimento, sem ligar campanhas ou enviar mensagens.</DialogDescription></DialogHeader>
      {revisar ? <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <section><h3 className="mb-2 text-sm font-semibold">Antes</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-xs">{produto.ficha}</pre></section>
        <section><h3 className="mb-2 text-sm font-semibold">Depois</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-accent p-3 font-sans text-xs">{texto}</pre></section>
      </div> : <Textarea aria-label="Ficha do empreendimento" className="min-h-80 font-mono text-xs" value={texto} onChange={(e) => setTexto(e.target.value)} />}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
        {revisar && <Button variant="outline" disabled={saving} onClick={() => setRevisar(false)}><ArrowLeft className="h-4 w-4" />Voltar à edição</Button>}
        <Button disabled={saving || texto === produto.ficha || !texto.trim()} onClick={revisar ? confirmar : () => setRevisar(true)}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{revisar ? "Confirmar salvamento" : "Revisar alterações"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}