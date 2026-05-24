import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, StickyNote } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadNome: string;
  onSave: (conteudo: string) => Promise<unknown>;
}

/**
 * Dialog rápido para Anotações no drawer (Pipeline v2 Fase 5).
 * Usa o `onAddAnotacao` já plumbado em LeadHistoricoTab via PipelineLeadDetail.
 * Telemetria `drawer_anotar_saved` já dispara dentro do wrapper de onAddAnotacao no PipelineLeadDetail.
 */
export default function DrawerAnotarDialog({ open, onOpenChange, leadNome, onSave }: Props) {
  const [conteudo, setConteudo] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = conteudo.trim();
    if (!trimmed) { toast.error("Escreva algo antes de salvar"); return; }
    setSaving(true);
    try {
      await onSave(trimmed);
      toast.success("Anotação salva");
      setConteudo("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setConteudo(""); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" /> Anotação rápida
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <p className="text-xs text-muted-foreground">
            Sobre <strong>{leadNome}</strong>. Fica visível no histórico do lead.
          </p>
          <Textarea
            autoFocus
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="Ex: Cliente disse que vai pensar até sexta, prefere ser contatado à tarde…"
            rows={5}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
            }}
          />
          <p className="text-[10px] text-muted-foreground text-right">⌘/Ctrl + Enter para salvar</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !conteudo.trim()} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
            Salvar anotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
