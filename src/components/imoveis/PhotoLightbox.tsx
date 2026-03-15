import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  images: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

function PhotoLightboxInner({ images, initialIndex, open, onClose }: PhotoLightboxProps) {
  const [current, setCurrent] = useState(initialIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  useEffect(() => { setCurrent(initialIndex); }, [initialIndex]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo((current - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight") goTo((current + 1) % images.length);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, current, images.length]);

  const goTo = (idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(idx);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Images passed in should already be high-res from getPropertyFullscreenImages
  // Keep a minimal fallback for edge cases where thumbs leak through
  const toHighRes = (url: string) => url.replace(/\/thumb\//i, "/large/").replace(/_thumb\./i, ".");

  if (!open || images.length === 0) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 rounded-full p-2.5 text-white backdrop-blur-sm transition-all">
        <X className="h-5 w-5" />
      </button>
      <div className="absolute top-4 left-4 z-50 text-white/70 text-sm font-medium">
        {current + 1} / {images.length}
      </div>
      <div className="flex items-center justify-center h-full px-4 sm:px-8 pt-14 pb-24" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={toHighRes(images[current])}
            alt={`Foto ${current + 1}`}
            className="max-w-[95vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl transition-opacity duration-300"
            style={{ opacity: isTransitioning ? 0.6 : 1 }}
            draggable={false}
          />
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goTo((current - 1 + images.length) % images.length); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-50 bg-white/10 hover:bg-white/25 backdrop-blur-md rounded-full p-3 text-white transition-all hover:scale-110"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goTo((current + 1) % images.length); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-50 bg-white/10 hover:bg-white/25 backdrop-blur-md rounded-full p-3 text-white transition-all hover:scale-110"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-10 pb-4 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2 overflow-x-auto max-w-3xl mx-auto scrollbar-hide">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200",
                i === current
                  ? "border-white w-16 h-12 opacity-100 scale-105"
                  : "border-transparent w-14 h-10 opacity-40 hover:opacity-70 hover:border-white/30"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

const PhotoLightbox = React.memo(PhotoLightboxInner);
export default PhotoLightbox;
