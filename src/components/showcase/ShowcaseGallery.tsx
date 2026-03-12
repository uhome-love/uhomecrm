import { Maximize } from "lucide-react";
import { motion } from "framer-motion";

interface ShowcaseGalleryProps {
  fotos: string[];
  onOpen: (fotos: string[], idx: number) => void;
  title?: string;
}

export default function ShowcaseGallery({ fotos, onOpen, title = "Galeria" }: ShowcaseGalleryProps) {
  if (fotos.length <= 1) return null;

  return (
    <section className="bg-slate-50 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">{title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {fotos.map((foto, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="aspect-[4/3] rounded-xl overflow-hidden cursor-pointer group relative"
                onClick={() => onOpen(fotos, i)}
              >
                <img src={foto} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Maximize className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
