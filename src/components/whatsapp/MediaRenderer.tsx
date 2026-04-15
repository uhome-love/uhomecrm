import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileText, Download, Film } from "lucide-react";

interface MediaRendererProps {
  mediaUrl: string;
  body?: string | null;
  direction: string;
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const AUDIO_EXTS = [".ogg", ".mp3", ".m4a", ".wav", ".opus", ".oga"];
const VIDEO_EXTS = [".mp4", ".3gp", ".webm", ".mov"];
const DOC_EXTS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".txt"];

function getExtension(url: string): string {
  try {
    const path = new URL(url).pathname;
    const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
    return ext || "";
  } catch {
    const ext = url.substring(url.lastIndexOf(".")).split("?")[0].toLowerCase();
    return ext || "";
  }
}

function getMediaType(url: string): "image" | "audio" | "video" | "document" | "unknown" {
  const ext = getExtension(url);
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (AUDIO_EXTS.includes(ext)) return "audio";
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (DOC_EXTS.includes(ext)) return "document";
  // Check common patterns in URLs
  if (/image/i.test(url)) return "image";
  if (/audio|voice|ptt/i.test(url)) return "audio";
  if (/video/i.test(url)) return "video";
  return "unknown";
}

function getFileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.substring(path.lastIndexOf("/") + 1) || "arquivo";
  } catch {
    return "arquivo";
  }
}

export default function MediaRenderer({ mediaUrl, body, direction }: MediaRendererProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const type = getMediaType(mediaUrl);
  const isSent = direction === "sent";

  return (
    <div className="space-y-1">
      {type === "image" && (
        <>
          <img
            src={mediaUrl}
            alt="Mídia"
            className="max-w-[240px] max-h-[240px] rounded cursor-pointer object-cover hover:opacity-90 transition-opacity"
            onClick={() => setLightboxOpen(true)}
            loading="lazy"
          />
          <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center bg-black/95 border-none">
              <img
                src={mediaUrl}
                alt="Mídia ampliada"
                className="max-w-full max-h-[85vh] object-contain rounded"
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      {type === "audio" && (
        <audio controls preload="none" className="max-w-[240px] h-8">
          <source src={mediaUrl} />
          Seu navegador não suporta áudio.
        </audio>
      )}

      {type === "video" && (
        <div className="relative">
          <video
            controls
            preload="none"
            className="max-w-[240px] max-h-[200px] rounded"
          >
            <source src={mediaUrl} />
            Seu navegador não suporta vídeo.
          </video>
        </div>
      )}

      {type === "document" && (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs transition-colors ${
            isSent
              ? "border-primary-foreground/30 hover:bg-primary-foreground/10"
              : "border-border hover:bg-muted"
          }`}
        >
          <FileText size={16} className="shrink-0" />
          <span className="truncate max-w-[160px]">{getFileName(mediaUrl)}</span>
          <Download size={12} className="shrink-0 ml-auto" />
        </a>
      )}

      {type === "unknown" && (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs transition-colors ${
            isSent
              ? "border-primary-foreground/30 hover:bg-primary-foreground/10"
              : "border-border hover:bg-muted"
          }`}
        >
          <Film size={16} className="shrink-0" />
          <span className="text-xs">📎 Mídia</span>
          <Download size={12} className="shrink-0 ml-auto" />
        </a>
      )}

      {body && <p className="mt-0.5">{body}</p>}
    </div>
  );
}
