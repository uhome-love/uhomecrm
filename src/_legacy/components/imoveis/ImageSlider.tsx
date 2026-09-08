import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageSliderProps {
  images: string[];
  alt: string;
}

function ImageSliderInner({ images, alt }: ImageSliderProps) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) return (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <Home className="h-10 w-10 text-muted-foreground/30" />
    </div>
  );
  return (
    <div className="w-full h-full relative group">
      <img src={images[current]} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p - 1 + images.length) % images.length); }} className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/95 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p + 1) % images.length); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/95 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm" aria-label="Próxima"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {images.slice(0, 6).map((_, i) => <span key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === current ? "bg-white scale-125" : "bg-white/50")} />)}
            {images.length > 6 && <span className="text-[8px] text-white/80 ml-0.5">+{images.length - 6}</span>}
          </div>
        </>
      )}
      <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        {current + 1}/{images.length}
      </div>
    </div>
  );
}

const ImageSlider = React.memo(ImageSliderInner);
export default ImageSlider;
