/**
 * Property card for the new /imoveis page (Site Uhome style, dark theme).
 * Supports grid layout with hover photo navigation and broker actions.
 */

import React, { useState, useRef, useCallback } from "react";
import { Heart, Share2, MessageCircle, Copy, Link2 } from "lucide-react";
import { motion } from "framer-motion";
import { type SiteImovel, fotoPrincipal, formatPreco } from "@/services/siteImoveis";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
// supabase import removed — photos come from Typesense directly

interface Props {
  imovel: SiteImovel;
  index: number;
  highlighted?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onPreview?: (imovel: SiteImovel) => void;
}

const PUBLIC_DOMAIN = "https://uhome.com.br";

export const SitePropertyCard = React.memo(function SitePropertyCard({
  imovel, index, highlighted, isFavorite, onToggleFavorite,
  selectMode, isSelected, onToggleSelect, onPreview,
}: Props) {
  const [hovering, setHovering] = useState(false);
  const [fotoAtiva, setFotoAtiva] = useState(0);
  const [lazyFotos, setLazyFotos] = useState<string[] | null>(null);
  const fotosLoadedRef = useRef(false);

  const baseFoto = fotoPrincipal(imovel);
  const fotos = lazyFotos && lazyFotos.length > 0 ? lazyFotos : [baseFoto];

  const price = formatPreco(imovel.preco);
  const area = imovel.area_total ?? 0;
  const statsArr = [
    area > 0 ? `${area} m²` : null,
    (imovel.quartos ?? 0) > 0 ? `${imovel.quartos} quarto${imovel.quartos! > 1 ? "s" : ""}` : null,
    (imovel.vagas ?? 0) > 0 ? `${imovel.vagas} vaga${imovel.vagas! > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  const stats = statsArr.join(" · ");
  const tipoCapitalized = imovel.tipo.charAt(0).toUpperCase() + imovel.tipo.slice(1);

  // Badge
  const isNew = imovel.publicado_em
    ? Math.floor((Date.now() - new Date(imovel.publicado_em).getTime()) / 86400000) <= 7
    : false;

  const handleMouseEnter = useCallback(() => {
    setHovering(true);
    // Use fotos already available from Typesense (fotos_full for high-res)
    if (!fotosLoadedRef.current && imovel.fotos_full?.length > 1) {
      fotosLoadedRef.current = true;
      setLazyFotos(imovel.fotos_full.slice(0, 8));
    } else if (!fotosLoadedRef.current && imovel.fotos?.length > 1) {
      fotosLoadedRef.current = true;
      setLazyFotos(imovel.fotos.slice(0, 8));
    }
  }, [imovel.fotos, imovel.fotos_full]);

  const handleMouseLeave = useCallback(() => {
    setHovering(false);
  }, []);

  const shareUrl = `${PUBLIC_DOMAIN}/imovel/${imovel.slug}`;

  const copyForWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    let msg = `🏠 *${tipoCapitalized} · ${imovel.bairro}*\n`;
    if (stats) msg += `${stats}\n`;
    msg += `💰 ${price}\n`;
    msg += `🔗 ${shareUrl}`;
    navigator.clipboard.writeText(msg);
    toast.success("Copiado para WhatsApp! 📋");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.15) }}
      className={cn(
        "relative cursor-pointer select-none group",
        highlighted && "ring-2 ring-primary rounded-xl",
        selectMode && isSelected && "ring-2 ring-primary rounded-xl",
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onPreview?.(imovel)}
    >
      {/* Photo */}
      <div className="relative w-full overflow-hidden rounded-xl bg-muted" style={{ aspectRatio: "4/3" }}>
        {fotos.length > 0 ? (
          <img
            src={fotos[fotoAtiva]}
            alt={`${tipoCapitalized} ${imovel.bairro}`}
            loading={index < 6 ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500"
            style={{ transform: hovering ? "scale(1.03)" : "scale(1)" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <span className="text-3xl opacity-40">🏠</span>
          </div>
        )}

        {/* Badge */}
        {isNew && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-md bg-primary/90 px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
            Novo
          </span>
        )}
        {imovel.destaque && !isNew && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-md bg-foreground/80 px-2.5 py-1 text-xs font-semibold text-background shadow-sm">
            Exclusivo
          </span>
        )}

        {/* Select checkbox */}
        {selectMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(imovel.id); }}
            className={cn(
              "absolute top-2.5 left-2.5 z-20 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all",
              isSelected
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-background/70 border-border backdrop-blur-sm"
            )}
          >
            {isSelected && <span className="text-xs font-bold">✓</span>}
          </button>
        )}

        {/* Heart */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(imovel.id); }}
          className="absolute right-3 top-3 z-10"
        >
          <Heart
            className="h-6 w-6 drop-shadow-md transition-colors"
            fill={isFavorite ? "#ff385c" : "rgba(255,255,255,0.85)"}
            stroke={isFavorite ? "#ff385c" : "rgba(0,0,0,0.3)"}
            strokeWidth={1.5}
          />
        </button>

        {/* Nav arrows on hover */}
        {hovering && fotos.length > 1 && (
          <>
            {fotoAtiva > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setFotoAtiva(i => i - 1); }}
                className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-sm shadow transition-transform hover:scale-105"
              >‹</button>
            )}
            {fotoAtiva < fotos.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setFotoAtiva(i => i + 1); }}
                className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-sm shadow transition-transform hover:scale-105"
              >›</button>
            )}
          </>
        )}

        {/* Dots */}
        {hovering && fotos.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 gap-1">
            {fotos.slice(0, 5).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === fotoAtiva ? 18 : 5,
                  height: 5,
                  background: i === fotoAtiva ? "white" : "rgba(255,255,255,0.55)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Text */}
      <div className="px-0.5 pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-foreground">
            {tipoCapitalized} · {imovel.bairro}
          </span>
          {/* Broker action buttons — visible on hover */}
          <div
            className={cn(
              "flex items-center gap-0.5 shrink-0 transition-opacity",
              hovering ? "opacity-100" : "opacity-0"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-emerald-500"
              title="WhatsApp"
              onClick={copyForWhatsApp}
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" title="Compartilhar">
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copiado!"); }} className="gap-2 text-xs cursor-pointer">
                  <Link2 className="h-3.5 w-3.5" /> Copiar link
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-2 text-xs cursor-pointer">
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${tipoCapitalized} em ${imovel.bairro} - ${price} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-3.5 w-3.5" /> Enviar por WhatsApp
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { const text = [tipoCapitalized, imovel.bairro, price, shareUrl].filter(Boolean).join(" · "); navigator.clipboard.writeText(text); toast.success("Dados copiados!"); }} className="gap-2 text-xs cursor-pointer">
                  <Copy className="h-3.5 w-3.5" /> Copiar dados
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {stats && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{stats}</p>
        )}

        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-sm font-bold text-foreground">{price}</p>
          {(imovel.preco_condominio ?? 0) > 0 && (
            <span className="text-[11px] text-muted-foreground">
              + R$ {imovel.preco_condominio!.toLocaleString("pt-BR")}/mês
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});
