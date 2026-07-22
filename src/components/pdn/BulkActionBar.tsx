import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Megaphone, Send, TrendingDown, X, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  count: number;
  onClear: () => void;
  onPublish: () => Promise<void> | void;
  onAvisar: () => Promise<void> | void;
  onQueda: (motivo: string) => Promise<void> | void;
}

/**
 * Barra flutuante que aparece quando há linhas selecionadas na planilha do PDN.
 * Ações em lote: publicar observação no lead, avisar corretor, marcar como caiu.
 */
export function BulkActionBar({ count, onClear, onPublish, onAvisar, onQueda }: Props) {
  const [busy, setBusy] = useState<"publish" | "avisar" | null>(null);
  const [quedaOpen, setQuedaOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (count === 0) return null;

  const run = async (kind: "publish" | "avisar", fn: () => Promise<void> | void) => {
    setBusy(kind);
    try { await fn(); } finally { setBusy(null); }
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
          <span className="pl-2 pr-1 text-sm font-medium">
            {count} selecionado{count > 1 ? "s" : ""}
          </span>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={!!busy} onClick={() => run("publish", onPublish)}>
            {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
            Publicar obs.
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={!!busy} onClick={() => run("avisar", onAvisar)}>
            {busy === "avisar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Avisar corretor
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700" disabled={!!busy} onClick={() => { setMotivo(""); setQuedaOpen(true); }}>
            <TrendingDown className="h-3.5 w-3.5" />
            Marcar caídos
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={onClear} title="Limpar seleção">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={quedaOpen} onOpenChange={setQuedaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar {count} negócio{count > 1 ? "s" : ""} como caiu</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O mesmo motivo será aplicado a todos os selecionados. Isso só altera o PDN — o pipeline dos corretores não é tocado.
          </p>
          <Textarea
            autoFocus
            value={motivo}
            placeholder="Motivo da queda (ex.: desistiu, sem crédito, comprou em outro lugar)…"
            onChange={(e) => setMotivo(e.target.value)}
            className="min-h-[90px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuedaOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!motivo.trim()}
              onClick={async () => {
                await onQueda(motivo.trim());
                setQuedaOpen(false);
              }}
            >
              Confirmar queda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
