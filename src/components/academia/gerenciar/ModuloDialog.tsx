import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIAS } from "@/hooks/useAcademia";
import { TrilhaCapaUpload } from "@/components/academia/TrilhaCapaUpload";

export interface ModuloForm {
  titulo: string;
  descricao: string;
  categoria: string;
  nivel: string;
  publicada: boolean;
  visibilidade: string;
  thumbnail_url: string;
}

export const MODULO_FORM_VAZIO: ModuloForm = {
  titulo: "", descricao: "", categoria: "tecnicas_vendas", nivel: "iniciante",
  publicada: false, visibilidade: "todos", thumbnail_url: "",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: ModuloForm;
  setForm: (fn: (p: ModuloForm) => ModuloForm) => void;
  isEdit: boolean;
  onSave: () => void;
}

export function ModuloDialog({ open, onOpenChange, form, setForm, isEdit, onSave }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Editar módulo" : "Novo módulo"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Título</Label><Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex.: Call Center" /></div>
          <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></div>

          <TrilhaCapaUpload value={form.thumbnail_url} onChange={v => setForm(p => ({ ...p, thumbnail_url: v }))} />

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nível</Label>
              <Select value={form.nivel} onValueChange={v => setForm(p => ({ ...p, nivel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Visibilidade</Label>
              <Select value={form.visibilidade} onValueChange={v => setForm(p => ({ ...p, visibilidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="corretores">Só corretores</SelectItem>
                  <SelectItem value="gerentes">Só gerentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.publicada} onCheckedChange={v => setForm(p => ({ ...p, publicada: v }))} />
              <Label>Publicado</Label>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={onSave}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
