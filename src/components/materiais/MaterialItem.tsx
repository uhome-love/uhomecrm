import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Copy, Sparkles, ExternalLink, Pencil, Trash2, RefreshCw } from "lucide-react";
import type { MaterialLink } from "@/hooks/useMateriais";
import { getCategoriaInfo } from "./CategoriaIcon";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const PREVIEWABLE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "avif", "mp4", "webm", "mov", "m4v", "pdf", "mp3", "wav", "ogg", "m4a"];

export const isImage = (link: MaterialLink) => {
  const m = (link.mime_type || "").toLowerCase();
  if (m.startsWith("image/")) return true;
  const ext = link.storage_path?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return !!ext && ["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext);
};

export const isVideo = (link: MaterialLink) => {
  const m = (link.mime_type || "").toLowerCase();
  if (m.startsWith("video/")) return true;
  const ext = link.storage_path?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return !!ext && ["mp4", "webm", "mov", "m4v"].includes(ext);
};

export const isPreviewable = (link: MaterialLink) => {
  if (!link.storage_path) return false;
  const m = (link.mime_type || "").toLowerCase();
  if (m.startsWith("image/") || m.startsWith("video/") || m.startsWith("audio/") || m === "application/pdf") return true;
  const ext = link.storage_path.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return !!ext && PREVIEWABLE_EXTS.includes(ext);
};

interface Props {
  link: MaterialLink;
  canEdit: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onFollowUp: () => void;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReprocess?: () => void;
}

export function MaterialItem({
  link,
  canEdit,
  onCopy,
  onDownload,
  onFollowUp,
  onOpen,
  onEdit,
  onDelete,
  onReprocess,
}: Props) {
  const info = getCategoriaInfo(link.categoria);
  const Icon = info.icon;
  const hasFile = !!link.storage_path;
  const [thumb, setThumb] = useState<string | null>(null);

  // Thumbnail para imagens (URL assinada rápida).
  useEffect(() => {
    let alive = true;
    if (isImage(link) && link.storage_path) {
      (async () => {
        try {
          const { data } = await supabase.functions.invoke("materiais-signed-read", {
            body: { storage_path: link.storage_path, material_id: link.id, download: false },
          });
          const url = (data as any)?.url || (data as any)?.signed_url;
          if (alive && url) setThumb(url);
        } catch {
          /* fallback ícone */
        }
      })();
    }
    return () => { alive = false; };
  }, [link.id]);

  const metaLine = (() => {
    const parts: string[] = [];
    const ext = link.storage_path?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toUpperCase();
    if (ext) parts.push(ext);
    else if (link.mime_type) parts.push(link.mime_type.split("/")[1]?.toUpperCase() ?? "");
    else if (!link.storage_path && link.url) parts.push("LINK");
    if (link.size_bytes) {
      const kb = link.size_bytes / 1024;
      parts.push(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`);
    }
    return parts.filter(Boolean).join(" · ");
  })();

  return (
    <div className="group rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all flex flex-col">
      {/* Thumbnail */}
      <button
        type="button"
        onClick={onOpen}
        className="relative h-32 w-full bg-muted/40 flex items-center justify-center overflow-hidden"
      >
        {thumb ? (
          <img src={thumb} alt={link.titulo} className="h-full w-full object-cover" loading="lazy" />
        ) : isVideo(link) ? (
          <div className="flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          </div>
        ) : (
          <Icon className="h-8 w-8 text-muted-foreground/60" />
        )}
        {/* chip categoria */}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-background/90 backdrop-blur text-foreground border border-border/60">
          {info.label}
        </span>
        {link.ingest_status === "processing" && (
          <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground" title="Processando IA">⏳ IA</span>
        )}
        {link.ingest_status === "done" && (link.tags?.length ?? 0) > 0 && (
          <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary" title="Indexado pelo HOMI">✨ HOMI</span>
        )}
      </button>

      {/* Corpo */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div>
          <h4 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 min-h-[2.5rem]">
            {link.titulo}
          </h4>
          {metaLine && (
            <p className="text-[11px] text-muted-foreground mt-1">{metaLine}</p>
          )}
        </div>

        {/* Ações principais */}
        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={onCopy}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
          </Button>
          {hasFile ? (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Baixar"
              onClick={onDownload}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Abrir link"
              onClick={onOpen}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-primary border-primary/40 hover:bg-primary/10"
            title="Gerar mensagem de follow-up com IA"
            onClick={onFollowUp}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Gestão */}
        {canEdit && (
          <div className="flex items-center gap-0.5 pt-1 -mb-1 border-t border-border/40 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onReprocess && link.storage_path && (link.ingest_status === "error" || link.ingest_status === "done") && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Reprocessar IA" onClick={onReprocess}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 text-destructive hover:text-destructive ml-auto")}
                title="Excluir"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
