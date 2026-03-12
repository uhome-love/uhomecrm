import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Phone, MapPin, BedDouble, Car, Maximize, ChevronLeft, ChevronRight,
  X, Bath, Ruler, Building2, ArrowRight, Home, Send, CheckCircle, User, Mail,
  Play, Star, Shield, TreePine, Sparkles, MessageCircle,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { formatBRL } from "@/lib/utils";

/* ═══════════ Types ═══════════ */
interface VitrineImovel {
  id: number;
  titulo: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  area: number | null;
  quartos: number | null;
  suites: number | null;
  vagas: number | null;
  banheiros: number | null;
  valor: number | null;
  fotos: string[];
  empreendimento: string | null;
  descricao: string | null;
  precoDe?: string | null;
  precoPor?: string | null;
  descontoMax?: string | null;
  status?: string | null;
  metragens?: string | null;
  dorms?: string | null;
  condicoes?: string | null;
  segmento?: string | null;
}

interface LandingData {
  diferenciais?: string[];
  plantas?: string[];
  video_url?: string | null;
  mapa_url?: string | null;
  cor_primaria?: string;
  landing_titulo?: string | null;
  landing_subtitulo?: string | null;
  descricao?: string | null;
  fotos?: string[];
  bairro?: string | null;
  valor_min?: number | null;
  valor_max?: number | null;
  tipologias?: { dorms: number; area_min?: number; area_max?: number; suites?: number }[];
  status_obra?: string | null;
  previsao_entrega?: string | null;
  vagas?: number | null;
}

interface VitrineData {
  vitrine: { id: string; titulo: string; mensagem: string | null; created_at: string; tipo?: string };
  corretor: { nome: string; telefone: string | null; avatar_url: string | null } | null;
  imoveis: VitrineImovel[];
  landing?: LandingData | null;
}

/* ═══════════ Helpers ═══════════ */
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|v=|\/embed\/)([^?&#]+)/);
  return match?.[1] || "";
}

/* ═══════════ Hero Carousel ═══════════ */
function HeroCarousel({ fotos, cor }: { fotos: string[]; cor: string }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (fotos.length <= 1) return;
    const interval = setInterval(() => setCurrent(c => (c + 1) % fotos.length), 5000);
    return () => clearInterval(interval);
  }, [fotos.length]);

  if (fotos.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}99)` }}>
        <Building2 className="h-20 w-20 text-white/20" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
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
    </div>
  );
}

/* ═══════════ Corretor Card ═══════════ */
function CorretorCard({ corretor, nome, cor, whatsappLink }: { 
  corretor: { nome: string; telefone: string | null; avatar_url: string | null };
  nome: string;
  cor: string;
  whatsappLink: string | null;
}) {
  return (
    <div className="space-y-5">
      {/* Corretor info */}
      <div className="flex items-center gap-4">
        {corretor.avatar_url ? (
          <img src={corretor.avatar_url} alt={corretor.nome}
            className="w-16 h-16 rounded-full border-3 object-cover shadow-lg"
            style={{ borderColor: `${cor}40` }}
          />
        ) : (
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
            style={{ background: `linear-gradient(135deg, ${cor}, ${cor}cc)` }}>
            {corretor.nome.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] font-medium text-slate-400">Seleção para você</p>
          <p className="text-lg font-bold text-slate-900">{corretor.nome}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* CTA WhatsApp */}
      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-4 rounded-xl text-white font-bold text-base shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
          style={{ backgroundColor: cor, boxShadow: `0 10px 25px -5px ${cor}40` }}
        >
          <MessageCircle className="h-5 w-5" />
          Falar com {corretor.nome.split(" ")[0]}
        </a>
      )}

      {corretor.telefone && (
        <a
          href={`tel:+55${corretor.telefone.replace(/\D/g, "")}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
        >
          <Phone className="h-4 w-4" style={{ color: cor }} />
          Ligar agora
        </a>
      )}

      <p className="text-xs text-slate-400 text-center">
        Atendimento personalizado para você
      </p>
    </div>
  );
}

