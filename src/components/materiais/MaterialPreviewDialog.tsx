import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Download } from "lucide-react";
import type { MaterialLink } from "@/hooks/useMateriais";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: MaterialLink | null;
}

type Kind = "image" | "video" | "pdf" | "audio" | "external" | "unsupported";

function detectKind(link: MaterialLink | null): Kind {
  if (!link) return "unsupported";
  const mime = (link.mime_type || "").toLowerCase();
  if (!link.storage_path) return "external";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  // fallback pela extensão do path
  const ext = link.storage_path.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  if (ext && ["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) return "image";
  if (ext && ["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (ext && ["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  return "unsupported";
}

export function MaterialPreviewDialog({ open, onOpenChange, link }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const kind = detectKind(link);

  useEffect(() => {
    let cancelled = false;
    if (!open || !link) {
      setSignedUrl(null);
      return;
    }
    if (!link.storage_path) {
      setSignedUrl(link.url ?? null);
      return;
    }
    setLoading(true);
    setSignedUrl(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("materiais-signed-read", {
          body: { storage_path: link.storage_path, material_id: link.id },
        });
        if (error) throw error;
        const url = (data as any)?.url || (data as any)?.signed_url;
        if (!cancelled) setSignedUrl(url ?? null);
      } catch (e: any) {
        if (!cancelled) toast({ title: "Erro no preview", description: e.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, link]);

  const download = async () => {
    if (!link?.storage_path) {
      if (link?.url) window.open(link.url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("materiais-signed-read", {
        body: { storage_path: link.storage_path, material_id: link.id, download: true, filename: link.titulo },
      });
      if (error) throw error;
      const url = (data as any)?.url || (data as any)?.signed_url;
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener noreferrer";
        a.click();
      }
    } catch (e: any) {
      toast({ title: "Erro ao baixar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base truncate">{link?.titulo ?? ""}</DialogTitle>
              {link?.descricao && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{link.descricao}</p>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {signedUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(signedUrl, "_blank", "noopener,noreferrer")}
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
              {link?.storage_path && (
                <Button variant="outline" size="sm" onClick={download} title="Baixar">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-[300px] bg-muted/30 flex items-center justify-center overflow-auto">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : !signedUrl ? (
            <p className="text-sm text-muted-foreground">Sem preview disponível.</p>
          ) : kind === "image" ? (
            <img src={signedUrl} alt={link?.titulo ?? ""} className="max-w-full max-h-[75vh] object-contain" />
          ) : kind === "video" ? (
            <video src={signedUrl} controls className="max-w-full max-h-[75vh]" />
          ) : kind === "audio" ? (
            <audio src={signedUrl} controls className="w-full max-w-lg" />
          ) : kind === "pdf" ? (
            <iframe
              src={signedUrl}
              title={link?.titulo ?? "PDF"}
              className="w-full h-[75vh] border-0 bg-background"
            />
          ) : kind === "external" ? (
            <div className="text-center p-6 space-y-3">
              <p className="text-sm text-muted-foreground">Link externo — abra em nova aba para visualizar.</p>
              <Button onClick={() => window.open(signedUrl, "_blank", "noopener,noreferrer")}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir link
              </Button>
            </div>
          ) : (
            <div className="text-center p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Preview não suportado para este tipo{link?.mime_type ? ` (${link.mime_type})` : ""}.
              </p>
              <Button variant="outline" onClick={download}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar arquivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
