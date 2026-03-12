import { motion } from "framer-motion";
import PropertyCard from "./PropertyCard";
import ContactCTA from "./ContactCTA";
import FooterBranding from "./FooterBranding";
import type { ShowcaseData } from "./types";

interface Props {
  data: ShowcaseData;
}

/**
 * Layout: Seleção personalizada de imóveis para o cliente
 * Consultive header + property grid + CTA
 */
export default function PropertySelectionLayout({ data }: Props) {
  const { vitrine, corretor, imoveis } = data;

  const whatsappBase = corretor?.telefone
    ? `https://wa.me/55${corretor.telefone.replace(/\D/g, "")}`
    : null;

  const whatsappLink = whatsappBase
    ? `${whatsappBase}?text=${encodeURIComponent(`Olá ${corretor!.nome}! Vi a seleção de imóveis que você preparou e gostaria de mais informações.`)}`
    : null;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 50%, #f4f5f7 100%)" }}>
      {/* Header — consultive, personal */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
        }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />

        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 pb-14 sm:pt-14 sm:pb-20 relative z-10">
          <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-5">
            {/* Corretor badge */}
            {corretor && (
              <div className="flex items-center gap-4">
                {corretor.avatar_url ? (
                  <img src={corretor.avatar_url} alt={corretor.nome}
                    className="w-14 h-14 rounded-full object-cover"
                    style={{ border: "3px solid rgba(255,255,255,0.2)", boxShadow: "0 0 20px rgba(0,0,0,0.2)" }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", border: "3px solid rgba(255,255,255,0.2)" }}>
                    {corretor.nome.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-medium">Seleção personalizada por</p>
                  <p className="text-white font-bold text-base">{corretor.nome}</p>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.05]">
                {vitrine.titulo}
              </h1>
              {vitrine.subtitulo && (
                <p className="text-white/50 text-sm sm:text-base mt-2 max-w-xl">{vitrine.subtitulo}</p>
              )}
            </div>

            {vitrine.mensagem && (
              <div className="max-w-xl rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-white/70 text-sm leading-relaxed italic">"{vitrine.mensagem}"</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Smooth transition */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full" preserveAspectRatio="none">
            <path d="M0 40V15C360 35 720 40 1080 30C1260 25 1380 20 1440 15V40H0Z" fill="white" />
          </svg>
        </div>
      </header>

      {/* Property Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-12"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400 mb-2">Imóveis selecionados</p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            {imoveis.length} {imoveis.length === 1 ? "imóvel selecionado" : "imóveis selecionados"} para você
          </h2>
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {imoveis.map((item, idx) => (
            <PropertyCard
              key={idx}
              item={item}
              index={idx}
              variant="selection"
              whatsappBase={whatsappBase}
              corretorNome={corretor?.nome}
            />
          ))}
        </div>
      </section>

      {/* CTA */}
      {corretor && whatsappLink && (
        <ContactCTA corretor={corretor} cor="#334155" whatsappLink={whatsappLink} variant="selection" />
      )}

      <FooterBranding corretorNome={corretor?.nome} />
    </div>
  );
}
