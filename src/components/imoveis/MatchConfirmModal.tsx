/**
 * MatchConfirmModal — Confirmation modal before saving lead-property indications.
 */

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Bookmark, MapPin } from "lucide-react";
import { getPropertyCardImages, extractEndereco, getNum } from "@/lib/imovelHelpers";

interface MatchConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadNome: string;
  imoveis: any[];
  getPreco: (item: any) => string;
  saving: boolean;
  onConfirm: (observacao?: string) => void;
}

export default function MatchConfirmModal({
  open, onOpenChange, leadNome, imoveis, getPreco, saving, onConfirm,
}: MatchConfirmModalProps) {
  const [observacao, setObservacao] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" />
            Confirmar indicação para {leadNome}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] pr-2">
          <div className="space-y-2">
            {imoveis.map((item, i) => {
              const images = getPropertyCardImages(item);
              const loc = extractEndereco(item);
              const dorms = getNum(item, "dormitorios");
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border/50">
                  <div className="h-14 w-14 rounded-md overflow-hidden bg-muted shrink-0">
                    {images[0] ? (
                      <img src={images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground/30 text-xs">📷</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{getPreco(item)}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {loc.bairro || loc.endereco || "—"}
                    </p>
                    {dorms != null && dorms > 0 && (
                      <p className="text-[11px] text-muted-foreground">{dorms} dorm</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">Observação (opcional)</label>
          <Textarea
            placeholder="Ex: Imóveis selecionados para visita na próxima semana..."
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            className="text-sm"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => onConfirm(observacao || undefined)} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Confirmar e Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
