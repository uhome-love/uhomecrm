import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

interface ShowcaseLightboxProps {
  lightbox: { fotos: string[]; idx: number } | null;
  onClose: () => void;
  onChange: (lb: { fotos: string[]; idx: number }) => void;
}

export default function ShowcaseLightbox({ lightbox, onClose, onChange }: ShowcaseLightboxProps) {
  if (!lightbox) return null;

  return (
    <AnimatePresence>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-5xl p-0 bg-black/95 border-none rounded-2xl overflow-hidden">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative">
            <img src={lightbox.fotos[lightbox.idx]} alt="" className="w-full max-h-[85vh] object-contain" />
            <button onClick={onClose}
              className="absolute top-4 right-4 bg-white/10 backdrop-blur-sm text-white rounded-full p-2 hover:bg-white/20 transition-colors">
              <X className="h-5 w-5" />
            </button>
            {lightbox.fotos.length > 1 && (
              <>
                <button onClick={() => onChange({ ...lightbox, idx: (lightbox.idx - 1 + lightbox.fotos.length) % lightbox.fotos.length })}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white rounded-full p-3 hover:bg-white/20 transition-colors">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button onClick={() => onChange({ ...lightbox, idx: (lightbox.idx + 1) % lightbox.fotos.length })}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white rounded-full p-3 hover:bg-white/20 transition-colors">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white rounded-full px-4 py-1.5 text-sm font-medium">
              {lightbox.idx + 1} / {lightbox.fotos.length}
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </AnimatePresence>
  );
}
