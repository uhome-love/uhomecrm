import { useState } from "react";
import { MapPin, BedDouble, Car, Ruler, Home, Sparkles, Play } from "lucide-react";
import { motion } from "framer-motion";
import { formatBRL } from "@/lib/utils";
import ShowcaseHero from "./ShowcaseHero";
import ConsultantCard from "./ConsultantCard";
import ShowcaseGallery from "./ShowcaseGallery";
import ContactCTA from "./ContactCTA";
import FooterBranding from "./FooterBranding";
import ShowcaseLightbox from "./ShowcaseLightbox";
import { buildWhatsappLink, extractYoutubeId } from "./types";
import type { ShowcaseData, ShowcaseLanding } from "./types";

interface Props {
  data: ShowcaseData;
}

/**
 * Layout: Página dedicada de produto/campanha (Anúncios no Ar)
 * Full landing page with hero, specs, description, tipologias, diferenciais, galeria, plantas, vídeo, mapa, CTA
 */
export default function ProductPageLayout({ data }: Props) {
  const { vitrine, corretor, imoveis, landing } = data;
  const [lightbox, setLightbox] = useState<{ fotos: string[]; idx: number } | null>(null);

  const imovel = imoveis[0] || null;
  const l = landing || {} as ShowcaseLanding;
  const cor = l.cor_primaria || "#1e3a5f";
  const nome = l.landing_titulo || imovel?.empreendimento || imovel?.titulo || vitrine.titulo;
  const subtitulo = l.landing_subtitulo || vitrine.subtitulo || "";
  const descricao = l.descricao || imovel?.descricao || "";
  const bairro = l.bairro || imovel?.bairro || "";
  const fotos = imovel?.fotos || l.fotos || [];
  const diferenciais = l.diferenciais || [];
  const plantas = l.plantas || [];
  const videoUrl = l.video_url || "";
  const mapaUrl = l.mapa_url || "";
  const tipologias = l.tipologias || [];
  const valorMin = l.valor_min || imovel?.valor || 0;
  const valorMax = l.valor_max || 0;
  const vagas = l.vagas || imovel?.vagas || 0;
  const statusObra = l.status_obra || "";
  const previsaoEntrega = l.previsao_entrega || "";

  const whatsappLink = buildWhatsappLink(corretor?.telefone, corretor?.nome || "", `Vi a página do ${nome} e gostaria de mais informações.`);

  const areaLabel = (() => {
    if (tipologias.length > 0) {
      const areas = tipologias.flatMap(t => [t.area_min, t.area_max].filter(Boolean)).map(Number).filter(n => n > 0);
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
      {/* HERO */}
      <ShowcaseHero fotos={fotos.slice(0, 8)} cor={cor} variant="immersive">
        {/* Corretor badge */}
        {corretor && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-5 left-5 sm:top-8 sm:left-8 flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-full pr-5 pl-1.5 py-1.5 border border-white/10"
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
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12 lg:p-16">
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
              {subtitulo && <p className="text-lg sm:text-xl text-white/70 mt-3 max-w-2xl font-light">{subtitulo}</p>}
              {bairro && (
                <p className="text-white/60 text-sm mt-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {bairro} — Porto Alegre
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </ShowcaseHero>

      {/* SPECS BAR */}
      <section className="border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            {specs.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <s.icon className="h-5 w-5" style={{ color: cor }} />
                <span className="text-sm font-semibold text-slate-700">{s.label}</span>
              </motion.div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            {valorMax > 0 && valorMin > 0 ? (
              <div className="text-right">
                <p className="text-xs text-slate-400 font-medium">Faixa de valores</p>
                <p className="text-2xl font-black" style={{ color: cor }}>{formatBRL(valorMin)} — {formatBRL(valorMax)}</p>
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

      {/* DESCRIPTION + CONSULTANT */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        <div className="grid lg:grid-cols-5 gap-12">
          <div className="lg:col-span-3 space-y-8">
            {descricao && (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Sobre o empreendimento</h2>
                <p className="text-slate-600 leading-relaxed text-base whitespace-pre-line">{descricao}</p>
              </motion.div>
            )}

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

          <div className="lg:col-span-2">
            {corretor && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="sticky top-8 rounded-2xl border border-slate-200 p-6 sm:p-8 bg-gradient-to-b from-white to-slate-50/50 shadow-xl shadow-slate-200/50"
              >
                <ConsultantCard corretor={corretor} cor={cor} whatsappLink={whatsappLink} contextLabel="Consultor responsável" />
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <ShowcaseGallery fotos={fotos} onOpen={(f, i) => setLightbox({ fotos: f, idx: i })} />

      {/* PLANTAS */}
      {plantas.length > 0 && (
        <section className="py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Plantas</h2>
              <div className={`grid gap-4 ${plantas.length === 1 ? "max-w-lg mx-auto" : "grid-cols-1 sm:grid-cols-2"}`}>
                {plantas.map((url, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                    className="rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:shadow-lg transition-shadow bg-white p-2"
                    onClick={() => setLightbox({ fotos: plantas, idx: i })}>
                    <img src={url} alt={`Planta ${i + 1}`} className="w-full h-auto rounded-lg" loading="lazy" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* VÍDEO */}
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

      {/* LOCALIZAÇÃO */}
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

      {/* CTA */}
      {corretor && <ContactCTA corretor={corretor} cor={cor} whatsappLink={whatsappLink} variant="product" />}

      <FooterBranding corretorNome={corretor?.nome} />

      {/* Floating WhatsApp mobile */}
      {whatsappLink && (
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 sm:hidden text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110"
          style={{ backgroundColor: cor, boxShadow: `0 10px 25px -5px ${cor}50` }}>
          <MapPin className="h-6 w-6" />
        </a>
      )}

      <ShowcaseLightbox lightbox={lightbox} onClose={() => setLightbox(null)} onChange={setLightbox} />
    </div>
  );
}
