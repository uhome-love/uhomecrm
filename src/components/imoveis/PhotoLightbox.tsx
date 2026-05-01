import React, { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  images: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

const PhotoLightboxInner = forwardRef<HTMLDivElement, PhotoLightboxProps>(function PhotoLightboxInner(
  { images, initialIndex, open, onClose },
  _ref,
) {
  const [current, setCurrent] = useState(initialIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  useEffect(() => { setCurrent(initialIndex); }, [initialIndex]);

  const goTo = useCallback((idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(idx);
    setTimeout(() => setIsTransitioning(false), 250);
  }, [isTransitioning]);

  // ── Keyboard: Arrow L/R for photos, Escape to close ──
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      // Stop other handlers (e.g. drawer prev/next) from firing
      e.stopImmediatePropagation();
      if (e.key === "ArrowLeft") goTo((current - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight") goTo((current + 1) % images.length);
      else if (e.key === "Escape") onClose();
    };
    // Use capture phase so we intercept before drawer's handler
    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      document.body.style.overflow = "";
    };
  }, [open, current, images.length, goTo, onClose]);

  // ── Touch/Swipe for mobile photo navigation ──
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);
  const SWIPE_THRESHOLD = 50;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    touchRef.current = null;
    // Only horizontal swipes
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) goTo((current + 1) % images.length);
    else goTo((current - 1 + images.length) % images.length);
  }, [current, images.length, goTo]);

  // Minimal fallback URL upgrade for edge cases
  const toHighRes = (url: string) => url.replace(/\/thumb\//i, "/large/").replace(/_thumb\./i, ".");

  if (!open || images.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black select-none"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 rounded-full p-2.5 text-white backdrop-blur-sm transition-all"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-50 text-white/70 text-sm font-medium tabular-nums">
        {current + 1} / {images.length}
      </div>

      {/* Main image */}
      <div
        className="flex items-center justify-center h-full px-4 sm:px-8 pt-14 pb-24"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={toHighRes(images[current])}
            alt={`Foto ${current + 1}`}
            className="max-w-[95vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl transition-opacity duration-250"
            style={{ opacity: isTransitioning ? 0.5 : 1 }}
            draggable={false}
          />
        </div>
      </div>

      {/* Navigation arrows (desktop) */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goTo((current - 1 + images.length) % images.length); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-50 bg-white/10 hover:bg-white/25 backdrop-blur-md rounded-full p-3 text-white transition-all hover:scale-110 hidden sm:flex"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goTo((current + 1) % images.length); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-50 bg-white/10 hover:bg-white/25 backdrop-blur-md rounded-full p-3 text-white transition-all hover:scale-110 hidden sm:flex"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-10 pb-4 px-4"
          onClick={(e) => e.stopPropagation()}
        >
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
      )}
    </div>,
    document.body
  );
}

const PhotoLightbox = React.memo(PhotoLightboxInner);
export default PhotoLightbox;
