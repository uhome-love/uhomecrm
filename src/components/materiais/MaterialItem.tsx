import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Download, Copy, ExternalLink, Pencil, Trash2, RefreshCw, MoreVertical, Eye,
  Image as ImageIcon, Video as VideoIcon, FileText, Music, Link2,
} from "lucide-react";
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

export const isPdf = (link: MaterialLink) => {
  if ((link.mime_type || "").toLowerCase() === "application/pdf") return true;
  return link.storage_path?.toLowerCase().endsWith(".pdf") ?? false;
};

export const isAudio = (link: MaterialLink) => {
  const m = (link.mime_type || "").toLowerCase();
  if (m.startsWith("audio/")) return true;
  const ext = link.storage_path?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return !!ext && ["mp3", "wav", "ogg", "m4a"].includes(ext);
};

export const isExternalLink = (link: MaterialLink) => !link.storage_path;

export type MediaKind = "image" | "video" | "pdf" | "audio" | "link" | "other";

export function getMediaKind(link: MaterialLink): MediaKind {
  if (isImage(link)) return "image";
  if (isVideo(link)) return "video";
  if (isPdf(link)) return "pdf";
  if (isAudio(link)) return "audio";
  if (isExternalLink(link)) return "link";
  return "other";
}

const KIND_META: Record<MediaKind, { label: string; icon: any; color: string; bg: string }> = {
  image: { label: "Imagem", icon: ImageIcon, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  video: { label: "Vídeo",  icon: VideoIcon, color: "text-rose-600",    bg: "bg-rose-500/10" },
  pdf:   { label: "PDF",    icon: FileText,  color: "text-red-600",     bg: "bg-red-500/10" },
  audio: { label: "Áudio",  icon: Music,     color: "text-purple-600",  bg: "bg-purple-500/10" },
  link:  { label: "Link",   icon: Link2,     color: "text-blue-600",    bg: "bg-blue-500/10" },
  other: { label: "Arquivo",icon: FileText,  color: "text-muted-foreground", bg: "bg-muted" },
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
  onOpen,
  onEdit,
  onDelete,
  onReprocess,
}: Props) {
  const info = getCategoriaInfo(link.categoria);
  const kind = getMediaKind(link);
  const kindMeta = KIND_META[kind];
  const KindIcon = kindMeta.icon;
  const hasFile = !!link.storage_path;
  const previewable = isPreviewable(link);
  const [thumb, setThumb] = useState<string | null>(null);

  // Thumbnail somente para imagens.
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
        } catch { /* fallback ícone */ }
      })();
    }
    return () => { alive = false; };
  }, [link.id]);

  const metaParts: string[] = [];
  const ext = link.storage_path?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toUpperCase();
  if (ext) metaParts.push(ext);
  else if (!hasFile) metaParts.push("LINK");
  if (link.size_bytes) {
    const kb = link.size_bytes / 1024;
    metaParts.push(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`);
  }
  metaParts.push(info.label);
  const metaLine = metaParts.filter(Boolean).join(" · ");

  // Botão principal: Abrir (preview) > Baixar > Abrir link externo.
  const primary = previewable
    ? { label: "Abrir", icon: Eye, onClick: onOpen, title: "Pré-visualizar" }
    : hasFile
    ? { label: "Baixar", icon: Download, onClick: onDownload, title: "Baixar arquivo" }
    : { label: "Abrir link", icon: ExternalLink, onClick: onOpen, title: "Abrir link externo" };
  const PrimaryIcon = primary.icon;

  return (
    <div className="group flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent hover:border-border/60 hover:bg-muted/40 transition-colors">
      {/* Thumbnail / ícone */}
      <button
        type="button"
        onClick={primary.onClick}
        className={cn(
          "relative h-12 w-12 flex-shrink-0 rounded-md overflow-hidden flex items-center justify-center",
          kindMeta.bg,
        )}
        title={primary.title}
      >
        {thumb ? (
          <img src={thumb} alt={link.titulo} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <KindIcon className={cn("h-5 w-5", kindMeta.color)} />
        )}
      </button>

      {/* Título + meta */}
      <button
        type="button"
        onClick={primary.onClick}
        className="flex-1 min-w-0 text-left"
      >
        <h4 className="font-medium text-sm text-foreground leading-snug line-clamp-2">
          {link.titulo}
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {metaLine}
          {link.ingest_status === "processing" && <span className="ml-1.5">· ⏳ IA</span>}
          {link.ingest_status === "done" && (link.tags?.length ?? 0) > 0 && (
            <span className="ml-1.5 text-primary">· ✨ HOMI</span>
          )}
        </p>
      </button>

      {/* Ações — desktop */}
      <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
        <Button size="sm" variant="default" className="h-8 text-xs" onClick={primary.onClick} title={primary.title}>
          <PrimaryIcon className="h-3.5 w-3.5 mr-1.5" /> {primary.label}
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" title="Copiar link" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {previewable && hasFile && (
                <DropdownMenuItem onClick={onDownload}>
                  <Download className="h-3.5 w-3.5 mr-2" /> Baixar
                </DropdownMenuItem>
              )}
              {onReprocess && link.storage_path && (link.ingest_status === "error" || link.ingest_status === "done") && (
                <DropdownMenuItem onClick={onReprocess}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Reprocessar IA
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Ações — mobile */}
      <div className="flex sm:hidden items-center gap-1 flex-shrink-0">
        <Button size="sm" variant="default" className="h-8 text-xs" onClick={primary.onClick} title={primary.title}>
          <PrimaryIcon className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Copiar link
            </DropdownMenuItem>
            {previewable && hasFile && (
              <DropdownMenuItem onClick={onDownload}>
                <Download className="h-3.5 w-3.5 mr-2" /> Baixar
              </DropdownMenuItem>
            )}
            {canEdit && (
              <>
                <DropdownMenuSeparator />
                {onReprocess && link.storage_path && (link.ingest_status === "error" || link.ingest_status === "done") && (
                  <DropdownMenuItem onClick={onReprocess}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Reprocessar IA
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
