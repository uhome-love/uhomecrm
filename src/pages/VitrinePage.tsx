import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Phone, MapPin, BedDouble, Car, Maximize, ChevronLeft, ChevronRight,
  X, Bath, Ruler, Building2, ArrowRight, Home, Send, CheckCircle, User, Mail,
  Play, Star, Shield, TreePine, Sparkles,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { formatBRL } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

/* ═══════════ Lead Capture Form ═══════════ */
function LeadCaptureForm({ empreendimento, source, cor }: { empreendimento: string; source: string; cor: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name && !phone) return;
    setSending(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "hunbxqzhvuemgntklyzb";
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/receive-landing-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, empreendimento, source }),
      });
      if (res.ok) setSent(true);
    } catch (err) {
      console.error("Lead submit error:", err);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-8 text-center space-y-3"
        style={{ backgroundColor: `${cor}15`, border: `1px solid ${cor}30` }}
      >
        <CheckCircle className="h-14 w-14 mx-auto" style={{ color: cor }} />
        <h3 className="text-xl font-bold" style={{ color: cor }}>Recebemos seu interesse!</h3>
        <p className="text-sm text-slate-500">Em breve um corretor entrará em contato com você.</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)}
          className="pl-10 h-12 rounded-xl border-slate-200 bg-white" required />
      </div>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="WhatsApp (DDD + número)" value={phone} onChange={e => setPhone(e.target.value)}
          className="pl-10 h-12 rounded-xl border-slate-200 bg-white" type="tel" required />
      </div>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="E-mail (opcional)" value={email} onChange={e => setEmail(e.target.value)}
          className="pl-10 h-12 rounded-xl border-slate-200 bg-white" type="email" />
      </div>
      <button type="submit" disabled={sending || (!name && !phone)}
        className="w-full h-12 rounded-xl text-white font-bold text-base shadow-lg transition-all hover:shadow-xl disabled:opacity-60"
        style={{ backgroundColor: cor, boxShadow: `0 10px 25px -5px ${cor}40` }}
      >
        {sending ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
          <span className="flex items-center justify-center gap-2">
            <Send className="h-4 w-4" />
            Quero saber mais
          </span>
        )}
      </button>
    </form>
  );
}

/* ═══════════ MAIN PAGE ═══════════ */
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

  const specs = [
    tipologias.length > 0 && { icon: BedDouble, label: tipologias.map(t => `${t.dorms} dorm${t.dorms > 1 ? "s" : ""}`).join(", ") },
    imovel?.area && { icon: Ruler, label: `${imovel.area}m²` },
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

          {/* Right: Lead Capture */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="sticky top-8 rounded-2xl border border-slate-200 p-6 sm:p-8 bg-gradient-to-b from-white to-slate-50/50 shadow-xl shadow-slate-200/50"
            >
              <div className="text-center space-y-1 mb-6">
                <h3 className="text-xl font-bold text-slate-900">Tenho interesse!</h3>
                <p className="text-sm text-slate-500">Preencha seus dados</p>
              </div>
              <LeadCaptureForm empreendimento={nome} source="vitrine_landing" cor={cor} />
            </motion.div>
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
