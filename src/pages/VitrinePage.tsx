import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, MapPin, BedDouble, Car, Maximize, ChevronLeft, ChevronRight, X, Bath, Ruler, Building2, ArrowRight, Home, Shield, TreePine, Send, CheckCircle, User, Mail } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { formatBRL } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

interface VitrineData {
  vitrine: { id: string; titulo: string; mensagem: string | null; created_at: string; tipo?: string };
  corretor: { nome: string; telefone: string | null; avatar_url: string | null } | null;
  imoveis: VitrineImovel[];
}

/* ═══════════════ Photo Carousel ═══════════════ */
function PhotoCarousel({ fotos, onOpen, large }: { fotos: string[]; onOpen: (idx: number) => void; large?: boolean }) {
  const [current, setCurrent] = useState(0);
  if (fotos.length === 0) {
    return (
      <div className={`${large ? "aspect-[16/9]" : "aspect-[4/3]"} bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center`}>
        <Building2 className="h-12 w-12 text-slate-400" />
      </div>
    );
  }
  return (
    <div className={`relative ${large ? "aspect-[16/9]" : "aspect-[4/3]"} overflow-hidden group cursor-pointer`} onClick={() => onOpen(current)}>
      <AnimatePresence mode="wait">
        <motion.img
          key={current}
          src={fotos[current]}
          alt=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full object-cover absolute inset-0"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {fotos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent((current - 1 + fotos.length) % fotos.length); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm text-slate-800 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent((current + 1) % fotos.length); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm text-slate-800 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {fotos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                className={`h-2 rounded-full transition-all ${i === current ? "w-8 bg-white" : "w-2 bg-white/50"}`}
              />
            ))}
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

/* ═══════════════ Lead Capture Form ═══════════════ */
function LeadCaptureForm({ empreendimento, source }: { empreendimento: string; source: string }) {
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
        body: JSON.stringify({
          name,
          phone,
          email,
          empreendimento,
          source,
        }),
      });
      if (res.ok) {
        setSent(true);
      }
    } catch (err) {
      console.error("Lead submit error:", err);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-3">
        <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
        <h3 className="text-xl font-bold text-emerald-800">Recebemos seu interesse!</h3>
        <p className="text-emerald-600 text-sm">Em breve um corretor entrará em contato com você.</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
      className="bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5"
    >
      <div className="text-center space-y-1">
        <h3 className="text-xl font-bold text-slate-900">Tenho interesse!</h3>
        <p className="text-sm text-slate-500">Preencha seus dados e um corretor entrará em contato</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="pl-10 h-12 rounded-xl border-slate-200 bg-white"
            required
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="WhatsApp (DDD + número)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="pl-10 h-12 rounded-xl border-slate-200 bg-white"
            type="tel"
            required
          />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="E-mail (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 h-12 rounded-xl border-slate-200 bg-white"
            type="email"
          />
        </div>
        <Button type="submit" disabled={sending || (!name && !phone)}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-lg shadow-emerald-500/25"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Quero saber mais
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
}

