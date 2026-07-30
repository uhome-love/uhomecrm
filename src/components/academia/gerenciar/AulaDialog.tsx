import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { readVideoDurationMinutes } from "@/lib/academiaMedia";

export interface AulaForm {
  titulo: string;
  descricao: string;
  tipo: string;
  duracao_minutos: number;
  xp_recompensa: number;
  ordem: number;
  youtube_url: string;
  vimeo_url: string;
  conteudo_html: string;
  storage_bucket: string;
  storage_key: string;
}

export const AULA_FORM_VAZIO: AulaForm = {
  titulo: "", descricao: "", tipo: "youtube", duracao_minutos: 10, xp_recompensa: 10, ordem: 1,
  youtube_url: "", vimeo_url: "", conteudo_html: "", storage_bucket: "", storage_key: "",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: AulaForm;
  setForm: (fn: (p: AulaForm) => AulaForm) => void;
  isEdit: boolean;
  moduloId: string | null;
  onSave: () => void;
}

export function AulaDialog({ open, onOpenChange, form, setForm, isEdit, moduloId, onSave }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bucket = form.tipo === "pdf" ? "academia-pdfs" : "academia-videos";

  const upload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop() || "bin";
    const key = `${moduloId || "geral"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(key, file, { contentType: file.type });
    if (error) {
      toast.error("Erro no upload: " + error.message);
    } else {
      const duracao = file.type.startsWith("video/") ? await readVideoDurationMinutes(file) : form.duracao_minutos;
      setForm(p => ({ ...p, storage_bucket: bucket, storage_key: key, duracao_minutos: duracao }));
      toast.success("Upload concluído!");
    }
    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Editar aula" : "Nova aula"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Título</Label><Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} /></div>
          <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">▶️ YouTube</SelectItem>
                  <SelectItem value="vimeo">▶️ Vimeo</SelectItem>
                  <SelectItem value="video_upload">▶️ Vídeo enviado</SelectItem>
                  <SelectItem value="pdf">📄 PDF</SelectItem>
                  <SelectItem value="texto">📝 Texto</SelectItem>
                  <SelectItem value="quiz">❓ Quiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Ordem</Label><Input type="number" value={form.ordem} onChange={e => setForm(p => ({ ...p, ordem: parseInt(e.target.value) || 1 }))} /></div>
          </div>

          {form.tipo === "youtube" && (
            <div><Label>URL do YouTube</Label><Input value={form.youtube_url} onChange={e => setForm(p => ({ ...p, youtube_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." /></div>
          )}
          {form.tipo === "vimeo" && (
            <div><Label>URL do Vimeo</Label><Input value={form.vimeo_url} onChange={e => setForm(p => ({ ...p, vimeo_url: e.target.value }))} placeholder="https://vimeo.com/..." /></div>
          )}

          {(form.tipo === "video_upload" || form.tipo === "pdf") && (
            <div>
              <Label>{form.tipo === "pdf" ? "Arquivo PDF" : "Arquivo de vídeo"}</Label>
              <div
                onClick={() => !uploading && inputRef.current?.click()}
                className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                ) : form.storage_key ? (
                  <p className="text-xs text-emerald-600">✅ Arquivo enviado — clique para trocar</p>
                ) : (
                  <>
                    <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Clique para escolher o arquivo</p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept={form.tipo === "pdf" ? "application/pdf" : "video/mp4,video/webm,video/quicktime"}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
                />
              </div>
            </div>
          )}

          {form.tipo === "texto" && (
            <div>
              <Label>Conteúdo (HTML)</Label>
              <Textarea value={form.conteudo_html} onChange={e => setForm(p => ({ ...p, conteudo_html: e.target.value }))} rows={8} placeholder="<h2>Título</h2><p>Conteúdo da aula...</p>" />
            </div>
          )}
          {form.tipo === "quiz" && !isEdit && (
            <p className="text-xs text-muted-foreground">Após criar a aula, use o botão "❓ Quiz" para adicionar perguntas.</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Duração (min)</Label><Input type="number" value={form.duracao_minutos} onChange={e => setForm(p => ({ ...p, duracao_minutos: parseInt(e.target.value) || 10 }))} /></div>
            <div><Label>XP recompensa</Label><Input type="number" value={form.xp_recompensa} onChange={e => setForm(p => ({ ...p, xp_recompensa: parseInt(e.target.value) || 10 }))} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={onSave}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
