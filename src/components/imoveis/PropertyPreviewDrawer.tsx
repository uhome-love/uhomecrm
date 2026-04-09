/**
 * Premium Quick Preview Drawer — vitrine-inspired mini-landing-page.
 * Desktop: right-side sheet (520px).
 * Mobile: nearly full-screen sheet (92vh).
 *
 * OWNS its own lightbox: clicking the hero opens a true fullscreen gallery
 * rendered via portal above everything. No nested/competing viewers.
 *
 * Navigation separation:
 *  - Drawer prev/next = navigate properties
 *  - Lightbox prev/next = navigate photos (keyboard captured in lightbox)
 */

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Copy, Phone, MapPin, CalendarClock, Share2, Building2,
  Loader2, UserCircle, Mail, BedDouble, Bath, Car,
  Maximize2, ChevronLeft, ChevronRight, RulerIcon, DoorOpen,
  MessageCircle, ExternalLink,
} from "lucide-react";
import PhotoLightbox from "@/components/imoveis/PhotoLightbox";
import { useBrokerSlug } from "@/hooks/useBrokerSlug";
import { gerarSlugUhome } from "@/services/siteImoveis";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getPropertyPreviewImages, getPropertyThumbImages, getPropertyFullscreenImages,
  extractOrigemExterna, extractEntrega, extractEndereco,
  getNum, getNumIncZero, fmtBRL,
} from "@/lib/imovelHelpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const responsavelCache = new Map<string, { origem: any | null }>();

interface PropertyPreviewDrawerProps {
  item: any | null;
  open: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onFavorite: (id: string) => void;
  getPreco: (item: any) => string;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  positionLabel?: string;
  trackEvent?: (params: { event_type: string; imovel_codigo?: string; payload?: Record<string, any> }) => void;
}

