import { Phone, ArrowRight, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import type { ShowcaseCorretor } from "./types";

type CTAVariant = "product" | "campaign" | "selection";

interface ContactCTAProps {
  corretor: ShowcaseCorretor;
  cor: string;
  whatsappLink: string | null;
  variant?: CTAVariant;
}

const variantConfig = {
  product: {
    heading: "Interessado?",
    subtext: (nome: string) => `Fale agora com ${nome} e agende uma visita.`,
    cta: "Falar pelo WhatsApp",
    bgStyle: (cor: string) => ({ background: `linear-gradient(135deg, ${cor}, ${cor}dd)` }),
    overlayStyle: () => ({
      backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)"
    }),
  },
  campaign: {
    heading: "Gostou de alguma oferta?",
    subtext: (nome: string) => `Fale agora com ${nome} e aproveite as condições exclusivas do Melnick Day!`,
    cta: "Falar pelo WhatsApp",
    bgStyle: () => ({
      background: "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 30%, #fefce8 70%, #fffbeb 100%)",
    }),
    overlayStyle: () => ({
      backgroundImage: "radial-gradient(circle at 2px 2px, #1e40af 1px, transparent 0)",
      backgroundSize: "40px 40px",
    }),
  },
  selection: {
    heading: "Gostou de algum imóvel?",
    subtext: (nome: string) => `Fale com ${nome} para agendar uma visita ou tirar suas dúvidas.`,
    cta: "Falar pelo WhatsApp",
    bgStyle: () => ({
      background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
    }),
    overlayStyle: () => ({}),
  },
};

export default function ContactCTA({ corretor, cor, whatsappLink, variant = "product" }: ContactCTAProps) {
  const config = variantConfig[variant];
  const isLight = variant !== "product";

  return (
    <section className="relative overflow-hidden py-16 sm:py-20">
      <div className="absolute inset-0" style={config.bgStyle(cor)} />
      <div className="absolute inset-0 opacity-[0.03]" style={config.overlayStyle()} />

      <div className="max-w-2xl mx-auto px-4 text-center space-y-6 relative z-10">
        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex justify-center"
        >
          {corretor.avatar_url ? (
            <img src={corretor.avatar_url} alt={corretor.nome}
              className="w-20 h-20 rounded-full object-cover"
              style={{
                border: "4px solid white",
                boxShadow: isLight
                  ? `0 0 0 3px ${cor}, 0 10px 40px rgba(59,130,246,0.2)`
                  : "0 0 0 3px rgba(255,255,255,0.3), 0 10px 40px rgba(0,0,0,0.3)",
              }}
            />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-2xl"
              style={{
                background: `linear-gradient(135deg, ${cor}, ${cor}cc)`,
                border: "4px solid white",
                boxShadow: isLight
                  ? `0 0 0 3px ${cor}, 0 10px 40px rgba(59,130,246,0.2)`
                  : "0 0 0 3px rgba(255,255,255,0.3), 0 10px 40px rgba(0,0,0,0.3)",
              }}>
              {corretor.nome.charAt(0)}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className={`text-2xl sm:text-3xl font-black ${isLight ? "text-slate-800" : "text-white"}`}>
            {config.heading}
          </h2>
          <p className={`text-base mt-2 ${isLight ? "text-slate-500" : "text-white/70"}`}>
            {config.subtext(corretor.nome)}
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 font-bold px-8 py-4 rounded-full transition-all hover:scale-105 active:scale-95 text-base text-white"
              style={{
                background: isLight ? "linear-gradient(135deg, #16a34a, #22c55e)" : "white",
                color: isLight ? "white" : cor,
                boxShadow: isLight ? "0 10px 30px rgba(34,197,94,0.35)" : "0 10px 30px rgba(0,0,0,0.2)",
              }}
            >
              <MessageCircle className="h-5 w-5" />
              {config.cta}
              <ArrowRight className="h-5 w-5" />
            </a>
          )}

          {corretor.telefone && (
            <a
              href={`tel:+55${corretor.telefone.replace(/\D/g, "")}`}
              className={`inline-flex items-center gap-2 font-semibold px-6 py-3.5 rounded-full border-2 transition-all text-sm ${
                isLight
                  ? "border-blue-200 text-blue-700 bg-white hover:bg-blue-50"
                  : "border-white/30 text-white bg-white/10 hover:bg-white/20"
              }`}
            >
              <Phone className="h-4 w-4" />
              Ligar agora
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