/* ═══════════════ Single Property Layout ═══════════════ */
function SinglePropertyView({ imovel, corretor, vitrine, onOpenLightbox, whatsappLink }: {
  imovel: VitrineImovel;
  corretor: VitrineData["corretor"];
  vitrine: VitrineData["vitrine"];
  onOpenLightbox: (fotos: string[], idx: number) => void;
  whatsappLink: string | null;
}) {
  const specs = [
    imovel.area && { icon: Ruler, label: `${imovel.area}m²` },
    imovel.quartos && { icon: BedDouble, label: `${imovel.quartos} quarto${imovel.quartos > 1 ? "s" : ""}` },
    imovel.suites && { icon: Home, label: `${imovel.suites} suíte${imovel.suites > 1 ? "s" : ""}` },
    imovel.banheiros && { icon: Bath, label: `${imovel.banheiros} banh.` },
    imovel.vagas && { icon: Car, label: `${imovel.vagas} vaga${imovel.vagas > 1 ? "s" : ""}` },
  ].filter(Boolean) as { icon: any; label: string }[];

  const nome = imovel.empreendimento || imovel.titulo || vitrine.titulo;

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Hero with full-width photo slider ─── */}
      <div className="relative">
        <PhotoCarousel fotos={imovel.fotos} onOpen={(idx) => onOpenLightbox(imovel.fotos, idx)} large />
        {/* Gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {imovel.segmento && (
              <span className="inline-block text-[11px] font-bold text-amber-300 bg-amber-500/20 backdrop-blur-sm px-3 py-1 rounded-full uppercase tracking-wider mb-3">
                {imovel.segmento}
              </span>
            )}
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg">{nome}</h1>
            {(imovel.endereco || imovel.bairro) && (
              <p className="text-white/80 text-base sm:text-lg mt-2 flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                {imovel.bairro}{imovel.cidade ? ` — ${imovel.cidade}` : ""}
              </p>
            )}
          </motion.div>
        </div>
        {/* Corretor badge */}
        {corretor && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2.5 bg-black/40 backdrop-blur-md rounded-full pr-4 pl-1 py-1">
            {corretor.avatar_url ? (
              <img src={corretor.avatar_url} alt={corretor.nome} className="w-9 h-9 rounded-full border-2 border-white/30 object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600/40 border-2 border-white/30 flex items-center justify-center text-white font-bold text-sm">
                {corretor.nome.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-white/60 text-[10px] uppercase tracking-widest">Seleção por</p>
              <p className="text-white font-semibold text-sm">{corretor.nome}</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Content ─── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Price + Specs row */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            {imovel.descontoMax && (
              <span className="inline-block text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full mb-2">
                {imovel.descontoMax} OFF
              </span>
            )}
            {imovel.precoDe && (
              <p className="text-base text-slate-400 line-through">{imovel.precoDe}</p>
            )}
            {imovel.precoPor ? (
              <p className="text-3xl sm:text-4xl font-black text-emerald-600">{imovel.precoPor}</p>
            ) : imovel.valor ? (
              <p className="text-3xl sm:text-4xl font-black text-slate-900">{formatBRL(imovel.valor)}</p>
            ) : null}
            {imovel.condicoes && (
              <p className="text-sm text-slate-500 mt-1">{imovel.condicoes}</p>
            )}
          </div>
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 py-3.5 rounded-full transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 shrink-0"
            >
              <Phone className="h-5 w-5" />
              Falar com {corretor?.nome?.split(" ")[0] || "corretor"}
              <ArrowRight className="h-5 w-5" />
            </a>
          )}
        </motion.div>

        {/* Specs pills */}
        {specs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-3">
            {specs.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-slate-700">
                <s.icon className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Description */}
        {imovel.descricao && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">Sobre o empreendimento</h2>
            <p className="text-slate-600 leading-relaxed text-base whitespace-pre-line">{imovel.descricao}</p>
          </motion.div>
        )}

        {/* Dorms / Metragens if available */}
        {(imovel.dorms || imovel.metragens) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid sm:grid-cols-2 gap-4">
            {imovel.dorms && (
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Tipologias</p>
                <p className="text-sm text-slate-700 font-medium">{imovel.dorms}</p>
              </div>
            )}
            {imovel.metragens && (
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Metragens</p>
                <p className="text-sm text-slate-700 font-medium">{imovel.metragens}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Photo thumbnails grid */}
        {imovel.fotos.length > 1 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Galeria</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {imovel.fotos.map((foto, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onOpenLightbox(imovel.fotos, i)}
                >
                  <img src={foto} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Vitrine message */}
        {vitrine.mensagem && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center"
          >
            <p className="text-slate-600 italic">"{vitrine.mensagem}"</p>
            {corretor && <p className="text-sm text-slate-400 mt-2">— {corretor.nome}</p>}
          </motion.div>
        )}
        {/* Lead Capture Form */}
        <LeadCaptureForm
          empreendimento={imovel.empreendimento || imovel.titulo || vitrine.titulo}
          source="vitrine_melnick_day"
        />
      </div>

      {/* ─── CTA Footer ─── */}
      {whatsappLink && (
        <section className="bg-gradient-to-r from-slate-900 to-blue-900 py-12">
          <div className="max-w-3xl mx-auto px-4 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Interessado?</h2>
            <p className="text-white/60">Fale agora com {corretor?.nome} e agende uma visita.</p>
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

      {/* Footer */}
      <footer className="py-8 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-400">
            Seleção personalizada por <span className="font-medium text-slate-600">{corretor?.nome || "UHome"}</span>
          </p>
          <p className="text-xs text-slate-300 mt-1">UHome Sales</p>
        </div>
      </footer>

      {/* Floating WhatsApp (mobile) */}
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
    </div>
  );
}

/* ═══════════════ Multi-Property Card ═══════════════ */
function MelnickDayCard({ imovel, index, onOpenLightbox }: { imovel: VitrineImovel; index: number; onOpenLightbox: (fotos: string[], idx: number) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 group"
    >
      <PhotoCarousel fotos={imovel.fotos} onOpen={(idx) => onOpenLightbox(imovel.fotos, idx)} />
      <div className="p-5 space-y-3">
        {imovel.segmento && (
          <span className="inline-block text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
            {imovel.segmento}
          </span>
        )}
        <h3 className="text-lg font-bold text-slate-900 leading-tight">{imovel.titulo}</h3>
        {imovel.bairro && (
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            {imovel.bairro} — Porto Alegre
          </p>
        )}
        {imovel.descricao && (
          <p className="text-sm text-slate-500 line-clamp-3">{imovel.descricao}</p>
        )}
        {imovel.descontoMax && (
          <span className="inline-block text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {imovel.descontoMax} OFF
          </span>
        )}
        <div className="pt-2 border-t border-slate-100 space-y-0.5">
          {imovel.precoDe && <p className="text-sm text-slate-400 line-through">{imovel.precoDe}</p>}
          {imovel.precoPor ? (
            <p className="text-2xl font-black text-emerald-600">{imovel.precoPor}</p>
          ) : imovel.valor ? (
            <p className="text-2xl font-black text-slate-900">{formatBRL(imovel.valor)}</p>
          ) : null}
        </div>
        {imovel.condicoes && <p className="text-xs text-slate-500 italic">{imovel.condicoes}</p>}
      </div>
    </motion.div>
  );
}

function ImovelCard({ imovel, index, onOpenLightbox }: { imovel: VitrineImovel; index: number; onOpenLightbox: (fotos: string[], idx: number) => void }) {
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
        {imovel.descricao && (
          <p className="text-sm text-slate-500 line-clamp-3">{imovel.descricao}</p>
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
            <p className="text-2xl font-black text-slate-900">{formatBRL(imovel.valor)}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════ Main Page ═══════════════ */
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

  const isMelnickDay = data?.vitrine?.tipo === "melnick_day";
  const { vitrine, corretor, imoveis } = data;
  const isSingle = imoveis.length === 1;

  const whatsappLink = corretor?.telefone
    ? `https://wa.me/55${corretor.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Olá ${corretor.nome}! Vi a seleção de imóveis "${vitrine.titulo}" e gostaria de mais informações.`
      )}`
    : null;

  const openLightbox = (fotos: string[], idx: number) => setLightbox({ fotos, idx });

  return (
    <>
      {/* Single property = immersive dedicated layout */}
      {isSingle ? (
        <SinglePropertyView
          imovel={imoveis[0]}
          corretor={corretor}
          vitrine={vitrine}
          onOpenLightbox={openLightbox}
          whatsappLink={whatsappLink}
        />
      ) : (
        /* Multi-property = grid layout */
        <div className="min-h-screen bg-white">
          {/* Hero */}
          <header className={`relative overflow-hidden ${isMelnickDay ? "bg-gradient-to-br from-[#0a1628] via-[#0d2137] to-[#1a3a5c]" : "bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900"}`}>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: "radial-gradient(circle at 25% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(59,130,246,0.15) 0%, transparent 50%)"
              }} />
            </div>
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center space-y-5">
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
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">{vitrine.titulo}</h1>
                {vitrine.mensagem && (
                  <p className="text-white/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">{vitrine.mensagem}</p>
                )}
                <div className="flex items-center justify-center gap-6 text-white/50 text-sm pt-2">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    {imoveis.length} imóve{imoveis.length !== 1 ? "is" : "l"}
                  </span>
                  {whatsappLink && (
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
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
            <div className="absolute bottom-0 left-0 right-0">
              <svg viewBox="0 0 1440 60" fill="none" className="w-full">
                <path d="M0 60L48 55C96 50 192 40 288 35C384 30 480 30 576 33.3C672 36.7 768 43.3 864 45C960 46.7 1056 43.3 1152 40C1248 36.7 1344 33.3 1392 31.7L1440 30V60H0Z" fill="white" />
              </svg>
            </div>
          </header>

          {/* Grid */}
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
                  isMelnickDay ? (
                    <MelnickDayCard key={imovel.id} imovel={imovel} index={i} onOpenLightbox={openLightbox} />
                  ) : (
                    <ImovelCard key={imovel.id} imovel={imovel} index={i} onOpenLightbox={openLightbox} />
                  )
                ))}
              </div>
            )}
          </main>

          {/* Lead Capture Form */}
          <div className="max-w-lg mx-auto px-4 sm:px-6 pb-8">
            <LeadCaptureForm
              empreendimento={isMelnickDay ? vitrine.titulo : imoveis[0]?.empreendimento || vitrine.titulo}
              source={isMelnickDay ? "vitrine_melnick_day" : "vitrine_uhome"}
            />
          </div>

          {/* CTA Footer */}
          {whatsappLink && (
            <section className="bg-gradient-to-r from-slate-900 to-blue-900 py-12">
              <div className="max-w-3xl mx-auto px-4 text-center space-y-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Gostou de algum imóvel?</h2>
                <p className="text-white/60">Entre em contato com {corretor?.nome} para agendar uma visita ou tirar dúvidas.</p>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 py-3.5 rounded-full transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 text-lg"
                >
                  <Phone className="h-5 w-5" />
                  Falar pelo WhatsApp
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>
            </section>
          )}

          <footer className="py-8 border-t border-slate-100">
            <div className="max-w-6xl mx-auto px-4 text-center">
              <p className="text-sm text-slate-400">Seleção personalizada por <span className="font-medium text-slate-600">{corretor?.nome || "UHome"}</span></p>
              <p className="text-xs text-slate-300 mt-1">UHome Sales</p>
            </div>
          </footer>

          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
              className="fixed bottom-6 right-6 z-50 sm:hidden bg-emerald-500 text-white rounded-full p-4 shadow-2xl shadow-emerald-500/30 hover:bg-emerald-600 transition-all"
            >
              <Phone className="h-6 w-6" />
            </a>
          )}
        </div>
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
                <img src={lightbox.fotos[lightbox.idx]} alt="" className="w-full max-h-[85vh] object-contain" />
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
    </>
  );
}