export default function PropertyPreviewDrawer({
  item, open, onClose, isFavorite, onFavorite, getPreco,
  selectMode, isSelected, onToggleSelect,
  onPrev, onNext, hasPrev = false, hasNext = false, positionLabel,
  trackEvent,
}: PropertyPreviewDrawerProps) {
  const [imageIdx, setImageIdx] = useState(0);
  const [origem, setOrigem] = useState<any>(null);
  const [origemLoading, setOrigemLoading] = useState(false);
  const [origemFetched, setOrigemFetched] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // ── Internal lightbox state ──
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const slugRef = useBrokerSlug();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setImageIdx(0);
    setOrigem(null);
    setOrigemFetched(false);
    setLightboxOpen(false);
    if (item?.codigo && responsavelCache.has(item.codigo)) {
      setOrigem(responsavelCache.get(item.codigo)!.origem);
      setOrigemFetched(true);
    }
  }, [item?.codigo]);

  useEffect(() => {
    if (!open || !item?.codigo || origemFetched) return;
    const codigo = item.codigo;
    if (responsavelCache.has(codigo)) {
      setOrigem(responsavelCache.get(codigo)!.origem);
      setOrigemFetched(true);
      return;
    }
    setOrigemLoading(true);
    supabase.functions.invoke("jetimob-proxy", { body: { action: "get_imovel", codigo } })
      .then(({ data }) => {
        const imovel = data?.imovel ?? data?.data?.imovel ?? null;
        const result = imovel ? extractOrigemExterna(imovel) : null;
        responsavelCache.set(codigo, { origem: result });
        setOrigem(result);
      })
      .catch(() => {})
      .finally(() => { setOrigemLoading(false); setOrigemFetched(true); });
  }, [open, item?.codigo, origemFetched]);

  // ── Keyboard: property nav (suppressed when lightbox is open) ──
  useEffect(() => {
    if (!open || lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === "ArrowRight" && hasNext && onNext) { e.preventDefault(); onNext(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, lightboxOpen, hasPrev, hasNext, onPrev, onNext]);

  // ── Tracking ──
  const trackedRef = useRef<Map<string, number>>(new Map());
  const DEDUP_WINDOW = 60_000;
  useEffect(() => {
    if (!open || !item?.codigo || !trackEvent) return;
    const codigo = String(item.codigo);
    const now = Date.now();
    const lastTracked = trackedRef.current.get(codigo);
    if (lastTracked && now - lastTracked < DEDUP_WINDOW) return;
    trackedRef.current.set(codigo, now);
    trackEvent({
      event_type: "property_previewed",
      imovel_codigo: codigo,
      payload: {
        titulo: item.titulo_anuncio || item.empreendimento_nome || null,
        bairro: item.bairro || item.endereco_bairro || null,
        preco: getPreco(item),
      },
    });
  }, [open, item?.codigo, trackEvent, getPreco]);

  // ── Swipe: property navigation on mobile ──
  const touchRef = useRef<{ startX: number; startY: number; swiping: boolean } | null>(null);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 50;
  const SWIPE_ANGLE_MAX = 30;

  useEffect(() => {
    if (!open || !isMobile || lightboxOpen) return;
    const el = swipeContainerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, swiping: false };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touchRef.current || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - touchRef.current.startX;
      const dy = e.touches[0].clientY - touchRef.current.startY;
      const angle = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
      if (Math.abs(dx) > 10 && (angle < SWIPE_ANGLE_MAX || angle > 180 - SWIPE_ANGLE_MAX)) {
        touchRef.current.swiping = true;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchRef.current) return;
      const t = touchRef.current;
      touchRef.current = null;
      if (!t.swiping) return;
      const endX = e.changedTouches[0].clientX;
      const dx = endX - t.startX;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (dx < 0 && hasNext && onNext) onNext();
      if (dx > 0 && hasPrev && onPrev) onPrev();
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [open, isMobile, lightboxOpen, hasPrev, hasNext, onPrev, onNext]);

  if (!item) return null;

  const previewImages = getPropertyPreviewImages(item);
  const fullscreenImages = getPropertyFullscreenImages(item);
  const thumbStrip = getPropertyThumbImages(item);
  const loc = extractEndereco(item);
  const codigo = item.codigo;
  const titulo = item.titulo_anuncio || item.empreendimento_nome || "";
  const dorms = getNum(item, "dormitorios");
  const suitesVal = getNum(item, "suites");
  const banhos = getNum(item, "banheiros");
  const area = getNumIncZero(item, "area_privativa", "area_util", "area_total");
  const areaTotal = getNumIncZero(item, "area_total");
  const vagasVal = getNum(item, "garagens", "vagas");
  const cond = getNum(item, "valor_condominio");
  const iptu = getNum(item, "valor_iptu");
  const entrega = extractEntrega(item);
  const imovelId = String(codigo || item.id_imovel || item.id);
  const descricao = item.descricao || item.descricao_interna || "";
  const tipo = item.tipo || item.subtipo || "";
  const empreendimento = item.empreendimento_nome || item.empreendimento || "";
  const construtora = item.construtora || "";
  const andar = item.andar || "";
  const posicaoSolar = item.posicao_solar || "";
  const situacao = item.situacao || item.status || "";
  const finalidade = item.finalidade || item.contrato || "";
  const features = Array.isArray(item.features) ? item.features : [];
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const tourVirtual = item.tour_virtual_url || "";
  const videoUrl = item.video_url || "";
  const aceitaFinanciamento = item.aceita_financiamento || item.is_mcmv || false;

  const prevImage = () => setImageIdx(i => (i > 0 ? i - 1 : previewImages.length - 1));
  const nextImage = () => setImageIdx(i => (i < previewImages.length - 1 ? i + 1 : 0));

  const openFullscreen = () => {
    if (previewImages.length === 0) return;
    setLightboxIndex(imageIdx);
    setLightboxOpen(true);
  };

  const propertyUrl = codigo
    ? (() => {
        const slug = gerarSlugUhome({ tipo, quartos: dorms ?? 0, bairro: loc.bairro, codigo, slug: item?.slug });
        return slugRef
          ? `https://uhome.com.br/c/${slugRef}/imovel/${slug}`
          : `https://uhome.com.br/imovel/${slug}`;
      })()
    : "";

  const copyData = () => {
    const text = [
      titulo, getPreco(item),
      `${[loc.endereco, loc.bairro, loc.cidade].filter(Boolean).join(" · ")}`,
      dorms ? `${dorms} dorm${suitesVal ? ` · ${suitesVal} suítes` : ""}` : "",
      area ? `${area} m²` : "",
      vagasVal ? `${vagasVal} vaga${vagasVal > 1 ? "s" : ""}` : "",
      codigo ? `Cód. ${codigo}` : "",
      propertyUrl,
    ].filter(Boolean).join(" · ");
    navigator.clipboard.writeText(text);
    toast.success("Dados copiados!");
  };

  const whatsappText = encodeURIComponent(
    [titulo, loc.bairro, getPreco(item), propertyUrl].filter(Boolean).join(" - ")
  );

  const specs = [
    dorms != null && dorms > 0 ? { icon: BedDouble, value: String(dorms), label: dorms === 1 ? "Dorm" : "Dorms" } : null,
    suitesVal != null && suitesVal > 0 ? { icon: DoorOpen, value: String(suitesVal), label: suitesVal === 1 ? "Suíte" : "Suítes" } : null,
    banhos != null && banhos > 0 ? { icon: Bath, value: String(banhos), label: banhos === 1 ? "Banho" : "Banhos" } : null,
    area != null && area > 0 ? { icon: RulerIcon, value: `${area}`, label: "m²" } : null,
    vagasVal != null && vagasVal > 0 ? { icon: Car, value: String(vagasVal), label: vagasVal === 1 ? "Vaga" : "Vagas" } : null,
  ].filter(Boolean) as { icon: any; value: string; label: string }[];

  const content = (
    <div ref={swipeContainerRef} className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Nav bar ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/40 bg-background/95 backdrop-blur-sm z-10">
        <Button
          variant="ghost" size="sm" onClick={onPrev} disabled={!hasPrev}
          className="gap-1 text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Anterior
        </Button>
        {positionLabel && (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{positionLabel}</span>
        )}
        <Button
          variant="ghost" size="sm" onClick={onNext} disabled={!hasNext}
          className="gap-1 text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          Próximo <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Hero Image — click opens fullscreen lightbox ── */}
        <div className="relative bg-muted/60 aspect-[4/3] group cursor-pointer" onClick={openFullscreen}>
          {previewImages.length > 0 ? (
            <>
              <img
                src={previewImages[imageIdx] || ""}
                alt={titulo}
                className="w-full h-full object-cover transition-transform duration-500"
              />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              {previewImages.length > 1 && (
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md rounded-full px-3 py-1 text-[11px] font-semibold text-white tabular-nums flex items-center gap-1.5">
                  <Maximize2 className="h-3 w-3" />
                  {imageIdx + 1} / {previewImages.length}
                </div>
              )}
              {previewImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  >
                    <ChevronLeft className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  >
                    <ChevronRight className="h-4 w-4 text-white" />
                  </button>
                </>
              )}
              {entrega.emObras && (
                <Badge className="absolute top-3 left-3 text-[10px] bg-amber-500 text-white border-0 shadow-lg gap-1 font-bold uppercase tracking-wider">
                  <CalendarClock className="h-3 w-3" />
                  {entrega.previsao ? `Entrega ${entrega.previsao}` : "Em obras"}
                </Badge>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Building2 className="h-16 w-16 opacity-15" />
            </div>
          )}
        </div>

        {/* ── Thumbnail strip ── */}
        {previewImages.length > 1 && (
          <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto bg-muted/30 scrollbar-none">
            {thumbStrip.slice(0, 8).map((img, i) => (
              <button
                key={i}
                onClick={() => setImageIdx(i)}
                className={cn(
                  "shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 transition-all",
                  i === imageIdx
                    ? "border-primary ring-1 ring-primary/30 scale-105"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
            {previewImages.length > 8 && (
              <button
                onClick={() => openFullscreen()}
                className="shrink-0 w-14 h-10 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border-2 border-transparent hover:border-primary/30"
              >
                +{previewImages.length - 8}
              </button>
            )}
          </div>
        )}

        {/* ── Content block ── */}
        <div className="px-5 pt-5 pb-4 space-y-5">
          <div>
            {tipo && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">{tipo}</p>
            )}
            <h2 className="text-lg font-bold text-foreground leading-tight">{titulo || "Imóvel"}</h2>
            {empreendimento && empreendimento !== titulo && (
              <p className="text-sm font-medium text-foreground/80 mt-0.5">{empreendimento}</p>
            )}
            {(loc.bairro || loc.endereco || loc.cidade) && (
              <div className="flex items-center gap-1.5 mt-1.5 text-sm text-foreground/70">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="font-medium">{[loc.endereco, loc.bairro, loc.cidade].filter(Boolean).join(" · ")}</span>
              </div>
            )}
            {codigo && (
              <p className="text-[11px] text-foreground/50 font-mono mt-1">Cód. {codigo}</p>
            )}
          </div>

          {/* Price block */}
          <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/70 mb-1">Valor</p>
            <p className="text-2xl font-extrabold text-foreground tracking-tight">{getPreco(item)}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              {cond != null && cond > 0 && (
                <p className="text-xs text-foreground/60">Condomínio: <span className="font-semibold text-foreground/80">{fmtBRL(cond)}</span></p>
              )}
              {iptu != null && iptu > 0 && (
                <p className="text-xs text-foreground/60">IPTU: <span className="font-semibold text-foreground/80">{fmtBRL(iptu)}</span></p>
              )}
            </div>
          </div>

          {/* Specs grid */}
          {specs.length > 0 && (
            <div className={cn(
              "grid gap-2",
              specs.length <= 3 ? "grid-cols-3" : specs.length === 4 ? "grid-cols-4" : "grid-cols-5"
            )}>
              {specs.map((s, i) => (
                <div key={i} className="flex flex-col items-center py-3 rounded-lg bg-muted/50 border border-border/50">
                  <s.icon className="h-4 w-4 text-primary mb-1.5" />
                  <span className="text-base font-bold text-foreground leading-none">{s.value}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Extra details */}
          {(areaTotal || andar || posicaoSolar || situacao || finalidade || construtora || aceitaFinanciamento || entrega.previsao) && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-2">Detalhes do imóvel</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {areaTotal != null && areaTotal > 0 && area !== areaTotal && (
                  <div><span className="text-foreground/50">Área total:</span> <span className="font-semibold text-foreground">{areaTotal} m²</span></div>
                )}
                {andar && (
                  <div><span className="text-foreground/50">Andar:</span> <span className="font-semibold text-foreground">{andar}</span></div>
                )}
                {posicaoSolar && (
                  <div><span className="text-foreground/50">Sol:</span> <span className="font-semibold text-foreground">{posicaoSolar}</span></div>
                )}
                {situacao && (
                  <div><span className="text-foreground/50">Situação:</span> <span className="font-semibold text-foreground">{situacao}</span></div>
                )}
                {finalidade && (
                  <div><span className="text-foreground/50">Finalidade:</span> <span className="font-semibold text-foreground">{finalidade}</span></div>
                )}
                {construtora && (
                  <div><span className="text-foreground/50">Construtora:</span> <span className="font-semibold text-foreground">{construtora}</span></div>
                )}
                {aceitaFinanciamento && (
                  <div><span className="font-semibold text-emerald-600">Aceita financiamento</span></div>
                )}
                {item.is_mcmv && (
                  <div><span className="font-semibold text-emerald-600">Minha Casa Minha Vida</span></div>
                )}
                {entrega.previsao && (
                  <div><span className="text-foreground/50">Entrega:</span> <span className="font-semibold text-foreground">{entrega.previsao}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Features / Comodidades */}
          {features.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-2">Comodidades</p>
              <div className="flex flex-wrap gap-1.5">
                {features.slice(0, 20).map((f: string, i: number) => (
                  <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted border border-border/50 text-foreground/70">{f}</span>
                ))}
                {features.length > 20 && (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted border border-border/50 text-muted-foreground">+{features.length - 20}</span>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t: string, i: number) => (
                <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/20">{t}</span>
              ))}
            </div>
          )}

          {/* Tour virtual / Video */}
          {(tourVirtual || videoUrl) && (
            <div className="flex gap-2">
              {tourVirtual && (
                <a href={tourVirtual} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full h-9 gap-1.5 text-xs font-semibold rounded-lg">
                    🏠 Tour Virtual
                  </Button>
                </a>
              )}
              {videoUrl && (
                <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full h-9 gap-1.5 text-xs font-semibold rounded-lg">
                    🎥 Vídeo
                  </Button>
                </a>
              )}
            </div>
          )}

          {propertyUrl && (
            <a href={propertyUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full h-11 text-sm font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 rounded-xl">
                <ExternalLink className="h-5 w-5" /> Abrir no uhome.com.br
              </Button>
            </a>
          )}

          <a href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full h-12 text-sm font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 rounded-xl">
              <MessageCircle className="h-5 w-5" /> Enviar por WhatsApp
            </Button>
          </a>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => onFavorite(imovelId)}
              className={cn(
                "h-10 gap-2 rounded-lg text-xs font-semibold",
                isFavorite && "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
              )}
            >
              <Heart className={cn("h-4 w-4", isFavorite ? "fill-red-500 text-red-500" : "")} />
              {isFavorite ? "Favoritado" : "Favoritar"}
            </Button>
            <Button variant="outline" size="sm" onClick={copyData} className="h-10 gap-2 rounded-lg text-xs font-semibold">
              <Copy className="h-4 w-4" /> Copiar dados
            </Button>
            {selectMode && (
              <Button
                variant={isSelected ? "default" : "outline"} size="sm"
                onClick={() => onToggleSelect(imovelId)}
                className="h-10 gap-2 rounded-lg text-xs font-semibold col-span-2"
              >
                <Share2 className="h-4 w-4" /> {isSelected ? "Na vitrine ✓" : "Adicionar à Vitrine"}
              </Button>
            )}
          </div>

          {/* ── Consultant block ── */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Responsável / Origem</p>
              </div>
            </div>
            {origemLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando informações...
              </div>
            ) : !origem ? (
              <p className="text-xs text-muted-foreground">Informação não disponível.</p>
            ) : (
              <div className="space-y-1.5">
                {origem.sistema && (
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{origem.sistema}</span></p>
                )}
                {origem.responsavel && (
                  <p className="text-sm font-semibold text-foreground">{origem.responsavel}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {origem.telefone && (
                    <a href={`tel:${origem.telefone.replace(/[^\d+]/g, "")}`}>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-lg">
                        <Phone className="h-3.5 w-3.5" /> {origem.telefone}
                      </Button>
                    </a>
                  )}
                  {origem.email && (
                    <a href={`mailto:${origem.email}`}>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-lg">
                        <Mail className="h-3.5 w-3.5" /> E-mail
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {descricao && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-2">Descrição</p>
              <p className="text-sm text-foreground/70 leading-relaxed">{descricao}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Fullscreen Lightbox (owned by drawer, rendered via portal) ── */}
      <PhotoLightbox
        images={fullscreenImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "p-0 flex flex-col border-l border-border/50",
          isMobile
            ? "h-[92vh] rounded-t-2xl max-w-full sm:max-w-full"
            : "w-[520px] sm:max-w-[520px] max-w-[520px]"
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{titulo || "Preview do Imóvel"}</SheetTitle>
          <SheetDescription>Detalhes rápidos do imóvel</SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
