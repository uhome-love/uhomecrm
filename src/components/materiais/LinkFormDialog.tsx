import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIAS } from "./CategoriaIcon";
import { useMateriaisMutations } from "@/hooks/useMateriaisMutations";
import type { MaterialLink } from "@/hooks/useMateriais";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empreendimentoId: string;
  link?: MaterialLink | null;
}

export function LinkFormDialog({ open, onOpenChange, empreendimentoId, link }: Props) {
  const { upsertLink } = useMateriaisMutations();
  const [categoria, setCategoria] = useState<string>("drive_construtora");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (open) {
      setCategoria(link?.categoria ?? "drive_construtora");
      setTitulo(link?.titulo ?? "");
      setUrl(link?.url ?? "");
      setDescricao(link?.descricao ?? "");
    }
  }, [open, link]);

  const handleSave = async () => {
    if (!titulo.trim() || !url.trim()) return;
    await upsertLink.mutateAsync({
      id: link?.id,
      empreendimento_id: empreendimentoId,
      categoria,
      titulo: titulo.trim(),
      url: url.trim(),
      descricao: descricao.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{link ? "Editar link" : "Novo link"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Drive Construtora Casa Tua" />
          </div>
          <div>
            <Label htmlFor="url">URL</Label>
            <Input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!titulo.trim() || !url.trim() || upsertLink.isPending}>
            {upsertLink.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
