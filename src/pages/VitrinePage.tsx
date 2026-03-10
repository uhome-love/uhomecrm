import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, MapPin, BedDouble, Car, Maximize, ChevronLeft, ChevronRight, X, Bath, Ruler, Building2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

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
}

interface VitrineData {
  vitrine: { id: string; titulo: string; mensagem: string | null; created_at: string };
  corretor: { nome: string; telefone: string | null; avatar_url: string | null } | null;
  imoveis: VitrineImovel[];
}

function PhotoCarousel({ fotos, onOpen }: { fotos: string[]; onOpen: (idx: number) => void }) {
  const [current, setCurrent] = useState(0);
  if (fotos.length === 0) {
    return (
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
        <Building2 className="h-12 w-12 text-slate-400" />
      </div>
    );
  }
  return (
    <div className="relative aspect-[4/3] overflow-hidden group cursor-pointer" onClick={() => onOpen(current)}>
      <img src={fotos[current]} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {fotos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent((current - 1 + fotos.length) % fotos.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm text-slate-800 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent((current + 1) % fotos.length); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm text-slate-800 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
            {fotos.slice(0, 6).map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
            {fotos.length > 6 && <span className="text-[10px] text-white/70 ml-1">+{fotos.length - 6}</span>}
          </div>
        </>
      )}
      {fotos.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white rounded-full px-2.5 py-1 text-[11px] flex items-center gap-1 font-medium">
          <Maximize className="h-3 w-3" /> {fotos.length}
        </div>
      )}
    </div>
  );
}

