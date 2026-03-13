import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import PropertyCard from "./PropertyCard";
import PropertyDetailModal from "./PropertyDetailModal";
import ContactCTA from "./ContactCTA";
import FooterBranding from "./FooterBranding";
import type { ShowcaseData, ShowcaseImovel } from "./types";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  data: ShowcaseData;
}

export default function PropertySelectionLayout({ data }: Props) {
  const { vitrine, corretor, imoveis } = data;
  const [selectedItem, setSelectedItem] = useState<ShowcaseImovel | null>(null);

  const whatsappBase = corretor?.telefone
    ? `https://wa.me/55${corretor.telefone.replace(/\D/g, "")}`
    : null;

  const whatsappLink = whatsappBase
    ? `${whatsappBase}?text=${encodeURIComponent(`Olá ${corretor!.nome}! Vi a seleção de imóveis que você preparou e gostaria de mais informações.`)}`
    : null;

  // Non-blocking analytics
  const trackEvent = useCallback((action: string, imovelId: number | string) => {
    try {
      supabase.functions.invoke("vitrine-public", {
        body: { action: "track_event", vitrine_id: vitrine.id, event_type: action, imovel_id: String(imovelId) },
      }).catch(() => {});
    } catch {}
  }, [vitrine.id]);

  return (
    <div className="min-h-screen" style={{ background: "#ffffff" }}>
      {/* ═══ PREMIUM HERO COVER ═══ */}
      <header className="relative overflow-hidden">
        {/* Dark gradient background */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(160deg, #0a0f1e 0%, #111827 40%, #1e293b 100%)",
        }} />
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
        {/* Gradient accent */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] opacity-20" style={{
          background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
          filter: "blur(80px)",
        }} />

        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 pb-16 sm:pt-16 sm:pb-24 relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="space-y-6">
            {/* UHome logo */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs"
                style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                U
              </div>
              <span className="text-white/30 text-xs font-semibold tracking-widest uppercase">UHome Sales</span>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.08]">
                {vitrine.titulo}
              </h1>
              {vitrine.subtitulo && (
                <p className="text-white/40 text-sm sm:text-base mt-3 max-w-xl font-medium">{vitrine.subtitulo}</p>
              )}
            </div>

            {/* Mensagem personalizada do corretor */}
            {vitrine.mensagem && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="max-w-xl rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}>
                <p className="text-white/60 text-sm leading-relaxed italic">"{vitrine.mensagem}"</p>
              </motion.div>
            )}

            {/* Corretor badge — consultive */}
            {corretor && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                className="flex items-center gap-4 mt-2">
                {corretor.avatar_url ? (
                  <img src={corretor.avatar_url} alt={corretor.nome}
                    className="w-14 h-14 rounded-full object-cover"
                    style={{ border: "3px solid rgba(255,255,255,0.15)", boxShadow: "0 0 30px rgba(59,130,246,0.2)" }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", border: "3px solid rgba(255,255,255,0.15)" }}>
                    {corretor.nome.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-white/30 text-[10px] uppercase tracking-[0.25em] font-semibold">Curadoria por</p>
                  <p className="text-white font-bold text-base">{corretor.nome}</p>
                  {corretor.telefone && (
                    <p className="text-white/30 text-xs mt-0.5">{corretor.telefone}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Count badge */}
            <div className="flex items-center gap-3 mt-4">
              <div className="h-px flex-1 max-w-[60px]" style={{ background: "linear-gradient(90deg, #3b82f6, transparent)" }} />
              <span className="text-blue-400/60 text-xs font-bold tracking-wider uppercase">
                {imoveis.length} {imoveis.length === 1 ? "imóvel" : "imóveis"} selecionados
              </span>
            </div>
          </motion.div>
        </div>

        {/* Wave transition */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full" preserveAspectRatio="none">
            <path d="M0 60V20C240 50 480 60 720 45C960 30 1200 20 1440 25V60H0Z" fill="white" />
          </svg>
        </div>
      </header>

      {/* ═══ PROPERTY GRID ═══ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {imoveis.map((item, idx) => (
            <PropertyCard
              key={idx}
              item={item}
              index={idx}
              variant="selection"
              whatsappBase={whatsappBase}
              corretorNome={corretor?.nome}
              onViewDetails={setSelectedItem}
              onTrack={trackEvent}
            />
          ))}
        </div>
      </section>

      {/* ═══ CTA SECTION ═══ */}
      {corretor && whatsappLink && (
        <ContactCTA corretor={corretor} cor="#1e293b" whatsappLink={whatsappLink} variant="selection" />
      )}

      <FooterBranding corretorNome={corretor?.nome} />

      {/* ═══ DETAIL MODAL ═══ */}
      <PropertyDetailModal
        item={selectedItem || imoveis[0]}
        corretor={corretor}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onTrack={trackEvent}
      />
    </div>
  );
}
