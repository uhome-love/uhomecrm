import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ShowcaseHeroProps {
  fotos: string[];
  cor: string;
  /** Full-bleed immersive hero (product_page) vs shorter hero */
  variant?: "immersive" | "compact";
  children?: React.ReactNode;
}

export default function ShowcaseHero({ fotos, cor, variant = "immersive", children }: ShowcaseHeroProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (fotos.length <= 1) return;
    const interval = setInterval(() => setCurrent(c => (c + 1) % fotos.length), 5000);
    return () => clearInterval(interval);
  }, [fotos.length]);

  const heightClass = variant === "immersive" ? "h-[70vh] sm:h-[80vh]" : "h-[50vh] sm:h-[60vh]";

  return (
    <section className={`relative ${heightClass} overflow-hidden`}>
      {/* Carousel */}
      {fotos.length > 0 ? (
        <AnimatePresence mode="wait">
          <motion.img
            key={current}
            src={fotos[current]}
            alt=""
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}99)` }}>
          <Building2 className="h-20 w-20 text-white/20" />
        </div>
      )}

      {/* Navigation */}
      {fotos.length > 1 && (
        <>
          <button
            onClick={() => setCurrent((current - 1 + fotos.length) % fotos.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-md text-white rounded-full p-3 hover:bg-white/20 transition-all z-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrent((current + 1) % fotos.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-md text-white rounded-full p-3 hover:bg-white/20 transition-all z-10"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {fotos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-white" : "w-2 bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10 z-[1]" />
      <div className="absolute inset-0 z-[1]" style={{ background: `linear-gradient(135deg, ${cor}40 0%, transparent 60%)` }} />

      {/* Content overlay */}
      {children && <div className="absolute inset-0 z-10">{children}</div>}
    </section>
  );
}
