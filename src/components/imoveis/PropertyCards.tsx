/**
 * Property card components for grid and list views.
 * Extracted from ImoveisPage for modularity.
 *
 * Props shared by both variants:
 *  - item: mapped property object
 *  - idx: index in list
 *  - isCampanha: boolean
 *  - selectMode / isSelected / onToggleSelect: vitrine selection
 *  - onFavorite / isFavorite: favorites
 *  - onOpenLightbox: (images, index) => void
 *  - getPreco: (item) => string
 */

import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Loader2, MapPin, Megaphone, UserCircle, Phone, Mail,
  CheckSquare, Square, CalendarClock, Heart,
} from "lucide-react";
import ImageSlider from "@/components/imoveis/ImageSlider";
import SharePropertyButton from "@/components/imoveis/SharePropertyButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  extractImages, extractFullImages, extractOrigemExterna, extractEntrega, extractEndereco,
  getNum, getNumIncZero, fmtBRL,
} from "@/lib/imovelHelpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── In-memory cache for ResponsavelButton (session-scoped) ──
const responsavelCache = new Map<string, { origem: any | null }>();

// ── ResponsavelButton (lazy-loads owner info on click, cached) ──

function ResponsavelButton({ codigo }: { codigo: string }) {
  const [origem, setOrigem] = useState<any>(() => responsavelCache.get(codigo)?.origem ?? null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(() => responsavelCache.has(codigo));
  const handleOpen = async (open: boolean) => {
    if (!open || fetched || !codigo) return;
    if (responsavelCache.has(codigo)) {
      setOrigem(responsavelCache.get(codigo)!.origem);
      setFetched(true);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("jetimob-proxy", { body: { action: "get_imovel", codigo } });
      // jetimob-proxy returns { imovel: {...}, not_found: bool }
      const imovel = data?.imovel ?? data?.data?.imovel ?? null;
      const result = imovel ? extractOrigemExterna(imovel) : null;
      responsavelCache.set(codigo, { origem: result });
      setOrigem(result);
    } catch { /* */ } finally { setLoading(false); setFetched(true); }
  };
  return (
    <Popover onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Responsável">
          <UserCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs font-semibold text-foreground mb-2">Responsável / Origem</p>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" /> Carregando...</div>
        ) : !origem ? (
          <p className="text-xs text-muted-foreground">Informação não disponível.</p>
        ) : (
          <div className="space-y-1.5 text-xs">
            {origem.sistema && <p className="text-muted-foreground"><span className="font-medium text-foreground">Sistema:</span> {origem.sistema}</p>}
            {origem.responsavel && <p className="text-muted-foreground"><span className="font-medium text-foreground">Responsável:</span> {origem.responsavel}</p>}
            {origem.telefone && <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /><a href={`tel:${origem.telefone.replace(/[^\d+]/g, "")}`} className="text-primary hover:underline">{origem.telefone}</a></p>}
            {origem.email && <p className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /><a href={`mailto:${origem.email}`} className="text-primary hover:underline">{origem.email}</a></p>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Grid Card ──

export const PropertyCardGrid = React.memo(function PropertyCardGrid({ item, idx, isCampanha, selectMode, isSelected, onToggleSelect, onFavorite, isFavorite, onOpenLightbox, getPreco, onPreview }: any) {
  const images = extractImages(item);
  const fullImages = extractFullImages(item);
  const loc = extractEndereco(item);
  const codigo = item.codigo;
  const titulo = item.titulo_anuncio || item.empreendimento_nome || "";
  const dorms = getNum(item, "dormitorios");
  const suitesVal = getNum(item, "suites");
  const area = getNumIncZero(item, "area_privativa", "area_util", "area_total");
  const vagas = getNum(item, "garagens", "vagas");
  const entrega = extractEntrega(item);
  const imovelId = String(codigo || item.id_imovel || item.id || idx);

  return (
    <Card
      className={cn(
        "overflow-hidden group hover:shadow-xl transition-all duration-300 relative border-border/40 bg-card cursor-pointer",
        isCampanha && "ring-1 ring-primary/20",
        selectMode && isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onPreview?.(item)}
    >
      {selectMode && (
        <button onClick={(e) => { e.stopPropagation(); onToggleSelect(imovelId); }} className="absolute top-3 left-3 z-20 bg-background/90 backdrop-blur-sm rounded-md p-1 shadow-sm">
          {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </button>
      )}

      <div className="aspect-[16/10] relative bg-muted overflow-hidden">
        <ImageSlider images={images} alt={titulo || loc.endereco} />
        {isCampanha && (
          <Badge className="absolute top-3 left-3 text-[10px] bg-primary/90 text-primary-foreground backdrop-blur-sm shadow-sm">
            <Megaphone className="h-2.5 w-2.5 mr-1" /> Campanha
          </Badge>
        )}
        {entrega.emObras && (
          <Badge className="absolute top-3 right-3 text-[10px] bg-amber-500/90 text-white backdrop-blur-sm shadow-sm border-0">
            <CalendarClock className="h-2.5 w-2.5 mr-1" />
            {entrega.previsao ? `Entrega ${entrega.previsao}` : "Em obras"}
          </Badge>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(imovelId); }}
          className="absolute top-3 right-3 bg-background/70 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:scale-110"
          style={entrega.emObras ? { top: 'auto', bottom: '12px' } : {}}
        >
          <Heart className={cn("h-4 w-4", isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
        </button>
      </div>

      <div className="p-3.5 space-y-1.5">
        <p className="text-[17px] font-bold text-foreground leading-tight">{getPreco(item)}</p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {dorms != null && dorms > 0 && (
            <span className="font-medium"><strong className="text-foreground">{dorms}</strong> dorm{suitesVal ? ` · ${suitesVal}s` : ""}</span>
          )}
          {area != null && area > 0 && (
            <span className="font-medium"><strong className="text-foreground">{area}</strong> m²</span>
          )}
          {vagas != null && vagas > 0 && (
            <span className="font-medium"><strong className="text-foreground">{vagas}</strong> vaga{vagas > 1 ? "s" : ""}</span>
          )}
        </div>

        {titulo && <p className="text-xs text-foreground/80 font-medium leading-snug line-clamp-1">{titulo}</p>}

        {(loc.bairro || loc.endereco) && (
          <p className="text-[11px] text-muted-foreground truncate">
            {[loc.bairro, loc.cidade].filter(Boolean).join(", ")}
          </p>
        )}

        {codigo && (
          <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground/60 font-mono">{codigo}</span>
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <SharePropertyButton
                codigo={codigo}
                titulo={titulo}
                bairro={loc.bairro}
                preco={getPreco(item)}
              />
              <ResponsavelButton codigo={codigo} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});

// ── List Card ──

export const PropertyCardList = React.memo(function PropertyCardList({ item, idx, isCampanha, selectMode, isSelected, onToggleSelect, onFavorite, isFavorite, onOpenLightbox, getPreco, onPreview }: any) {
  const images = extractImages(item);
  const fullImages = extractFullImages(item);
  const loc = extractEndereco(item);
  const codigo = item.codigo;
  const titulo = item.titulo_anuncio || item.empreendimento_nome || "";
  const dorms = getNum(item, "dormitorios");
  const suitesVal = getNum(item, "suites");
  const banhos = getNum(item, "banheiros");
  const area = getNumIncZero(item, "area_privativa", "area_util", "area_total");
  const vagas = getNum(item, "garagens", "vagas");
  const cond = getNum(item, "valor_condominio");
  const entrega = extractEntrega(item);
  const imovelId = String(codigo || item.id_imovel || item.id || idx);

  return (
    <Card
      className={cn(
        "overflow-hidden hover:shadow-lg transition-all duration-200 relative border-border/40 cursor-pointer",
        isCampanha && "ring-1 ring-primary/20",
        selectMode && isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onPreview?.(item)}
    >
      {selectMode && (
        <button onClick={(e) => { e.stopPropagation(); onToggleSelect(imovelId); }} className="absolute top-2 left-2 z-20 bg-background/90 rounded-md p-0.5 shadow-sm">
          {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </button>
      )}
      <div className="flex">
        <div className="w-56 h-40 flex-shrink-0 bg-muted relative">
          <ImageSlider images={images} alt={titulo || loc.endereco} />
          {isCampanha && <Badge className="absolute top-2 left-2 text-[10px] bg-primary/90 text-primary-foreground"><Megaphone className="h-2.5 w-2.5 mr-0.5" /> Campanha</Badge>}
        </div>
        <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-bold text-foreground">{getPreco(item)}</p>
              <button onClick={(e) => { e.stopPropagation(); onFavorite(imovelId); }} className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors">
                <Heart className={cn("h-4 w-4", isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {dorms != null && dorms > 0 && <span><strong className="text-foreground">{dorms}</strong> dorm{suitesVal ? ` · ${suitesVal}s` : ""}</span>}
              {banhos != null && banhos > 0 && <span><strong className="text-foreground">{banhos}</strong> ban</span>}
              {area != null && area > 0 && <span><strong className="text-foreground">{area}</strong> m²</span>}
              {vagas != null && vagas > 0 && <span><strong className="text-foreground">{vagas}</strong> vaga{vagas > 1 ? "s" : ""}</span>}
            </div>

            {titulo && <p className="text-xs text-foreground/80 font-medium truncate">{titulo}</p>}
            {(loc.bairro || loc.endereco) && (
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {[loc.endereco, loc.bairro, loc.cidade].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1.5">
              {codigo && <span className="text-[10px] text-muted-foreground/60 font-mono">{codigo}</span>}
              {cond != null && cond > 0 && <span className="text-[10px] text-muted-foreground">· Cond. {fmtBRL(cond)}</span>}
              {entrega.emObras && (
                <Badge className="text-[9px] h-4 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 border">
                  {entrega.previsao || "Em obras"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <SharePropertyButton
                codigo={codigo || String(item.id)}
                titulo={titulo}
                bairro={loc.bairro}
                preco={getPreco(item)}
              />
              {codigo && <ResponsavelButton codigo={codigo} />}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
});
