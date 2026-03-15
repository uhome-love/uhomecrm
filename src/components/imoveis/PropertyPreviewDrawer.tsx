/**
 * Quick Preview Drawer for properties.
 * Desktop: right-side sheet (480px).
 * Mobile: bottom sheet (85vh).
 * Reuses existing helpers and cached ResponsavelButton pattern.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Heart, Copy, Phone, MapPin, CalendarClock, Share2, Building2,
  Loader2, UserCircle, Mail, ExternalLink, BedDouble, Bath, Car,
  Maximize2, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  extractImages, extractFullImages, extractOrigemExterna,
  extractEntrega, extractEndereco, getNum, getNumIncZero, fmtBRL,
} from "@/lib/imovelHelpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Reuse session-scoped cache from PropertyCards
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
  onOpenLightbox: (images: string[], index: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  positionLabel?: string;
}

export default function PropertyPreviewDrawer({
  item, open, onClose, isFavorite, onFavorite, getPreco,
  selectMode, isSelected, onToggleSelect, onOpenLightbox,
  onPrev, onNext, hasPrev = false, hasNext = false, positionLabel,
}: PropertyPreviewDrawerProps) {
  const [imageIdx, setImageIdx] = useState(0);
  const [origem, setOrigem] = useState<any>(null);
  const [origemLoading, setOrigemLoading] = useState(false);
  const [origemFetched, setOrigemFetched] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Reset state on item change
  useEffect(() => {
    setImageIdx(0);
    setOrigem(null);
    setOrigemFetched(false);
    if (item?.codigo && responsavelCache.has(item.codigo)) {
      setOrigem(responsavelCache.get(item.codigo)!.origem);
      setOrigemFetched(true);
    }
  }, [item?.codigo]);

  // Lazy-load responsável when drawer opens
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
        const detail = data?.data || data;
        const result = (detail && !detail.not_found) ? extractOrigemExterna(detail) : null;
        responsavelCache.set(codigo, { origem: result });
        setOrigem(result);
      })
      .catch(() => {})
      .finally(() => { setOrigemLoading(false); setOrigemFetched(true); });
  }, [open, item?.codigo, origemFetched]);

  // Keyboard navigation (left/right arrows)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === "ArrowRight" && hasNext && onNext) { e.preventDefault(); onNext(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, hasPrev, hasNext, onPrev, onNext]);

  // Mobile swipe navigation (horizontal swipe with angle discrimination)
  const touchRef = useRef<{ startX: number; startY: number; swiping: boolean } | null>(null);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 50; // min px horizontal
  const SWIPE_ANGLE_MAX = 30; // max degrees from horizontal to count as swipe

  useEffect(() => {
    if (!open || !isMobile) return;
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
      // Only mark as swiping if predominantly horizontal
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

      if (dx < 0 && hasNext && onNext) onNext(); // swipe left → next
      if (dx > 0 && hasPrev && onPrev) onPrev(); // swipe right → prev
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [open, isMobile, hasPrev, hasNext, onPrev, onNext]);

  if (!item) return null;

  const images = extractImages(item);
  const fullImages = extractFullImages(item);
  const allImages = fullImages.length > 0 ? fullImages : images;
  const loc = extractEndereco(item);
  const codigo = item.codigo;
  const titulo = item.titulo_anuncio || item.empreendimento_nome || "";
  const dorms = getNum(item, "dormitorios");
  const suitesVal = getNum(item, "suites");
  const banhos = getNum(item, "banheiros");
  const area = getNumIncZero(item, "area_privativa", "area_util", "area_total");
  const vagasVal = getNum(item, "garagens", "vagas");
  const cond = getNum(item, "valor_condominio");
  const entrega = extractEntrega(item);
  const imovelId = String(codigo || item.id_imovel || item.id);
  const descricao = item.descricao || item.descricao_interna || "";
  const tipo = item.tipo || item.subtipo || "";

  const prevImage = () => setImageIdx(i => (i > 0 ? i - 1 : allImages.length - 1));
  const nextImage = () => setImageIdx(i => (i < allImages.length - 1 ? i + 1 : 0));

  const copyData = () => {
    const text = [
      titulo, getPreco(item),
      `${[loc.endereco, loc.bairro, loc.cidade].filter(Boolean).join(" · ")}`,
      dorms ? `${dorms} dorm${suitesVal ? ` · ${suitesVal} suítes` : ""}` : "",
      area ? `${area} m²` : "",
      vagasVal ? `${vagasVal} vaga${vagasVal > 1 ? "s" : ""}` : "",
      codigo ? `Cód. ${codigo}` : "",
    ].filter(Boolean).join(" · ");
    navigator.clipboard.writeText(text);
    toast.success("Dados copiados!");
  };

  const whatsappText = encodeURIComponent(
    [titulo, loc.bairro, getPreco(item), codigo ? `Cód. ${codigo}` : ""].filter(Boolean).join(" - ")
  );

  const content = (
    <div ref={swipeContainerRef} className="flex flex-col h-full overflow-hidden">
      {/* Prev/Next navigation header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
        <Button
          variant="ghost" size="sm"
          onClick={onPrev}
          disabled={!hasPrev}
          className="gap-1 text-xs h-7 px-2"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Anterior
        </Button>
        {positionLabel && (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{positionLabel}</span>
        )}
        <Button
          variant="ghost" size="sm"
          onClick={onNext}
          disabled={!hasNext}
          className="gap-1 text-xs h-7 px-2"
        >
          Próximo <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Image gallery */}
      <div className="relative bg-muted aspect-[16/10] shrink-0 group">
        {allImages.length > 0 ? (
          <>
            <img
              src={allImages[imageIdx] || ""}
              alt={titulo}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => onOpenLightbox(allImages, imageIdx)}
            />
            {allImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/70 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[10px] font-medium text-foreground">
                  {imageIdx + 1} / {allImages.length}
                </div>
              </>
            )}
            <button
              onClick={() => onOpenLightbox(allImages, imageIdx)}
              className="absolute top-2 right-2 bg-background/70 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              title="Tela cheia"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Building2 className="h-12 w-12 opacity-20" />
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Price + title */}
        <div>
          <p className="text-2xl font-bold text-foreground">{getPreco(item)}</p>
          {cond != null && cond > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">Condomínio: {fmtBRL(cond)}</p>
          )}
          {titulo && <p className="text-sm font-medium text-foreground/80 mt-1.5 leading-snug">{titulo}</p>}
          {tipo && <p className="text-xs text-muted-foreground capitalize mt-0.5">{tipo}</p>}
        </div>

        {/* Specs */}
        <div className="flex items-center gap-4 flex-wrap">
          {dorms != null && dorms > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <BedDouble className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{dorms}</span>
              <span className="text-xs text-muted-foreground">dorm{suitesVal ? ` · ${suitesVal}s` : ""}</span>
            </div>
          )}
          {banhos != null && banhos > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Bath className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{banhos}</span>
              <span className="text-xs text-muted-foreground">ban</span>
            </div>
          )}
          {area != null && area > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Maximize2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{area}</span>
              <span className="text-xs text-muted-foreground">m²</span>
            </div>
          )}
          {vagasVal != null && vagasVal > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{vagasVal}</span>
              <span className="text-xs text-muted-foreground">vaga{vagasVal > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Location */}
        {(loc.bairro || loc.endereco || loc.cidade) && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <span className="text-muted-foreground">
              {[loc.endereco, loc.bairro, loc.cidade].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}

        {/* Obra / entrega */}
        {entrega.emObras && (
          <Badge className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 border gap-1">
            <CalendarClock className="h-3 w-3" />
            {entrega.previsao ? `Entrega: ${entrega.previsao}` : "Em obras / na planta"}
          </Badge>
        )}

        {/* Description */}
        {descricao && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Descrição</p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">{descricao}</p>
            </div>
          </>
        )}

        {/* Responsável */}
        <Separator />
        <div>
          <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
            <UserCircle className="h-3.5 w-3.5" /> Responsável / Origem
          </p>
          {origemLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
            </div>
          ) : !origem ? (
            <p className="text-xs text-muted-foreground">Informação não disponível.</p>
          ) : (
            <div className="space-y-1 text-xs">
              {origem.sistema && <p className="text-muted-foreground"><span className="font-medium text-foreground">Sistema:</span> {origem.sistema}</p>}
              {origem.responsavel && <p className="text-muted-foreground"><span className="font-medium text-foreground">Responsável:</span> {origem.responsavel}</p>}
              {origem.telefone && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <a href={`tel:${origem.telefone.replace(/[^\d+]/g, "")}`} className="text-primary hover:underline">{origem.telefone}</a>
                </p>
              )}
              {origem.email && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <a href={`mailto:${origem.email}`} className="text-primary hover:underline">{origem.email}</a>
                </p>
              )}
            </div>
          )}
        </div>

        {codigo && (
          <p className="text-[10px] text-muted-foreground/50 font-mono pt-1">Cód. {codigo}</p>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="shrink-0 border-t border-border bg-background px-5 py-3 flex items-center gap-2">
        <Button
          variant="ghost" size="sm"
          onClick={() => onFavorite(imovelId)}
          className="gap-1.5"
        >
          <Heart className={cn("h-4 w-4", isFavorite ? "fill-red-500 text-red-500" : "")} />
          {isFavorite ? "Favoritado" : "Favoritar"}
        </Button>
        <Button variant="ghost" size="sm" onClick={copyData} className="gap-1.5">
          <Copy className="h-3.5 w-3.5" /> Copiar
        </Button>
        {selectMode && (
          <Button
            variant={isSelected ? "default" : "outline"} size="sm"
            onClick={() => onToggleSelect(imovelId)}
            className="gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" /> {isSelected ? "Na vitrine" : "Vitrine"}
          </Button>
        )}
        <div className="flex-1" />
        <a
          href={`https://wa.me/?text=${whatsappText}`}
          target="_blank" rel="noopener noreferrer"
        >
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
            <Phone className="h-3.5 w-3.5" /> WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "p-0 flex flex-col",
          isMobile
            ? "h-[85vh] rounded-t-2xl max-w-full sm:max-w-full"
            : "w-[480px] sm:max-w-[480px] max-w-[480px]"
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