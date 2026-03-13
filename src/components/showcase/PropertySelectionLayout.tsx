import { useState, useCallback, Suspense, lazy, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, GitCompareArrows } from "lucide-react";
import { toast } from "sonner";
import PropertyCard from "./PropertyCard";
import PropertyDetailModal from "./PropertyDetailModal";
import CompareModal from "./CompareModal";
import ContactCTA from "./ContactCTA";
import FooterBranding from "./FooterBranding";
import type { ShowcaseData, ShowcaseImovel } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { useVitrineTracking } from "@/hooks/useVitrineTracking";

const ShowcaseMap = lazy(() => import("./ShowcaseMap"));

interface Props {
  data: ShowcaseData;
}

export default function PropertySelectionLayout({ data }: Props) {
  const { vitrine, corretor, imoveis } = data;
  const [selectedItem, setSelectedItem] = useState<ShowcaseImovel | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [compareItems, setCompareItems] = useState<ShowcaseImovel[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const hasGeoData = imoveis.some(i => i.lat && i.lng);

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

  const handleFavorite = useCallback((item: ShowcaseImovel) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
        trackEvent("favorite", item.id);
        toast.success("❤️ Gostei!", {
          description: `Seu corretor vai saber que você gostou de ${item.empreendimento || item.titulo}.`,
          duration: 3000,
        });
      }
      return next;
    });
  }, [trackEvent]);

  const handleCompare = useCallback((item: ShowcaseImovel) => {
    setCompareItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      if (prev.length >= 4) {
        toast.error("Máximo 4 imóveis para comparar");
        return prev;
      }
      trackEvent("compare_add", item.id);
      return [...prev, item];
    });
  }, [trackEvent]);

  const removeFromCompare = useCallback((id: number) => {
    setCompareItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#ffffff" }}>
      {/* ═══ PREMIUM HERO COVER ═══ */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: "linear-gradient(160deg, #0a0f1e 0%, #111827 40%, #1e293b 100%)",
        }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
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

            {/* Corretor badge */}
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

      {/* ═══ INTERACTIVE TOOLBAR ═══ */}
      {imoveis.length > 1 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs text-slate-400 font-medium">Interaja com os imóveis:</p>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
                <Heart className="h-3 w-3" /> Toque ❤️ para favoritar
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                <GitCompareArrows className="h-3 w-3" /> Compare até 4
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PROPERTY GRID ═══ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
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
              onFavorite={handleFavorite}
              isFavorited={favorites.has(item.id)}
              onCompare={imoveis.length > 1 ? handleCompare : undefined}
              isComparing={compareItems.some(c => c.id === item.id)}
            />
          ))}
        </div>
      </section>

      {/* ═══ COMPARE FLOATING BAR ═══ */}
      {compareItems.length >= 2 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9990]"
        >
          <button
            onClick={() => { setShowCompare(true); trackEvent("compare_open", "all"); }}
            className="flex items-center gap-3 px-6 py-4 rounded-2xl text-white font-bold text-sm shadow-2xl transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #1e3a5f, #3b82f6)", boxShadow: "0 15px 40px rgba(37,99,235,0.4)" }}
          >
            <GitCompareArrows className="h-5 w-5" />
            Comparar {compareItems.length} imóveis
          </button>
        </motion.div>
      )}

      {/* ═══ MAP SECTION ═══ */}
      {hasGeoData && (
        <Suspense fallback={null}>
          <ShowcaseMap imoveis={imoveis} onViewDetails={setSelectedItem} />
        </Suspense>
      )}

      {/* ═══ FAVORITES SUMMARY ═══ */}
      {favorites.size > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-8">
          <div className="rounded-2xl p-5 sm:p-6" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-red-500 fill-red-500" />
              <h3 className="text-sm font-bold text-red-700">Seus favoritos ({favorites.size})</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {imoveis.filter(i => favorites.has(i.id)).map(i => (
                <span key={i.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-red-700 border border-red-200">
                  ❤️ {i.empreendimento || i.titulo}
                </span>
              ))}
            </div>
            <p className="text-xs text-red-500/70 mt-2">Seu corretor será notificado sobre seus favoritos.</p>
          </div>
        </section>
      )}

      {/* ═══ CTA SECTION ═══ */}
      {corretor && whatsappLink && (
        <ContactCTA corretor={corretor} cor="#1e293b" whatsappLink={whatsappLink} variant="selection" />
      )}

      <FooterBranding corretorNome={corretor?.nome} />

      {/* ═══ MODALS ═══ */}
      <PropertyDetailModal
        item={selectedItem || imoveis[0]}
        corretor={corretor}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onTrack={trackEvent}
      />

      <CompareModal
        items={compareItems}
        open={showCompare}
        onClose={() => setShowCompare(false)}
        onRemove={removeFromCompare}
      />
    </div>
  );
}
