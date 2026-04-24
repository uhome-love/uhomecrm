import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMateriaisMutations } from "@/hooks/useMateriaisMutations";
import type { MaterialEmpreendimento } from "@/hooks/useMateriais";
import { Loader2, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empreendimento?: MaterialEmpreendimento | null;
}

export function EmpreendimentoFormDialog({ open, onOpenChange, empreendimento }: Props) {
  const { upsertEmpreendimento, uploadLogo } = useMateriaisMutations();
  const [nome, setNome] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<number>(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(empreendimento?.nome ?? "");
      setLogoUrl(empreendimento?.logo_url ?? null);
      setOrdem(empreendimento?.ordem ?? 0);
    }
  }, [open, empreendimento]);

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      setLogoUrl(url);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) return;
    await upsertEmpreendimento.mutateAsync({
      id: empreendimento?.id,
      nome: nome.trim(),
      logo_url: logoUrl,
      ordem,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{empreendimento ? "Editar empreendimento" : "Novo empreendimento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Casa Tua" />
          </div>
          <div>
            <Label>Logo (opcional)</Label>
            <div className="flex items-center gap-3 mt-1">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="h-12 w-12 rounded object-cover border border-border" />
              ) : (
                <div className="h-12 w-12 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <Upload className="h-4 w-4" />
                </div>
              )}
              <Input type="file" accept="image/*" onChange={handleLogo} disabled={uploading} className="flex-1" />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </div>
          <div>
            <Label htmlFor="ordem">Ordem de exibição</Label>
            <Input id="ordem" type="number" value={ordem} onChange={(e) => setOrdem(Number(e.target.value) || 0)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!nome.trim() || upsertEmpreendimento.isPending}>
            {upsertEmpreendimento.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
