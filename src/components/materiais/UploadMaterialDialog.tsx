import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Upload, FileIcon, Image as ImageIcon, Video, FileText, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empreendimentoId: string;
}

const CATEGORIAS = [
  { value: "fotos", label: "Fotos" },
  { value: "videos", label: "Vídeos" },
  { value: "plantas", label: "Plantas" },
  { value: "tabela", label: "Tabela de preços" },
  { value: "book", label: "Book / Apresentação" },
  { value: "outros", label: "Outros" },
];

const MAX_SIZE_MB = 200;

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Video;
  if (mime === "application/pdf") return FileText;
  return FileIcon;
}

export function UploadMaterialDialog({ open, onOpenChange, empreendimentoId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("fotos");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setFile(null); setTitulo(""); setCategoria("fotos"); setProgress(0); setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: "Arquivo grande demais", description: `Máx ${MAX_SIZE_MB}MB.`, variant: "destructive" });
      return;
    }
    setFile(f);
    if (!titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
    if (f.type.startsWith("image/")) setCategoria("fotos");
    else if (f.type.startsWith("video/")) setCategoria("videos");
    else if (f.type === "application/pdf") setCategoria("plantas");
  };

  const upload = async () => {
    if (!file || !titulo.trim()) return;
    setUploading(true);
    setProgress(5);
    try {
      // 1. Ask edge function for signed upload URL
      const { data: signData, error: signErr } = await supabase.functions.invoke(
        "materiais-upload-sign",
        {
          body: {
            empreendimento_id: empreendimentoId,
            filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          },
        }
      );
      if (signErr) throw signErr;
      const { signed_url, storage_path, token } = signData as {
        signed_url?: string; storage_path: string; token?: string;
      };
      setProgress(15);

      // 2. Upload via storage client (uses returned token when present)
      let uploadOk = false;
      if (token) {
        const { error: upErr } = await supabase.storage
          .from("materiais-uhome")
          .uploadToSignedUrl(storage_path, token, file, { contentType: file.type });
        if (upErr) throw upErr;
        uploadOk = true;
      } else if (signed_url) {
        // Fallback: raw PUT with progress via XHR
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", signed_url);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(15 + Math.round((e.loaded / e.total) * 70));
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload ${xhr.status}`)));
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(file);
        });
        uploadOk = true;
      }
      if (!uploadOk) throw new Error("Sem URL de upload");
      setProgress(90);

      // 3. Insert row in materiais_links
      const { data: inserted, error: insErr } = await supabase
        .from("materiais_links" as any)
        .insert({
          empreendimento_id: empreendimentoId,
          categoria,
          titulo: titulo.trim(),
          url: "",
          storage_path,
          mime_type: file.type,
          size_bytes: file.size,
          origem: "upload",
          ingest_status: "pending",
          created_by: user?.id ?? null,
        } as any)
        .select("id")
        .single();
      if (insErr) throw insErr;

      // 4. Fire-and-forget ingest
      const newId = (inserted as any)?.id;
      if (newId) {
        supabase.functions.invoke("materiais-ingest", { body: { material_id: newId } })
          .catch((e) => console.warn("ingest failed", e));
      }

      setProgress(100);
      qc.invalidateQueries({ queryKey: ["materiais"] });
      toast({ title: "Material enviado" });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
      setUploading(false);
    }
  };

  const Icon = file ? fileIcon(file.type) : Upload;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!uploading) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar material</DialogTitle>
          <DialogDescription>
            Foto, vídeo, PDF ou planta. Máximo {MAX_SIZE_MB}MB.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 hover:bg-muted/40 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Clique para selecionar arquivo</span>
              <span className="text-xs text-muted-foreground">JPG, PNG, MP4, PDF...</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/30">
              <Icon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)}MB
                </p>
              </div>
              {!uploading && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          <div className="space-y-1.5">
            <Label htmlFor="upload-titulo">Título</Label>
            <Input
              id="upload-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Foto da fachada"
              disabled={uploading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="upload-categoria">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria} disabled={uploading}>
              <SelectTrigger id="upload-categoria"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {uploading && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center">{progress}%</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={upload} disabled={!file || !titulo.trim() || uploading}>
            {uploading ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
