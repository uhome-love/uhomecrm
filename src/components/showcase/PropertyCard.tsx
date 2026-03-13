import { useState } from "react";
import { ChevronLeft, ChevronRight, Building2, MapPin, MessageCircle, Eye, BedDouble, Car, Ruler } from "lucide-react";
import { motion } from "framer-motion";
import { formatBRL } from "@/lib/utils";
import type { ShowcaseImovel } from "./types";
import { getSegmentoStyle } from "./types";

type CardVariant = "product" | "campaign" | "selection";

interface PropertyCardProps {
  item: ShowcaseImovel;
  index: number;
  variant?: CardVariant;
  whatsappBase?: string | null;
  corretorNome?: string;
  onViewDetails?: (item: ShowcaseImovel) => void;
  onTrack?: (action: string, imovelId: number | string) => void;
}

export default function PropertyCard({ item, index, variant = "selection", whatsappBase, corretorNome, onViewDetails, onTrack }: PropertyCardProps) {
  const [currentImg, setCurrentImg] = useState(0);
  const fotos = item.fotos || [];
  const seg = item.segmento ? getSegmentoStyle(item.segmento) : null;

  const whatsappMsg = variant === "campaign"
    ? `Tenho interesse no ${item.empreendimento || item.titulo} - Melnick Day 2026`
    : `Vi o imóvel ${item.titulo} e gostaria de mais informações.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 80, damping: 20 }}
      className="group bg-white rounded-3xl overflow-hidden flex flex-col"
      style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        border: "1px solid rgba(226,232,240,0.8)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "0 24px 60px rgba(30,64,175,0.12), 0 8px 20px rgba(0,0,0,0.08)";
        e.currentTarget.style.transform = "translateY(-8px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Image — large aspect ratio */}
      <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden cursor-pointer"
        onClick={() => { onViewDetails?.(item); onTrack?.("card_click", item.id); }}>
        {fotos.length > 0 ? (
          <>
            <img src={fotos[currentImg]} alt={item.empreendimento || ""} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            {fotos.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); setCurrentImg((currentImg - 1 + fotos.length) % fotos.length); }}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm text-slate-700 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-white hover:scale-110">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={e => { e.stopPropagation(); setCurrentImg((currentImg + 1) % fotos.length); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm text-slate-700 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-white hover:scale-110">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {fotos.slice(0, 6).map((_, i) => (
                    <button key={i} onClick={e => { e.stopPropagation(); setCurrentImg(i); }}
                      className={`rounded-full transition-all shadow-sm ${i === currentImg ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50 hover:bg-white/80"}`} />
                  ))}
                </div>
              </>
            )}
            {/* Photo count badge */}
            {fotos.length > 1 && (
              <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-[10px] font-bold flex items-center gap-1">
                <Eye className="h-3 w-3" /> {fotos.length}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)" }}>
            <Building2 className="h-14 w-14 text-slate-300" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {seg && (
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm"
              style={{ background: seg.bg, color: seg.color, border: `1px solid ${seg.border}` }}>
              {seg.label}
            </span>
          )}
        </div>
        {item.descontoMax && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>
            🔥 Até {item.descontoMax} OFF
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 leading-tight tracking-tight">
            {item.empreendimento || item.titulo}
          </h3>
          {item.bairro && (
            <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-1.5 font-medium">
              <MapPin className="h-3.5 w-3.5 text-blue-500" /> {item.bairro}
            </p>
          )}
        </div>

        {/* Description preview */}
        {variant === "selection" && item.descricao && (
          <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">{item.descricao}</p>
        )}

        {/* Specs — clean icon row */}
        <div className="flex flex-wrap gap-3 mt-1">
          {item.metragens ? (
            <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5 text-blue-500" /> {item.metragens}
            </span>
          ) : item.area ? (
            <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5 text-blue-500" /> {item.area}m²
            </span>
          ) : null}
          {item.dorms ? (
            <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5 text-violet-500" /> {item.dorms}
            </span>
          ) : item.quartos ? (
            <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5 text-violet-500" /> {item.quartos} dorm{item.quartos > 1 ? "s" : ""}
              {item.suites ? ` (${item.suites} suíte${item.suites > 1 ? "s" : ""})` : ""}
            </span>
          ) : null}
          {item.vagas && !item.metragens && (
            <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
              <Car className="h-3.5 w-3.5 text-slate-400" /> {item.vagas} vaga{item.vagas > 1 ? "s" : ""}
            </span>
          )}
          {item.status && (
            <span className="text-[11px] text-amber-700 font-semibold">🏗 {item.status}</span>
          )}
        </div>

        {/* Prices */}
        <div className="mt-auto pt-4 border-t border-slate-100">
          {variant === "campaign" && item.precoDe && (
            <p className="text-xs text-slate-400 line-through font-medium">De {item.precoDe}</p>
          )}
          {variant === "campaign" && item.precoPor ? (
            <p className="text-2xl font-black mt-0.5">
              <span className="text-slate-400 text-base font-bold">Por </span>
              <span style={{ color: "#059669" }}>{item.precoPor}</span>
            </p>
          ) : item.valor ? (
            <p className="text-2xl font-black text-slate-800">{formatBRL(item.valor)}</p>
          ) : null}
          {item.condicoes && (
            <p className="text-[11px] text-slate-500 mt-1 font-medium">{item.condicoes}</p>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2 mt-1">
          {onViewDetails && (
            <button
              onClick={() => { onViewDetails(item); onTrack?.("detail_click", item.id); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #1e3a5f, #2563eb)", color: "white", boxShadow: "0 4px 15px rgba(37,99,235,0.3)" }}
            >
              <Eye className="h-4 w-4" />
              Ver detalhes
            </button>
          )}
          {whatsappBase && (
            <a
              href={`${whatsappBase}?text=${encodeURIComponent(`Olá${corretorNome ? ` ${corretorNome}` : ""}! ${whatsappMsg}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onTrack?.("whatsapp_click", item.id)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #16a34a, #22c55e)",
                color: "white",
                boxShadow: "0 4px 15px rgba(34,197,94,0.3)",
                flex: onViewDetails ? "0 0 auto" : "1",
                paddingLeft: onViewDetails ? "1rem" : undefined,
                paddingRight: onViewDetails ? "1rem" : undefined,
              }}
            >
              <MessageCircle className="h-4 w-4" />
              {!onViewDetails && "Quero saber mais"}
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
