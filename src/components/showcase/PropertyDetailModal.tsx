import { useState } from "react";
import { X, ChevronLeft, ChevronRight, MapPin, Maximize2, BedDouble, Bath, Car, Ruler, MessageCircle, Phone, CalendarCheck, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBRL } from "@/lib/utils";
import type { ShowcaseImovel, ShowcaseCorretor } from "./types";
import { buildWhatsappLink } from "./types";

interface Props {
  item: ShowcaseImovel;
  corretor: ShowcaseCorretor | null;
  open: boolean;
  onClose: () => void;
  onTrack?: (action: string, imovelId: number | string) => void;
}

export default function PropertyDetailModal({ item, corretor, open, onClose, onTrack }: Props) {
  const [currentImg, setCurrentImg] = useState(0);
  const fotos = item.fotos || [];

  if (!open) return null;

  const specs = [
    { icon: Ruler, label: "Área", value: item.area ? `${item.area}m²` : null },
    { icon: BedDouble, label: "Dormitórios", value: item.quartos ? `${item.quartos} dorm${item.quartos > 1 ? "s" : ""}` : null },
    { icon: BedDouble, label: "Suítes", value: item.suites ? `${item.suites} suíte${item.suites > 1 ? "s" : ""}` : null },
    { icon: Car, label: "Vagas", value: item.vagas ? `${item.vagas} vaga${item.vagas > 1 ? "s" : ""}` : null },
    { icon: Bath, label: "Banheiros", value: item.banheiros ? `${item.banheiros} banheiro${item.banheiros > 1 ? "s" : ""}` : null },
  ].filter(s => s.value);

  const whatsappLink = buildWhatsappLink(
    corretor?.telefone,
    corretor?.nome || "UHome",
    `Vi o imóvel ${item.empreendimento || item.titulo} e gostaria de mais informações.`
  );

  const visitaLink = buildWhatsappLink(
    corretor?.telefone,
    corretor?.nome || "UHome",
    `Gostaria de agendar uma visita ao ${item.empreendimento || item.titulo}.`
  );

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-3xl my-4 sm:my-8 mx-4 bg-white rounded-3xl overflow-hidden"
          style={{ boxShadow: "0 40px 100px rgba(0,0,0,0.4)" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button onClick={onClose}
            className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-all hover:scale-110">
            <X className="h-5 w-5 text-slate-700" />
          </button>

          {/* Gallery */}
          <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
            {fotos.length > 0 ? (
              <>
                <img
                  src={fotos[currentImg]}
                  alt={item.empreendimento || item.titulo}
                  className="w-full h-full object-cover"
                />
                {fotos.length > 1 && (
                  <>
                    <button onClick={() => setCurrentImg((currentImg - 1 + fotos.length) % fotos.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-2.5 shadow-lg hover:bg-white transition-all">
                      <ChevronLeft className="h-5 w-5 text-slate-700" />
                    </button>
                    <button onClick={() => setCurrentImg((currentImg + 1) % fotos.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-2.5 shadow-lg hover:bg-white transition-all">
                      <ChevronRight className="h-5 w-5 text-slate-700" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 text-white text-xs font-medium">
                      {currentImg + 1} / {fotos.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)" }}>
                <Building2 className="h-16 w-16 text-slate-300" />
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {fotos.length > 1 && (
            <div className="flex gap-1.5 px-6 pt-4 overflow-x-auto scrollbar-thin">
              {fotos.slice(0, 8).map((f, i) => (
                <button key={i} onClick={() => setCurrentImg(i)}
                  className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all ${
                    i === currentImg ? "ring-2 ring-blue-500 ring-offset-2" : "opacity-60 hover:opacity-100"
                  }`}>
                  <img src={f} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Title & location */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {item.empreendimento || item.titulo}
              </h2>
              {item.bairro && (
                <p className="flex items-center gap-1.5 mt-2 text-slate-500 font-medium">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  {item.endereco || item.bairro}
                </p>
              )}
            </div>

            {/* Price */}
            {item.valor && (
              <div className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, #f0f9ff, #eff6ff)", border: "1px solid #bfdbfe" }}>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Valor</p>
                <p className="text-3xl font-black text-slate-900">{formatBRL(item.valor)}</p>
              </div>
            )}

            {/* Specs grid */}
            {specs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {specs.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-3.5"
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#eff6ff" }}>
                      <s.icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{s.label}</p>
                      <p className="text-sm font-bold text-slate-800">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {item.descricao && (
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Descrição</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{item.descricao}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3 pt-2">
              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onTrack?.("whatsapp_click", item.id)}
                  className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", boxShadow: "0 8px 30px rgba(34,197,94,0.35)" }}
                >
                  <MessageCircle className="h-5 w-5" />
                  Falar no WhatsApp
                </a>
              )}
              <div className="flex gap-3">
                {visitaLink && (
                  <a
                    href={visitaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onTrack?.("schedule_click", item.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all"
                    style={{ background: "#f0f9ff", color: "#1e40af", border: "1px solid #bfdbfe" }}
                  >
                    <CalendarCheck className="h-4 w-4" />
                    Agendar visita
                  </a>
                )}
                {corretor?.telefone && (
                  <a
                    href={`tel:+55${corretor.telefone.replace(/\D/g, "")}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all"
                    style={{ background: "#f8fafc", color: "#334155", border: "1px solid #e2e8f0" }}
                  >
                    <Phone className="h-4 w-4" />
                    Ligar agora
                  </a>
                )}
              </div>
            </div>

            {/* Corretor */}
            {corretor && (
              <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                {corretor.avatar_url ? (
                  <img src={corretor.avatar_url} alt={corretor.nome} className="w-12 h-12 rounded-full object-cover" style={{ border: "2px solid #e2e8f0" }} />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                    {corretor.nome.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Seu consultor</p>
                  <p className="font-bold text-slate-800">{corretor.nome}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
