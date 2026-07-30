import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fileNameToTitle, readVideoDurationMinutes } from "@/lib/academiaMedia";

interface Props {
  moduloId: string;
  ordemInicial: number;
  onCreateAula: (payload: any) => Promise<any>;
}

interface FilaItem {
  nome: string;
  status: "aguardando" | "enviando" | "ok" | "erro";
  erro?: string;
}

const MAX_MB = 500;

/** Área de arrastar-e-soltar: cada vídeo vira uma aula do módulo. */
export function AulaDropzone({ moduloId, ordemInicial, onCreateAula }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [enviando, setEnviando] = useState(false);

  const processar = async (files: File[]) => {
    const validos = files.filter(f => f.type.startsWith("video/"));
    if (validos.length === 0) {
      toast.error("Envie arquivos de vídeo (MP4, WEBM ou MOV)");
      return;
    }
    setEnviando(true);
    setFila(validos.map(f => ({ nome: f.name, status: "aguardando" as const })));

    for (let i = 0; i < validos.length; i++) {
      const file = validos[i];
      setFila(prev => prev.map((it, idx) => (idx === i ? { ...it, status: "enviando" } : it)));

      if (file.size > MAX_MB * 1024 * 1024) {
        setFila(prev => prev.map((it, idx) => (idx === i ? { ...it, status: "erro", erro: `maior que ${MAX_MB}MB` } : it)));
        continue;
      }

      const duracao = await readVideoDurationMinutes(file);
      const ext = file.name.split(".").pop() || "mp4";
      const key = `${moduloId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage.from("academia-videos").upload(key, file, {
        contentType: file.type,
        upsert: false,
      });

      if (error) {
        setFila(prev => prev.map((it, idx) => (idx === i ? { ...it, status: "erro", erro: error.message } : it)));
        continue;
      }

      await onCreateAula({
        trilha_id: moduloId,
        titulo: fileNameToTitle(file.name),
        tipo: "video_upload",
        duracao_minutos: duracao,
        xp_recompensa: 10,
        ordem: ordemInicial + i,
        conteudo: { storage_bucket: "academia-videos", storage_key: key },
      });

      setFila(prev => prev.map((it, idx) => (idx === i ? { ...it, status: "ok" } : it)));
    }

    setEnviando(false);
    setTimeout(() => setFila([]), 4000);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const files = Array.from(e.dataTransfer.files || []);
          if (files.length) processar(files);
        }}
        onClick={() => !enviando && inputRef.current?.click()}
        className={cn(
          "rounded-lg border-2 border-dashed p-5 text-center cursor-pointer transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        {enviando ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
        ) : (
          <>
            <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">Arraste vídeos aqui ou clique para enviar</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              MP4, WEBM ou MOV · até {MAX_MB}MB cada · cada vídeo vira uma aula
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || []);
            if (files.length) processar(files);
            e.target.value = "";
          }}
        />
      </div>

      {fila.length > 0 && (
        <ul className="space-y-1">
          {fila.map((f, i) => (
            <li key={i} className="text-[11px] flex items-center gap-2">
              <span className="truncate flex-1">{f.nome}</span>
              {f.status === "aguardando" && <span className="text-muted-foreground">na fila</span>}
              {f.status === "enviando" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              {f.status === "ok" && <span className="text-emerald-600">✅ aula criada</span>}
              {f.status === "erro" && <span className="text-destructive">erro: {f.erro}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