/* ═══════════ MELNICK DAY SHOWCASE ═══════════ */
function MelnickDayShowcase({ vitrine, corretor, imoveis }: {
  vitrine: VitrineData["vitrine"];
  corretor: VitrineData["corretor"];
  imoveis: VitrineImovel[];
}) {
  const [imgIdx, setImgIdx] = useState<Record<number, number>>({});
  const cor = "#1a1a2e";

  const whatsappBase = corretor?.telefone
    ? `https://wa.me/55${corretor.telefone.replace(/\D/g, "")}`
    : null;

  const segmentoColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    mcmv: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
    medio: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-800" },
    alto: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10" />
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-16 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-5 py-2">
              <Star className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-bold tracking-wider uppercase">Melnick Day 2026</span>
              <Star className="h-4 w-4 text-amber-400" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              {vitrine.titulo}
            </h1>
            {vitrine.mensagem && (
              <p className="text-white/60 text-base sm:text-lg max-w-2xl mx-auto">{vitrine.mensagem}</p>
            )}
            {corretor && (
              <div className="flex items-center justify-center gap-3 pt-2">
                {corretor.avatar_url ? (
                  <img src={corretor.avatar_url} alt={corretor.nome} className="w-10 h-10 rounded-full border-2 border-amber-500/50 object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center text-amber-300 font-bold border-2 border-amber-500/50">
                    {corretor.nome.charAt(0)}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.2em]">Seleção por</p>
                  <p className="text-white font-semibold text-sm">{corretor.nome}</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </header>

      {/* Cards Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {imoveis.map((item, idx) => {
            const rawSeg = ((item as any).segmento || "").toLowerCase();
            const seg = rawSeg.includes("mcmv") || rawSeg.includes("open") ? "mcmv" : rawSeg.includes("alto") ? "alto" : "medio";
            const colors = segmentoColors[seg] || segmentoColors.medio;
            const fotos = item.fotos || [];
            const currentImg = imgIdx[idx] || 0;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-2xl overflow-hidden shadow-xl shadow-black/20 border border-white/10 flex flex-col"
              >
                {/* Image carousel */}
                <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden group">
                  {fotos.length > 0 ? (
                    <>
                      <img src={fotos[currentImg]} alt={item.empreendimento || ""} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                      {fotos.length > 1 && (
                        <>
                          <button
                            onClick={() => setImgIdx(p => ({ ...p, [idx]: (currentImg - 1 + fotos.length) % fotos.length }))}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setImgIdx(p => ({ ...p, [idx]: (currentImg + 1) % fotos.length }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            {fotos.slice(0, 6).map((_, i) => (
                              <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentImg ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="h-12 w-12 text-slate-300" />
                    </div>
                  )}

                  {/* Segmento badge */}
                  <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors.badge}`}>
                    {seg === "mcmv" ? "MCMV" : seg === "alto" ? "Alto Padrão" : "Médio Padrão"}
                  </div>

                  {/* Discount badge */}
                  {(item as any).descontoMax && (
                    <div className="absolute top-3 right-3 bg-red-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold">
                      Até {(item as any).descontoMax} OFF
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{item.empreendimento || item.titulo}</h3>
                    {item.bairro && (
                      <p className="text-slate-500 text-xs flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {item.bairro}
                      </p>
                    )}
                  </div>

                  {/* Specs */}
                  <div className="flex flex-wrap gap-1.5">
                    {(item as any).metragens && (
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{(item as any).metragens}</span>
                    )}
                    {(item as any).dorms && (
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{(item as any).dorms}</span>
                    )}
                    {(item as any).status && (
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{(item as any).status}</span>
                    )}
                  </div>

                  {/* Prices */}
                  <div className="mt-auto pt-3 border-t border-slate-100">
                    {(item as any).precoDe && (
                      <p className="text-xs text-slate-400 line-through">De {(item as any).precoDe}</p>
                    )}
                    {(item as any).precoPor && (
                      <p className="text-xl font-black text-slate-900">
                        Por <span className="text-emerald-600">{(item as any).precoPor}</span>
                      </p>
                    )}
                  </div>

                  {/* WhatsApp CTA */}
                  {whatsappBase && (
                    <a
                      href={`${whatsappBase}?text=${encodeURIComponent(`Olá ${corretor!.nome}! Tenho interesse no ${item.empreendimento || item.titulo} - Melnick Day 2026`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      Quero saber mais
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Footer CTA */}
      {whatsappBase && corretor && (
        <section className="py-12 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border-t border-amber-500/20">
          <div className="max-w-2xl mx-auto px-4 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">Gostou das ofertas?</h2>
            <p className="text-white/60">Fale agora com {corretor.nome} e aproveite as condições do Melnick Day!</p>
            <a
              href={`${whatsappBase}?text=${encodeURIComponent(`Olá ${corretor.nome}! Vi as ofertas do Melnick Day 2026 e quero mais informações!`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 py-4 rounded-full transition-all shadow-xl hover:shadow-2xl hover:scale-105 text-lg"
            >
              <Phone className="h-5 w-5" />
              Falar pelo WhatsApp
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-white/30">
            Seleção personalizada por <span className="font-medium text-white/50">{corretor?.nome || "UHome"}</span>
          </p>
          <p className="text-xs text-white/20 mt-1">UHome Sales • Melnick Day 2026</p>
        </div>
      </footer>
    </div>
  );
}


export default function VitrinePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VitrineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ fotos: string[]; idx: number } | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("vitrine-public", {
          body: { action: "get_vitrine", vitrine_id: id },
        });
        if (fnError) throw fnError;
        if (result?.error) setError(result.error);
        else setData(result);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400 mx-auto" />
          <p className="text-sm text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <Building2 className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Vitrine não disponível</h1>
          <p className="text-slate-500">{error || "O link pode ter expirado."}</p>
        </div>
      </div>
    );
  }

  const { vitrine, corretor, imoveis, landing } = data;

  /* ═══════════ MELNICK DAY SHOWCASE (old pattern) ═══════════ */
  if (vitrine.tipo === "melnick_day") {
    return <MelnickDayShowcase vitrine={vitrine} corretor={corretor} imoveis={imoveis} />;
  }

  const imovel = imoveis[0] || null;
  const cor = landing?.cor_primaria || "#1e3a5f";
  const rgb = hexToRgb(cor);
  const nome = landing?.landing_titulo || imovel?.empreendimento || imovel?.titulo || vitrine.titulo;
  const subtitulo = landing?.landing_subtitulo || "";
  const descricao = landing?.descricao || imovel?.descricao || "";
  const bairro = landing?.bairro || imovel?.bairro || "";
  const fotos = imovel?.fotos || landing?.fotos || [];
  const diferenciais = landing?.diferenciais || [];
  const plantas = landing?.plantas || [];
  const videoUrl = landing?.video_url || "";
  const mapaUrl = landing?.mapa_url || "";
  const tipologias = landing?.tipologias || [];
  const valorMin = landing?.valor_min || imovel?.valor || 0;
  const valorMax = landing?.valor_max || 0;
  const vagas = landing?.vagas || imovel?.vagas || 0;
  const statusObra = landing?.status_obra || "";
  const previsaoEntrega = landing?.previsao_entrega || "";

  const whatsappLink = corretor?.telefone
    ? `https://wa.me/55${corretor.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Olá ${corretor.nome}! Vi a página do ${nome} e gostaria de mais informações.`
      )}`
    : null;

  const areaLabel = (() => {
    if (tipologias.length > 0) {
      const areas = tipologias
        .flatMap(t => [t.area_min, t.area_max].filter(Boolean))
        .map(Number)
        .filter(n => n > 0);
      if (areas.length > 0) {
        const unique = [...new Set(areas)].sort((a, b) => a - b);
        return unique.join(", ") + " m²";
      }
    }
    return imovel?.area ? `${imovel.area}m²` : null;
  })();

  const specs = [
    tipologias.length > 0 && { icon: BedDouble, label: tipologias.map(t => `${t.dorms} dorm${t.dorms > 1 ? "s" : ""}`).join(", ") },
    areaLabel && { icon: Ruler, label: areaLabel },
    imovel?.suites && { icon: Home, label: `${imovel.suites} suíte${imovel.suites > 1 ? "s" : ""}` },
    vagas > 0 && { icon: Car, label: `${vagas} vaga${vagas > 1 ? "s" : ""}` },
  ].filter(Boolean) as { icon: any; label: string }[];

  return (
    <div className="min-h-screen bg-white">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative h-[70vh] sm:h-[80vh] overflow-hidden">
        <HeroCarousel fotos={fotos.slice(0, 8)} cor={cor} />

        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10 z-[1]" />
        <div className="absolute inset-0 z-[1]" style={{
          background: `linear-gradient(135deg, ${cor}40 0%, transparent 60%)`
        }} />

        {/* Corretor badge */}
        {corretor && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-5 left-5 sm:top-8 sm:left-8 z-10 flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-full pr-5 pl-1.5 py-1.5 border border-white/10"
          >
            {corretor.avatar_url ? (
              <img src={corretor.avatar_url} alt={corretor.nome} className="w-10 h-10 rounded-full border-2 border-white/30 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white/30"
                style={{ backgroundColor: `${cor}80` }}>
                {corretor.nome.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-medium">Seleção por</p>
              <p className="text-white font-semibold text-sm">{corretor.nome}</p>
            </div>
          </motion.div>
        )}

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-6 sm:p-12 lg:p-16">
          <div className="max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              {statusObra && (
                <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-4"
                  style={{ backgroundColor: `${cor}30`, color: "white", border: `1px solid ${cor}50` }}>
                  {statusObra} {previsaoEntrega && `• Entrega ${previsaoEntrega}`}
                </span>
              )}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[0.95] drop-shadow-2xl">
                {nome}
              </h1>
              {subtitulo && (
                <p className="text-lg sm:text-xl text-white/70 mt-3 max-w-2xl font-light">{subtitulo}</p>
              )}
              {bairro && (
                <p className="text-white/60 text-sm mt-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {bairro} — Porto Alegre
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════ SPECS BAR ═══════════ */}
      <section className="border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            {specs.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100"
              >
                <s.icon className="h-5 w-5" style={{ color: cor }} />
                <span className="text-sm font-semibold text-slate-700">{s.label}</span>
              </motion.div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            {valorMax > 0 && valorMin > 0 ? (
              <div className="text-right">
                <p className="text-xs text-slate-400 font-medium">Faixa de valores</p>
                <p className="text-2xl font-black" style={{ color: cor }}>
                  {formatBRL(valorMin)} — {formatBRL(valorMax)}
                </p>
              </div>
            ) : valorMin > 0 ? (
              <div className="text-right">
                <p className="text-xs text-slate-400 font-medium">A partir de</p>
                <p className="text-2xl font-black" style={{ color: cor }}>{formatBRL(valorMin)}</p>
              </div>
            ) : null}
          </motion.div>
        </div>
      </section>

      {/* ═══════════ DESCRIPTION + FORM ═══════════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        <div className="grid lg:grid-cols-5 gap-12">
          {/* Left: Description + Diferenciais */}
          <div className="lg:col-span-3 space-y-8">
            {descricao && (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Sobre o empreendimento</h2>
                <p className="text-slate-600 leading-relaxed text-base whitespace-pre-line">{descricao}</p>
              </motion.div>
            )}

            {/* Tipologias */}
            {tipologias.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Tipologias</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {tipologias.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cor}15` }}>
                        <BedDouble className="h-5 w-5" style={{ color: cor }} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{t.dorms} Dormitório{t.dorms > 1 ? "s" : ""}</p>
                        <p className="text-xs text-slate-500">
                          {t.area_min && t.area_max ? `${t.area_min}–${t.area_max}m²` : t.area_min ? `${t.area_min}m²` : ""}
                          {t.suites ? ` · ${t.suites} suíte${t.suites > 1 ? "s" : ""}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Diferenciais */}
            {diferenciais.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Diferenciais</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {diferenciais.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${cor}15` }}>
                        <Sparkles className="h-4 w-4" style={{ color: cor }} />
                      </div>
                      <p className="text-sm font-medium text-slate-700">{d}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right: Corretor Card */}
          <div className="lg:col-span-2">
            {corretor && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="sticky top-8 rounded-2xl border border-slate-200 p-6 sm:p-8 bg-gradient-to-b from-white to-slate-50/50 shadow-xl shadow-slate-200/50"
              >
                <CorretorCard corretor={corretor} nome={nome} cor={cor} whatsappLink={whatsappLink} />
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ GALERIA ═══════════ */}
      {fotos.length > 1 && (
        <section className="bg-slate-50 py-12 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Galeria</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {fotos.map((foto, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="aspect-[4/3] rounded-xl overflow-hidden cursor-pointer group relative"
                    onClick={() => setLightbox({ fotos, idx: i })}
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
      )}

      {/* ═══════════ PLANTAS ═══════════ */}
      {plantas.length > 0 && (
        <section className="py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Plantas</h2>
              <div className={`grid gap-4 ${plantas.length === 1 ? "max-w-lg mx-auto" : "grid-cols-1 sm:grid-cols-2"}`}>
                {plantas.map((url, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:shadow-lg transition-shadow bg-white p-2"
                    onClick={() => setLightbox({ fotos: plantas, idx: i })}
                  >
                    <img src={url} alt={`Planta ${i + 1}`} className="w-full h-auto rounded-lg" loading="lazy" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ═══════════ VÍDEO ═══════════ */}
      {videoUrl && (
        <section className="py-12 sm:py-16 bg-slate-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Conheça o empreendimento</h2>
              {videoUrl.includes("youtu") ? (
                <div className="aspect-video rounded-2xl overflow-hidden shadow-xl border border-slate-200">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYoutubeId(videoUrl)}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a href={videoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-lg transition-shadow">
                  <div className="h-14 w-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cor}15` }}>
                    <Play className="h-6 w-6" style={{ color: cor }} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Assistir vídeo</p>
                    <p className="text-sm text-slate-500">Abrir em nova aba</p>
                  </div>
                </a>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ═══════════ LOCALIZAÇÃO ═══════════ */}
      {(mapaUrl || bairro) && (
        <section className="py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Localização</h2>
              {bairro && (
                <p className="text-slate-500 flex items-center gap-2 mb-6">
                  <MapPin className="h-4 w-4" style={{ color: cor }} /> {bairro} — Porto Alegre
                </p>
              )}
              {mapaUrl && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                  <img src={mapaUrl} alt="Localização" className="w-full h-auto" loading="lazy" />
                </div>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="py-16 sm:py-20 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cor}, ${cor}dd)` }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)"
          }} />
        </div>
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10 space-y-5">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Interessado?</h2>
            <p className="text-white/70 text-lg mt-2">
              Fale agora com {corretor?.nome || "nosso corretor"} e agende uma visita.
            </p>
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white text-slate-900 font-bold px-10 py-4 rounded-full transition-all shadow-2xl hover:shadow-3xl hover:scale-105 text-lg mt-6"
              >
                <Phone className="h-5 w-5" style={{ color: cor }} />
                Falar pelo WhatsApp
                <ArrowRight className="h-5 w-5" />
              </a>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-400">
            Seleção personalizada por <span className="font-medium text-slate-600">{corretor?.nome || "UHome"}</span>
          </p>
          <p className="text-xs text-slate-300 mt-1">UHome Sales</p>
        </div>
      </footer>

      {/* ═══════════ Floating WhatsApp (mobile) ═══════════ */}
      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 sm:hidden text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110"
          style={{ backgroundColor: cor, boxShadow: `0 10px 25px -5px ${cor}50` }}
        >
          <Phone className="h-6 w-6" />
        </a>
      )}

      {/* ═══════════ Lightbox ═══════════ */}
      <AnimatePresence>
        {lightbox && (
          <Dialog open onOpenChange={() => setLightbox(null)}>
            <DialogContent className="max-w-5xl p-0 bg-black/95 border-none rounded-2xl overflow-hidden">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative">
                <img src={lightbox.fotos[lightbox.idx]} alt="" className="w-full max-h-[85vh] object-contain" />
                <button onClick={() => setLightbox(null)}
                  className="absolute top-4 right-4 bg-white/10 backdrop-blur-sm text-white rounded-full p-2 hover:bg-white/20 transition-colors">
                  <X className="h-5 w-5" />
                </button>
                {lightbox.fotos.length > 1 && (
                  <>
                    <button onClick={() => setLightbox({ ...lightbox, idx: (lightbox.idx - 1 + lightbox.fotos.length) % lightbox.fotos.length })}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white rounded-full p-3 hover:bg-white/20 transition-colors">
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button onClick={() => setLightbox({ ...lightbox, idx: (lightbox.idx + 1) % lightbox.fotos.length })}
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
        )}
      </AnimatePresence>
    </div>
  );
}