function ImovelCard({ imovel, index, onOpenLightbox }: { imovel: VitrineImovel; index: number; onOpenLightbox: (fotos: string[], idx: number) => void }) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  const specs = [
    imovel.area && { icon: Ruler, label: `${imovel.area}m²` },
    imovel.quartos && { icon: BedDouble, label: `${imovel.quartos} quarto${imovel.quartos > 1 ? "s" : ""}` },
    imovel.banheiros && { icon: Bath, label: `${imovel.banheiros} banh.` },
    imovel.vagas && { icon: Car, label: `${imovel.vagas} vaga${imovel.vagas > 1 ? "s" : ""}` },
  ].filter(Boolean) as { icon: any; label: string }[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 group"
    >
      <PhotoCarousel fotos={imovel.fotos} onOpen={(idx) => onOpenLightbox(imovel.fotos, idx)} />

      <div className="p-5 space-y-3">
        {imovel.empreendimento && (
          <span className="inline-block text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
            {imovel.empreendimento}
          </span>
        )}

        <h3 className="text-lg font-bold text-slate-900 leading-tight">{imovel.titulo}</h3>

        {(imovel.endereco || imovel.bairro) && (
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            {imovel.endereco || imovel.bairro}
          </p>
        )}

        {specs.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {specs.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-slate-600">
                <s.icon className="h-4 w-4 text-slate-400" />
                <span className="text-sm">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {imovel.valor && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-2xl font-black text-slate-900">{formatCurrency(imovel.valor)}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function VitrinePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VitrineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ fotos: string[]; idx: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchVitrine = async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("vitrine-public", {
          body: { action: "get_vitrine", vitrine_id: id },
        });
        if (fnError) throw fnError;
        if (result?.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (err: any) {
        setError(err.message || "Erro ao carregar vitrine");
      } finally {
        setLoading(false);
      }
    };
    fetchVitrine();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-slate-500">Carregando imóveis...</p>
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
          <p className="text-slate-500">{error || "O link pode ter expirado ou a vitrine não existe mais."}</p>
        </div>
      </div>
    );
  }

  const { vitrine, corretor, imoveis } = data;

  const whatsappLink = corretor?.telefone
    ? `https://wa.me/55${corretor.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Olá ${corretor.nome}! Vi a seleção de imóveis "${vitrine.titulo}" e gostaria de mais informações.`
      )}`
    : null;

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Hero Section ─── */}
      <header className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 25% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(59,130,246,0.15) 0%, transparent 50%)"
          }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-5"
          >
            {/* Corretor avatar + name */}
            {corretor && (
              <div className="flex items-center justify-center gap-3">
                {corretor.avatar_url ? (
                  <img src={corretor.avatar_url} alt={corretor.nome} className="w-12 h-12 rounded-full border-2 border-white/20 object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600/30 border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg">
                    {corretor.nome.charAt(0)}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-white/60 text-xs uppercase tracking-widest">Seleção por</p>
                  <p className="text-white font-semibold text-lg">{corretor.nome}</p>
                </div>
              </div>
            )}

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              {vitrine.titulo}
            </h1>

            {vitrine.mensagem && (
              <p className="text-white/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                {vitrine.mensagem}
              </p>
            )}

            <div className="flex items-center justify-center gap-6 text-white/50 text-sm pt-2">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {imoveis.length} imóve{imoveis.length !== 1 ? "is" : "l"}
              </span>
              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-full transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                >
                  <Phone className="h-4 w-4" />
                  Falar com {corretor?.nome?.split(" ")[0]}
                  <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </motion.div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full">
            <path d="M0 60L48 55C96 50 192 40 288 35C384 30 480 30 576 33.3C672 36.7 768 43.3 864 45C960 46.7 1056 43.3 1152 40C1248 36.7 1344 33.3 1392 31.7L1440 30V60H0Z" fill="white" />
          </svg>
        </div>
      </header>

      {/* ─── Properties Grid ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {imoveis.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <Building2 className="h-10 w-10 text-slate-300" />
            </div>
            <p className="text-slate-500 text-lg">Nenhum imóvel encontrado nesta seleção.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {imoveis.map((imovel, i) => (
              <ImovelCard
                key={imovel.id}
                imovel={imovel}
                index={i}
                onOpenLightbox={(fotos, idx) => setLightbox({ fotos, idx })}
              />
            ))}
          </div>
        )}
      </main>

      {/* ─── CTA Footer ─── */}
      {whatsappLink && (
        <section className="bg-gradient-to-r from-slate-900 to-blue-900 py-12">
          <div className="max-w-3xl mx-auto px-4 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Gostou de algum imóvel?
            </h2>
            <p className="text-white/60">
              Entre em contato com {corretor?.nome} para agendar uma visita ou tirar dúvidas.
            </p>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 py-3.5 rounded-full transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 text-lg"
            >
              <Phone className="h-5 w-5" />
              Falar pelo WhatsApp
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </section>
      )}

      {/* ─── Footer ─── */}
      <footer className="py-8 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-400">
            Seleção personalizada por <span className="font-medium text-slate-600">{corretor?.nome || "UHome"}</span>
          </p>
          <p className="text-xs text-slate-300 mt-1">UHome Sales</p>
        </div>
      </footer>

      {/* ─── Floating WhatsApp Button (mobile) ─── */}
      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 sm:hidden bg-emerald-500 text-white rounded-full p-4 shadow-2xl shadow-emerald-500/30 hover:bg-emerald-600 transition-all"
        >
          <Phone className="h-6 w-6" />
        </a>
      )}

      {/* ─── Lightbox ─── */}
      <AnimatePresence>
        {lightbox && (
          <Dialog open onOpenChange={() => setLightbox(null)}>
            <DialogContent className="max-w-5xl p-0 bg-black/95 border-none rounded-2xl overflow-hidden">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative"
              >
                <img
                  src={lightbox.fotos[lightbox.idx]}
                  alt=""
                  className="w-full max-h-[85vh] object-contain"
                />
                <button
                  onClick={() => setLightbox(null)}
                  className="absolute top-4 right-4 bg-white/10 backdrop-blur-sm text-white rounded-full p-2 hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                {lightbox.fotos.length > 1 && (
                  <>
                    <button
                      onClick={() => setLightbox({ ...lightbox, idx: (lightbox.idx - 1 + lightbox.fotos.length) % lightbox.fotos.length })}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white rounded-full p-3 hover:bg-white/20 transition-colors"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      onClick={() => setLightbox({ ...lightbox, idx: (lightbox.idx + 1) % lightbox.fotos.length })}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white rounded-full p-3 hover:bg-white/20 transition-colors"
                    >
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
