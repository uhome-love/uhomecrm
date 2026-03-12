import { useState } from "react";
import { ChevronLeft, ChevronRight, Building2, MapPin, MessageCircle } from "lucide-react";
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
}

export default function PropertyCard({ item, index, variant = "selection", whatsappBase, corretorNome }: PropertyCardProps) {
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
      transition={{ delay: index * 0.1, type: "spring", stiffness: 80, damping: 20 }}
      className="group bg-white rounded-3xl overflow-hidden flex flex-col"
      style={{
        boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        border: "1px solid rgba(226,232,240,0.8)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "0 20px 60px rgba(30,64,175,0.12), 0 8px 20px rgba(0,0,0,0.08)";
        e.currentTarget.style.transform = "translateY(-6px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] bg-slate-50 overflow-hidden">
        {fotos.length > 0 ? (
          <>
            <img src={fotos[currentImg]} alt={item.empreendimento || ""} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {fotos.length > 1 && (
              <>
                <button onClick={() => setCurrentImg((currentImg - 1 + fotos.length) % fotos.length)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm text-slate-700 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-white hover:scale-110">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setCurrentImg((currentImg + 1) % fotos.length)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm text-slate-700 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-white hover:scale-110">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {fotos.slice(0, 6).map((_, i) => (
                    <button key={i} onClick={() => setCurrentImg(i)}
                      className={`rounded-full transition-all shadow-sm ${i === currentImg ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50 hover:bg-white/80"}`} />
                  ))}
                </div>
              </>
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
      <div className="p-6 flex-1 flex flex-col gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-slate-800 leading-tight tracking-tight">
            {item.empreendimento || item.titulo}
          </h3>
          {item.bairro && (
            <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-2 font-medium">
              <MapPin className="h-3.5 w-3.5 text-blue-500" /> {item.bairro}
            </p>
          )}
        </div>

        {/* Specs pills */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {item.metragens && (
            <span className="text-[11px] bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-semibold border border-blue-100">
              📐 {item.metragens}
            </span>
          )}
          {item.dorms && (
            <span className="text-[11px] bg-violet-50 text-violet-700 px-3 py-1.5 rounded-lg font-semibold border border-violet-100">
              🛏 {item.dorms}
            </span>
          )}
          {item.status && (
            <span className="text-[11px] bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg font-semibold border border-amber-100">
              🏗 {item.status}
            </span>
          )}
          {/* Selection variant: show detailed specs */}
          {variant === "selection" && !item.metragens && (
            <>
              {item.area && (
                <span className="text-[11px] bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-semibold border border-blue-100">
                  📐 {item.area}m²
                </span>
              )}
              {item.quartos && (
                <span className="text-[11px] bg-violet-50 text-violet-700 px-3 py-1.5 rounded-lg font-semibold border border-violet-100">
                  🛏 {item.quartos} dorm{item.quartos > 1 ? "s" : ""}
                </span>
              )}
              {item.vagas && (
                <span className="text-[11px] bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg font-semibold border border-slate-200">
                  🚗 {item.vagas} vaga{item.vagas > 1 ? "s" : ""}
                </span>
              )}
            </>
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

        {/* CTA */}
        {whatsappBase && (
          <a
            href={`${whatsappBase}?text=${encodeURIComponent(`Olá${corretorNome ? ` ${corretorNome}` : ""}! ${whatsappMsg}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #1e40af, #3b82f6)",
              boxShadow: "0 6px 20px rgba(59,130,246,0.35)",
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Quero saber mais
          </a>
        )}
      </div>
    </motion.div>
  );
}
