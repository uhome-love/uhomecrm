import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Upload de capa (pôster 2:3) da trilha.
 * Armazenado no bucket público `materiais`, prefixo `academia-capas/`.
 */
export function TrilhaCapaUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Use JPG, PNG ou WEBP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo maior que 2MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `academia-capas/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("materiais").upload(path, file, { upsert: false });
    if (error) {
      toast.error("Erro no upload: " + error.message);
    } else {
      const { data } = supabase.storage.from("materiais").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Capa enviada!");
    }
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <Label>Capa da trilha <span className="text-muted-foreground font-normal">(pôster 640x960px · JPG/PNG · até 2MB)</span></Label>
      <div className="flex gap-3 items-start">
        <div className="w-[110px] aspect-[2/3] rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
          {value ? (
            <img src={value} alt="Pré-visualização da capa" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-muted-foreground text-center px-2">Sem capa<br />(gradiente)</span>
          )}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex-1 min-h-[110px] rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors",
            "flex flex-col items-center justify-center gap-2 text-center",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Arraste a imagem aqui ou clique para escolher</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
          />
        </div>
      </div>
      {value && (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => onChange("")}>
          <X className="h-3.5 w-3.5" /> Remover capa
        </Button>
      )}
    </div>
  );
}
