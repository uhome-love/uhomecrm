import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

interface AvaturnCreatorModalProps {
  open: boolean;
  onClose: () => void;
  onAvatarCreated: (avatarUrl: string, previewUrl: string) => void;
}

export default function AvaturnCreatorModal({ open, onClose, onAvatarCreated }: AvaturnCreatorModalProps) {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    // Avaturn sends export events via postMessage
    if (event.data?.source === 'avaturn' || event.data?.type === 'export') {
      const avatarUrl = event.data?.url || event.data?.avatarUrl;
      const previewUrl = event.data?.previewUrl || event.data?.screenshot || "";

      if (avatarUrl) {
        onAvatarCreated(avatarUrl, previewUrl);
        onClose();
      }
    }
  }, [onAvatarCreated, onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open, handleMessage]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-4xl w-[95vw] p-0 gap-0 overflow-hidden"
        style={{ height: "85vh", background: "#0A0F1E" }}
      >
        <DialogHeader className="px-4 py-3 flex flex-row items-center justify-between border-b border-white/10">
          <DialogTitle className="text-white text-base font-semibold flex items-center gap-2">
            🎮 Criar Avatar 3D
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="relative flex-1" style={{ height: "calc(85vh - 56px)" }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                <p className="text-white/60 text-sm">Carregando criador de avatar...</p>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src="https://hub.avaturn.me"
            allow="camera"
            onLoad={() => setLoading(false)}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              borderRadius: "0 0 12px 12px",
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
