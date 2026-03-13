import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Search, Building2, Loader2, ChevronLeft, ChevronRight, Home, BedDouble, Bath,
  Maximize, MapPin, Car, Megaphone, ChevronsUpDown, Check, UserCircle, Phone,
  Mail, X, Share2, CheckSquare, Square, Link2, Copy, CalendarClock,
  LayoutGrid, List, Star, SlidersHorizontal, ChevronDown, Heart, DollarSign, Zap,
  Sparkles, Brain, ArrowRight, Map
} from "lucide-react";
import PropertyMap, { type MapBounds } from "@/components/imoveis/PropertyMap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getVitrinePublicUrl } from "@/lib/vitrineUrl";
import { useTypesenseSearch, buildFilterBy, buildSortBy } from "@/hooks/useTypesenseSearch";
import { useAISearch, type AIPropertyResult } from "@/hooks/useAISearch";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Helpers ──

function extractImages(item: any): string[] {
  if (item._fotos_normalized?.length) return item._fotos_normalized;
  const arr = item.imagens;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr.map((img: any) => img.link_thumb || img.link || img.url || img.src || "").filter(Boolean);
}

function extractFullImages(item: any): string[] {
  // Prefer fotos_full (full-res URLs from Typesense)
  if (item._fotos_full?.length) return item._fotos_full;
  if (item._fotos_normalized?.length) return item._fotos_normalized;
  const arr = item.imagens;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  // Prefer full-size: link_large > link > link_medio > link_thumb
  return arr.map((img: any) => img.link_large || img.link || img.link_medio || img.link_thumb || img.url || img.src || "").filter(Boolean);
}

function extractOrigemExterna(item: any) {
  const proprietario = item.proprietario_nome || item.proprietario?.nome;
  const agenciador = item.agenciador_nome || item.agenciador?.nome;
  const responsavel = item.responsavel_nome || item.corretor_nome || item.responsavel?.nome;
  const telefone = item.responsavel_telefone || item.corretor_telefone || item.proprietario_telefone || item.proprietario?.telefone;
  const email = item.responsavel_email || item.corretor_email || item.proprietario_email || item.proprietario?.email;
  const sistema = item.origem_sistema || item.sistema_origem;
  const textFields = [item.observacoes_internas, item.informacoes_origem_externa, item.obs_internas, item.observacoes].filter(Boolean);
  let parsedResp = responsavel, parsedTel = telefone, parsedEmail = email, parsedSistema = sistema;
  for (const obsText of textFields) {
    if (!obsText || typeof obsText !== "string") continue;
    const sysMatch = obsText.match(/Sistema:\s*(.+)/i);
    const respMatch = obsText.match(/Respons[áa]vel\/Corretor:\s*(.+)/i) || obsText.match(/Respons[áa]vel:\s*(.+)/i);
    const telMatch = obsText.match(/Telefone:\s*(.+)/i);
    const emailMatch = obsText.match(/E-?mail:\s*(.+)/i);
    if (sysMatch && !parsedSistema) parsedSistema = sysMatch[1].trim();
    if (respMatch && !parsedResp) parsedResp = respMatch[1].trim();
    if (telMatch && !parsedTel) parsedTel = telMatch[1].trim();
    if (emailMatch && !parsedEmail) parsedEmail = emailMatch[1].trim();
  }
  if (!parsedResp && !parsedTel && !parsedEmail && !parsedSistema && !proprietario && !agenciador) return null;
  return { sistema: parsedSistema, responsavel: parsedResp || proprietario || agenciador, telefone: parsedTel, email: parsedEmail };
}

function extractEntrega(item: any) {
  const situacao = (item.situacao || item.status || item.fase || "").toLowerCase();
  const emObras = situacao.includes("obra") || situacao.includes("constru") || situacao.includes("planta") || situacao.includes("lançamento") || situacao === "lancamento";
  let previsao = item.previsao_entrega || item.data_entrega || item.prazo_entrega || item.previsao || item.entrega || null;
  if (!previsao) {
    const texts = [item.descricao_interna, item.observacoes_internas, item.observacoes, item.descricao].filter(Boolean);
    for (const t of texts) {
      if (typeof t !== "string") continue;
      const match = t.match(/(?:entrega|previs[ãa]o)[:\s]*(\d{1,2}[\/\-]\d{4}|\d{4})/i) || t.match(/(?:entrega|previs[ãa]o)[:\s]*([\w]+\s*(?:de\s*)?\d{4})/i);
      if (match) return { emObras, previsao: match[1].trim() };
    }
  }
  return { emObras, previsao };
}

function extractEndereco(item: any) {
  const logradouro = item.endereco_logradouro || item.endereco || item.logradouro || "";
  const numero = item.endereco_numero || item.numero || "";
  const bairro = item.endereco_bairro || item.bairro || "";
  const cidade = item.endereco_cidade || item.cidade || "";
  return { endereco: `${logradouro}${numero ? `, ${numero}` : ""}`.trim(), bairro, cidade };
}

function getNum(item: any, ...keys: string[]): number | null {
  for (const k of keys) { const v = item[k]; if (v != null && v !== "" && v !== 0 && !isNaN(Number(v))) return Number(v); }
  return null;
}
function getNumIncZero(item: any, ...keys: string[]): number | null {
  for (const k of keys) { const v = item[k]; if (v != null && v !== "" && !isNaN(Number(v))) return Number(v); }
  return null;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}mil`;
  return fmtBRL(v);
};

// Fallback hardcoded list (used if overrides fail to load)
const CAMPANHA_CODES_FALLBACK = [
  { codigo: "97325-UH", nome: "Shift" },
  { codigo: "32849-UH", nome: "Open Bosque" },
  { codigo: "57290-UH", nome: "Orygem" },
  { codigo: "39808-UH", nome: "Melnick Day - Compactos" },
  { codigo: "58935-UH", nome: "Lake Eyre" },
  { codigo: "4688-UH", nome: "Casa Bastian" },
  { codigo: "52101-UH", nome: "Casa Tua" },
  { codigo: "41190-UH", nome: "Las Casas" },
  { codigo: "76953-UH", nome: "Melnick Day - Médio Padrão" },
  { codigo: "91245-UH", nome: "Melnick Day - Alto Padrão" },
];

const BAIRROS_POA = [
  "Auxiliadora", "Bela Vista", "Bom Fim", "Camaquã", "Cavalhada",
  "Centro Histórico", "Chácara das Pedras", "Cidade Baixa", "Cristal",
  "Farroupilha", "Floresta", "Higienópolis", "Humaitá", "Independência",
  "Ipanema", "Jardim Botânico", "Jardim do Salso", "Jardim Europa",
  "Jardim Isabel", "Jardim Lindóia", "Jardim Planalto", "Jardim São Pedro",
  "Lami", "Lomba do Pinheiro", "Medianeira", "Menino Deus", "Moinhos de Vento",
  "Mont'Serrat", "Navegantes", "Nonoai", "Partenon", "Passo d'Areia",
  "Pedra Redonda", "Petrópolis", "Praia de Belas", "Rio Branco",
  "Santa Cecília", "Santa Tereza", "Santana", "Santo Antônio",
  "São Geraldo", "São João", "São José", "São Sebastião",
  "Teresópolis", "Três Figueiras", "Tristeza", "Vila Assunção",
  "Vila Conceição", "Vila Ipiranga", "Vila Jardim", "Vila Nova",
];

// ── Sub-components ──

function ResponsavelButton({ codigo }: { codigo: string }) {
  const [origem, setOrigem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const handleOpen = async (open: boolean) => {
    if (!open || fetched || !codigo) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("jetimob-proxy", { body: { action: "get_imovel", codigo } });
      const detail = data?.data || data;
      if (detail && !detail.not_found) setOrigem(extractOrigemExterna(detail));
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

function ImageSlider({ images, alt, onClickImage }: { images: string[]; alt: string; onClickImage?: () => void }) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) return <div className="w-full h-full flex items-center justify-center cursor-pointer bg-muted" onClick={onClickImage}><Home className="h-10 w-10 text-muted-foreground/30" /></div>;
  return (
    <div className="w-full h-full relative group">
      <img src={images[current]} alt={alt} className="w-full h-full object-cover cursor-pointer" loading="lazy" onClick={(e) => { e.stopPropagation(); onClickImage?.(); }} />
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p - 1 + images.length) % images.length); }} className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/95 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p + 1) % images.length); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/95 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm" aria-label="Próxima"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {images.slice(0, 6).map((_, i) => <span key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === current ? "bg-white scale-125" : "bg-white/50")} />)}
            {images.length > 6 && <span className="text-[8px] text-white/80 ml-0.5">+{images.length - 6}</span>}
          </div>
        </>
      )}
      <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        {current + 1}/{images.length}
      </div>
    </div>
  );
}

function PhotoLightbox({ images, initialIndex, open, onClose }: { images: string[]; initialIndex: number; open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState(initialIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  useEffect(() => { setCurrent(initialIndex); }, [initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo((current - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight") goTo((current + 1) % images.length);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, current, images.length]);

  const goTo = (idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(idx);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Upgrade thumbnail URLs to full resolution
  const getFullRes = (url: string) => url.replace(/\/thumb\//, "/large/").replace(/_thumb\./i, ".");

  if (!open || images.length === 0) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/97" onClick={onClose}>
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 rounded-full p-2.5 text-white backdrop-blur-sm transition-all">
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-50 text-white/70 text-sm font-medium">
        {current + 1} / {images.length}
      </div>

      {/* Main image area — maximized for premium feel */}
      <div className="flex items-center justify-center h-full px-4 sm:px-8 pt-14 pb-24" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={getFullRes(images[current])}
            alt={`Foto ${current + 1}`}
            className="max-w-[95vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl transition-opacity duration-300"
            style={{ opacity: isTransitioning ? 0.6 : 1 }}
            draggable={false}
          />
        </div>
      </div>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goTo((current - 1 + images.length) % images.length); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-50 bg-white/10 hover:bg-white/25 backdrop-blur-md rounded-full p-3 text-white transition-all hover:scale-110"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goTo((current + 1) % images.length); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-50 bg-white/10 hover:bg-white/25 backdrop-blur-md rounded-full p-3 text-white transition-all hover:scale-110"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-10 pb-4 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2 overflow-x-auto max-w-3xl mx-auto scrollbar-hide">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200",
                i === current
                  ? "border-white w-16 h-12 opacity-100 scale-105"
                  : "border-transparent w-14 h-10 opacity-40 hover:opacity-70 hover:border-white/30"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Filter Chip Popover ──
function FilterChip({ label, active, children, onClear }: { label: string; active: boolean; children: React.ReactNode; onClear?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
          active
            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
            : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
        )}>
          {label}
          <ChevronDown className="h-3 w-3" />
          {active && onClear && (
            <span onClick={(e) => { e.stopPropagation(); onClear(); }} className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 -mr-1">
              <X className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[200px] p-3" align="start" sideOffset={8}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

// ── Property Card (Grid) ──
function PropertyCardGrid({ item, idx, isCampanha, selectMode, isSelected, onToggleSelect, onFavorite, isFavorite, onOpenLightbox, getPreco }: any) {
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
    <Card className={cn(
      "overflow-hidden group hover:shadow-xl transition-all duration-300 relative border-border/40 bg-card",
      isCampanha && "ring-1 ring-primary/20",
      selectMode && isSelected && "ring-2 ring-primary"
    )}>
      {selectMode && (
        <button onClick={() => onToggleSelect(imovelId)} className="absolute top-3 left-3 z-20 bg-background/90 backdrop-blur-sm rounded-md p-1 shadow-sm">
          {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </button>
      )}

      <div className="aspect-[16/10] relative bg-muted overflow-hidden">
        <ImageSlider images={images} alt={titulo || loc.endereco} onClickImage={() => onOpenLightbox(fullImages.length > 0 ? fullImages : images, 0)} />
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
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                onClick={() => {
                  navigator.clipboard.writeText(`https://uhomesales.com/imovel/${codigo}`);
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Confira este imóvel: ${titulo} - ${loc.bairro} - ${getPreco(item)}\nhttps://uhomesales.com/imovel/${codigo}`)}`}
                target="_blank" rel="noopener noreferrer"
              >
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-green-600">
                  <Phone className="h-3 w-3" />
                </Button>
              </a>
              <ResponsavelButton codigo={codigo} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Property Card (List) ──
function PropertyCardList({ item, idx, isCampanha, selectMode, isSelected, onToggleSelect, onFavorite, isFavorite, onOpenLightbox, getPreco }: any) {
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
    <Card className={cn(
      "overflow-hidden hover:shadow-lg transition-all duration-200 relative border-border/40",
      isCampanha && "ring-1 ring-primary/20",
      selectMode && isSelected && "ring-2 ring-primary"
    )}>
      {selectMode && (
        <button onClick={() => onToggleSelect(imovelId)} className="absolute top-2 left-2 z-20 bg-background/90 rounded-md p-0.5 shadow-sm">
          {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </button>
      )}
      <div className="flex">
        <div className="w-56 h-40 flex-shrink-0 bg-muted relative">
          <ImageSlider images={images} alt={titulo || loc.endereco} onClickImage={() => onOpenLightbox(fullImages.length > 0 ? fullImages : images, 0)} />
          {isCampanha && <Badge className="absolute top-2 left-2 text-[10px] bg-primary/90 text-primary-foreground"><Megaphone className="h-2.5 w-2.5 mr-0.5" /> Campanha</Badge>}
        </div>
        <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-bold text-foreground">{getPreco(item)}</p>
              <button onClick={() => onFavorite(imovelId)} className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors">
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
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(`https://uhomesales.com/imovel/${codigo || item.id}`); toast.success("Link copiado!"); }}>
                <Copy className="h-3 w-3" />
              </Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${titulo} - ${loc.bairro} - ${getPreco(item)}`)}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-green-600"><Phone className="h-3 w-3" /></Button>
              </a>
              {codigo && <ResponsavelButton codigo={codigo} />}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════
// ██  MAIN PAGE
// ══════════════════════════════════════════

export default function ImoveisPage() {
  const { user } = useAuth();
  const { search: typesenseSearch, autocomplete: typesenseAutocomplete, loading: tsLoading } = useTypesenseSearch();
  const { searchWithAI, clearAISearch, removeTag, aiLoading, aiResult, aiError, aiProperties, aiTotal, aiSearchTime } = useAISearch();
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [campanhaAtiva, setCampanhaAtiva] = useState(false);
  const [campanhaOverrides, setCampanhaOverrides] = useState<{ codigo: string; nome: string; fotos: string[]; valor_min: number | null; valor_max: number | null; bairro: string | null; dormitorios: number | null; descricao: string | null; status_obra: string | null; previsao_entrega: string | null }[]>([]);
  const [uhomeOnly, setUhomeOnly] = useState(false);

  // Load campaign codes from empreendimento_overrides (source of truth for "Anúncios no Ar")
  useEffect(() => {
    supabase.from("empreendimento_overrides").select("codigo, nome, fotos, valor_min, valor_max, bairro, dormitorios, descricao, status_obra, previsao_entrega").then(({ data }) => {
      if (data && data.length > 0) {
        setCampanhaOverrides(data.map(d => ({
          codigo: d.codigo,
          nome: d.nome || d.codigo,
          fotos: d.fotos || [],
          valor_min: d.valor_min,
          valor_max: d.valor_max,
          bairro: d.bairro,
          dormitorios: d.dormitorios,
          descricao: d.descricao,
          status_obra: d.status_obra,
          previsao_entrega: d.previsao_entrega,
        })));
      } else {
        setCampanhaOverrides(CAMPANHA_CODES_FALLBACK.map(c => ({ codigo: c.codigo, nome: c.nome, fotos: [], valor_min: null, valor_max: null, bairro: null, dormitorios: null, descricao: null, status_obra: null, previsao_entrega: null })));
      }
    });
  }, []);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState("relevancia");
  const [searchTimeMs, setSearchTimeMs] = useState<number | null>(null);
  const [searchMode, setSearchMode] = useState<"normal" | "ai">("normal");
  const [aiQuery, setAiQuery] = useState("");

  // Autocomplete
  const [suggestions, setSuggestions] = useState<{ type: string; value: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Vitrine selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingVitrine, setCreatingVitrine] = useState(false);
  const [vitrineLink, setVitrineLink] = useState<string | null>(null);

  // Filters — reactive (auto-apply on change)
  const [contrato, setContrato] = useState("venda");
  const [tipo, setTipo] = useState<string[]>([]);
  const [bairro, setBairro] = useState<string[]>([]);
  const [bairroSearch, setBairroSearch] = useState("");
  const [dormitorios, setDormitorios] = useState<string[]>([]);
  const [suitesFilter, setSuitesFilter] = useState("");
  const [vagas, setVagas] = useState("");
  const [areaRange, setAreaRange] = useState<[number, number]>([0, 500]);
  const [valorRange, setValorRange] = useState<[number, number]>([0, 5_000_000]);
  const [somenteObras, setSomenteObras] = useState(false);

  // Track if Typesense is available
  const [useTypesense, setUseTypesense] = useState(true);

  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredBairros = useMemo(() => {
    if (!bairroSearch) return BAIRROS_POA;
    const q = bairroSearch.toLowerCase();
    return BAIRROS_POA.filter((b) => b.toLowerCase().includes(q));
  }, [bairroSearch]);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`uhome-favorites-${user?.id}`);
    if (saved) setFavorites(new Set(JSON.parse(saved)));
  }, [user?.id]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(`uhome-favorites-${user?.id}`, JSON.stringify([...next]));
      return next;
    });
  };

  // Abort controller for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  // ── Typesense search ──
  const fetchViaTypesense = useCallback(async (pageNum: number) => {
    const filterBy = buildFilterBy({
      contrato, tipo, bairro, dormitorios, suites: suitesFilter, vagas,
      valorRange, areaRange, somenteObras, uhomeOnly,
    });
    const sortByStr = search ? "" : buildSortBy(sortBy, contrato);

    const result = await typesenseSearch({
      q: search || "*",
      page: pageNum,
      per_page: 24,
      filter_by: filterBy || undefined,
      sort_by: sortByStr || undefined,
    });

    if (!result) return false;

    // Map Typesense docs back to the format cards expect
    const items = result.data.map((doc: any) => ({
      ...doc,
      codigo: doc.codigo || doc.id,
      titulo_anuncio: doc.titulo,
      empreendimento_nome: doc.empreendimento,
      endereco_bairro: doc.bairro,
      endereco_cidade: doc.cidade,
      endereco_logradouro: doc.endereco,
      valor_venda: doc.valor_venda,
      valor_locacao: doc.valor_locacao,
      area_privativa: doc.area_privativa,
      garagens: doc.vagas,
      suites: doc.suites,
      banheiros: doc.banheiros,
      dormitorios: doc.dormitorios,
      valor_condominio: doc.valor_condominio,
      situacao: doc.situacao,
      _fotos_normalized: doc.fotos?.length ? doc.fotos : doc.foto_principal ? [doc.foto_principal] : [],
      imagens: (doc.fotos || []).map((url: string) => ({ link_thumb: url, link: url })),
    }));

    setImoveis(items);
    setTotal(result.total);
    setTotalPages(result.totalPages);
    setPage(pageNum);
    setSearchTimeMs(result.search_time_ms || null);
    return true;
  }, [search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, uhomeOnly, sortBy, typesenseSearch]);

  // ── Fallback to jetimob-proxy ──
  const fetchViaJetimob = useCallback(async (pageNum: number, campanha = campanhaAtiva, uhome = uhomeOnly) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (campanha) {
        // Use overrides data directly — no need to call jetimob-proxy
        const items = campanhaOverrides.map(ov => ({
          codigo: ov.codigo,
          titulo_anuncio: ov.nome || ov.codigo,
          empreendimento_nome: ov.nome || ov.codigo,
          endereco_bairro: ov.bairro || "",
          valor_venda: ov.valor_min || 0,
          valor_max: ov.valor_max || 0,
          dormitorios: ov.dormitorios || 0,
          descricao: ov.descricao || "",
          status: ov.status_obra || "Lançamento",
          previsao_entrega: ov.previsao_entrega || "",
          foto_principal: ov.fotos?.[0] || "",
          fotos: ov.fotos || [],
          imagens: (ov.fotos || []).map(url => ({ link: url, link_thumb: url })),
          _fotos_normalized: ov.fotos || [],
          _is_campanha_override: true,
        }));
        setImoveis(items as any[]);
        setTotal(items.length);
        setTotalPages(1);
        setPage(1);
      } else {
        const valorMin = valorRange[0] > 0 ? String(valorRange[0]) : undefined;
        const valorMax = valorRange[1] < 5_000_000 ? String(valorRange[1]) : undefined;
        const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
          body: {
            action: "list_imoveis", page: pageNum, pageSize: 24,
            search: search || undefined,
            contrato: contrato || undefined,
            tipo: tipo.length ? tipo.join(",") : undefined,
            cidade: "Porto Alegre",
            bairro: bairro.length ? bairro.join(",") : undefined,
            search_uhome: uhome ? true : undefined,
            dormitorios: dormitorios.length ? dormitorios[0] : undefined,
            suites: suitesFilter && suitesFilter !== "all" ? suitesFilter : undefined,
            vagas: vagas && vagas !== "all" ? vagas : undefined,
            area_min: areaRange[0] > 0 ? String(areaRange[0]) : undefined,
            area_max: areaRange[1] < 500 ? String(areaRange[1]) : undefined,
            valor_min: valorMin, valor_max: valorMax,
            somente_obras: somenteObras || undefined,
          },
        });
        if (controller.signal.aborted) return;
        if (error) { toast.error("Erro ao buscar imóveis"); return; }
        const items = Array.isArray(data?.data) ? data.data : [];
        setImoveis(items);
        setTotal(data?.total || items.length);
        setTotalPages(data?.totalPages || Math.ceil((data?.total || items.length) / 24));
        setPage(pageNum);
      }
    } catch (e: any) {
      if (e?.name === "AbortError" || controller.signal.aborted) return;
      toast.error("Erro de conexão");
    }
  }, [search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, campanhaAtiva, uhomeOnly, campanhaOverrides]);

  // ── Main fetch: try Typesense first, fallback to Jetimob ──
  const fetchImoveis = useCallback(async (pageNum: number, campanha = campanhaAtiva, uhome = uhomeOnly) => {
    setLoading(true);
    setSearchTimeMs(null);

    try {
      // Campanha mode always uses jetimob-proxy (specific codes)
      if (campanha) {
        await fetchViaJetimob(pageNum, campanha, uhome);
        return;
      }

      // Try Typesense
      if (useTypesense) {
        const success = await fetchViaTypesense(pageNum);
        if (success) return;
        // If Typesense fails, fall back
        console.warn("Typesense unavailable, falling back to jetimob-proxy");
        setUseTypesense(false);
      }

      // Fallback
      await fetchViaJetimob(pageNum, campanha, uhome);
    } finally {
      setLoading(false);
    }
  }, [campanhaAtiva, uhomeOnly, useTypesense, fetchViaTypesense, fetchViaJetimob]);

  // Keep a ref to the latest fetchImoveis to avoid stale closures in effects
  const fetchRef = useRef(fetchImoveis);
  fetchRef.current = fetchImoveis;

  // Initial load
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    fetchRef.current(1, false);
  }, []);

  // Auto-apply ALL filter changes with debounce (reactive like Zillow)
  // Using a serialized key ensures we catch every filter change including uhomeOnly/campanhaAtiva
  const filterKey = useMemo(() =>
    JSON.stringify({ search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, sortBy, uhomeOnly, campanhaAtiva }),
    [search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, sortBy, uhomeOnly, campanhaAtiva]
  );
  const prevFilterKey = useRef(filterKey);

  useEffect(() => {
    if (!mounted.current) return;
    if (prevFilterKey.current === filterKey) return;
    prevFilterKey.current = filterKey;

    // If an immediate search was already triggered, skip the debounced one
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false;
      return;
    }

    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      fetchRef.current(1);
    }, 400);
    return () => { if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current); };
  }, [filterKey]);

  // Flag to skip the debounced effect when handleSearch already fired immediately
  const skipNextDebounce = useRef(false);

  const handleSearch = () => {
    setShowSuggestions(false);
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    skipNextDebounce.current = true;
    // Immediately fetch — fetchRef always points to latest closure which captures current search state
    setCampanhaAtiva(false);
    setUhomeOnly(false);
    // Use rAF + setTimeout to ensure state updates (campanha/uhome) have flushed
    requestAnimationFrame(() => {
      setTimeout(() => {
        prevFilterKey.current = JSON.stringify({ search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, sortBy, uhomeOnly: false, campanhaAtiva: false });
        fetchRef.current(1);
      }, 0);
    });
  };

  // Autocomplete with debounce — Typesense powered
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await typesenseAutocomplete(value);
      if (results.length) {
        setSuggestions(results);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 200);
  }, [typesenseAutocomplete]);

  const handleSuggestionClick = (suggestion: { type: string; value: string }) => {
    setShowSuggestions(false);
    setSuggestions([]);
    if (suggestion.type === "bairro") {
      setBairro(prev => prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]);
      setSearch("");
    } else {
      setSearch(suggestion.value);
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
      skipNextDebounce.current = true;
      setTimeout(() => fetchRef.current(1), 0);
    }
  };

  const getPreco = (item: any): string => {
    const venda = getNum(item, "valor_venda", "preco_venda", "valor", "price");
    if (venda) return fmtBRL(venda);
    return "Consultar";
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setVitrineLink(null);
  };

  const openLightbox = (imgs: string[], index: number) => { setLightboxImages(imgs); setLightboxIndex(index); setLightboxOpen(true); };

  // Sort items
  const sortedImoveis = useMemo(() => {
    let items = [...imoveis];
    if (showFavoritesOnly) items = items.filter(item => favorites.has(String(item.codigo || item.id_imovel || item.id)));
    if (somenteObras) items = items.filter(item => extractEntrega(item).emObras);

    if (sortBy === "menor_preco") items.sort((a, b) => (getNum(a, "valor_venda", "valor") || 999999999) - (getNum(b, "valor_venda", "valor") || 999999999));
    else if (sortBy === "maior_preco") items.sort((a, b) => (getNum(b, "valor_venda", "valor") || 0) - (getNum(a, "valor_venda", "valor") || 0));
    else if (sortBy === "maior_area") items.sort((a, b) => (getNumIncZero(b, "area_privativa", "area_util") || 0) - (getNumIncZero(a, "area_privativa", "area_util") || 0));
    return items;
  }, [imoveis, sortBy, showFavoritesOnly, favorites, somenteObras]);

  // Active filter tags
  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [];
  if (search) activeFilters.push({ key: "search", label: `"${search}"`, onRemove: () => { setSearch(""); } });
  if (tipo.length > 0) activeFilters.push({ key: "tipo", label: tipo.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", "), onRemove: () => setTipo([]) });
  if (bairro.length > 0) activeFilters.push({ key: "bairro", label: bairro.join(", "), onRemove: () => setBairro([]) });
  if (dormitorios.length > 0) activeFilters.push({ key: "dorms", label: dormitorios.map(d => `${d} dorm`).join(", "), onRemove: () => setDormitorios([]) });
  if (suitesFilter && suitesFilter !== "all") activeFilters.push({ key: "suites", label: `${suitesFilter}+ suíte`, onRemove: () => setSuitesFilter("") });
  if (vagas && vagas !== "all") activeFilters.push({ key: "vagas", label: `${vagas}+ vaga`, onRemove: () => setVagas("") });
  if (valorRange[0] > 0 || valorRange[1] < 5_000_000) activeFilters.push({ key: "valor", label: `${fmtCompact(valorRange[0])} — ${valorRange[1] >= 5_000_000 ? "5M+" : fmtCompact(valorRange[1])}`, onRemove: () => setValorRange([0, 5_000_000]) });
  if (areaRange[0] > 0 || areaRange[1] < 500) activeFilters.push({ key: "area", label: `${areaRange[0]}m² — ${areaRange[1] >= 500 ? "500+" : areaRange[1]}m²`, onRemove: () => setAreaRange([0, 500]) });
  if (somenteObras) activeFilters.push({ key: "obras", label: "Em obras", onRemove: () => setSomenteObras(false) });
  if (uhomeOnly) activeFilters.push({ key: "uhome", label: "uHome", onRemove: () => { setUhomeOnly(false); } });
  if (campanhaAtiva) activeFilters.push({ key: "campanha", label: "Campanha", onRemove: () => { setCampanhaAtiva(false); } });

  const clearAllFilters = () => {
    setTipo([]); setBairro([]); setDormitorios([]); setSuitesFilter(""); setVagas(""); setAreaRange([0, 500]); setValorRange([0, 5_000_000]); setSomenteObras(false); setSearch(""); setUhomeOnly(false); setCampanhaAtiva(false);
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PhotoLightbox images={lightboxImages} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          {/* Row 1: Search mode toggle + Search */}
          <div className="py-3 flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex items-center rounded-full border border-border overflow-hidden shrink-0">
              <button
                onClick={() => { setSearchMode("normal"); clearAISearch(); }}
                className={cn("px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1",
                  searchMode === "normal" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                <Search className="h-3 w-3" /> Filtros
              </button>
              <button
                onClick={() => setSearchMode("ai")}
                className={cn("px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1",
                  searchMode === "ai" ? "bg-gradient-to-r from-violet-600 to-primary text-white" : "bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="h-3 w-3" /> Busca IA
              </button>
            </div>

            {searchMode === "normal" ? (
              /* Normal search input */
              <div className="relative flex-1 max-w-2xl">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Busque por bairro, empreendimento, código..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="pl-10 pr-20 h-10 text-sm bg-muted/50 border-border/60 rounded-full focus-visible:ring-primary/30 focus-visible:bg-background"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {search && (
                    <button onClick={() => { setSearch(""); setSuggestions([]); setShowSuggestions(false); }} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/50">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Button onClick={handleSearch} size="sm" className="h-7 px-3 rounded-full text-xs gap-1" disabled={loading}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                    Buscar
                  </Button>
                </div>
                {/* Autocomplete dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-background border border-border rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
                    {(() => {
                      const bairros = suggestions.filter(s => s.type === "bairro");
                      const empreendimentos = suggestions.filter(s => s.type === "empreendimento");
                      const codigos = suggestions.filter(s => s.type === "codigo");
                      return (
                        <>
                          {bairros.length > 0 && (
                            <div className="px-3 pt-2.5 pb-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bairros</p>
                              {bairros.map((s, i) => (
                                <button key={i} onClick={() => handleSuggestionClick(s)} className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted/50 rounded-md flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {s.value}
                                </button>
                              ))}
                            </div>
                          )}
                          {empreendimentos.length > 0 && (
                            <div className="px-3 pt-2 pb-1 border-t border-border/50">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Empreendimentos</p>
                              {empreendimentos.map((s, i) => (
                                <button key={i} onClick={() => handleSuggestionClick(s)} className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted/50 rounded-md flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {s.value}
                                </button>
                              ))}
                            </div>
                          )}
                          {codigos.length > 0 && (
                            <div className="px-3 pt-2 pb-2.5 border-t border-border/50">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Códigos</p>
                              {codigos.map((s, i) => (
                                <button key={i} onClick={() => handleSuggestionClick(s)} className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted/50 rounded-md flex items-center gap-2 font-mono">
                                  <Search className="h-3.5 w-3.5 text-muted-foreground" /> {s.value}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              /* AI search input */
              <div className="relative flex-1 max-w-2xl">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500" />
                <Input
                  placeholder="Descreva o imóvel que você procura... ex: apartamento 3 dorm perto do Iguatemi até 1M"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && aiQuery.trim().length >= 3) searchWithAI(aiQuery); }}
                  className="pl-10 pr-28 h-10 text-sm bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/40 rounded-full focus-visible:ring-violet-400/30 focus-visible:bg-background"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {aiQuery && (
                    <button onClick={() => { setAiQuery(""); clearAISearch(); }} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/50">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Button
                    onClick={() => searchWithAI(aiQuery)}
                    size="sm"
                    className="h-7 px-3 rounded-full text-xs gap-1 bg-gradient-to-r from-violet-600 to-primary hover:from-violet-700 hover:to-primary/90 text-white border-0"
                    disabled={aiLoading || aiQuery.trim().length < 3}
                  >
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                    Buscar com IA
                  </Button>
                </div>
              </div>
            )}

            {/* Right actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); }}
                variant={showFavoritesOnly ? "default" : "ghost"} size="sm" className="gap-1.5 h-9"
              >
                <Heart className={cn("h-4 w-4", showFavoritesOnly && "fill-current")} />
                <span className="hidden sm:inline">Favoritos</span>
                {favorites.size > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{favorites.size}</Badge>}
              </Button>
              <Button
                onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); setVitrineLink(null); }}
                variant={selectMode ? "default" : "ghost"} size="sm" className="gap-1.5 h-9"
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">{selectMode ? `${selectedIds.size} selecionados` : "Vitrine"}</span>
              </Button>
            </div>
          </div>

          {/* Row 2: Filter chips */}
          <div className="pb-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {/* Contrato: uHome só trabalha com venda */}

            {/* Preço */}
            <FilterChip
              label={valorRange[0] > 0 || valorRange[1] < 5_000_000 ? `${fmtCompact(valorRange[0])} — ${valorRange[1] >= 5_000_000 ? "5M+" : fmtCompact(valorRange[1])}` : "Preço"}
              active={valorRange[0] > 0 || valorRange[1] < 5_000_000}
              onClear={() => setValorRange([0, 5_000_000])}
            >
              <div className="w-64 space-y-3">
                <p className="text-xs font-semibold text-foreground">Faixa de preço</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap">{fmtCompact(valorRange[0])}</span>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-muted-foreground whitespace-nowrap">{valorRange[1] >= 5_000_000 ? "5M+" : fmtCompact(valorRange[1])}</span>
                </div>
                <Slider min={0} max={5_000_000} step={50_000} value={valorRange} onValueChange={(v) => setValorRange(v as [number, number])} />
              </div>
            </FilterChip>

            {/* Dormitórios */}
            <FilterChip
              label={dormitorios.length > 0 ? dormitorios.map(d => `${d} dorm`).join(", ") : "Dormitórios"}
              active={dormitorios.length > 0}
              onClear={() => setDormitorios([])}
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Dormitórios <span className="text-muted-foreground font-normal">(múltipla seleção)</span></p>
                <div className="flex gap-1.5">
                  {["1", "2", "3", "4"].map(v => {
                    const selected = dormitorios.includes(v);
                    return (
                      <button key={v} onClick={() => setDormitorios(prev => selected ? prev.filter(d => d !== v) : [...prev, v])} className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/40"
                      )}>
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            </FilterChip>

            {/* Tipo */}
            <FilterChip
              label={tipo.length > 0 ? tipo.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ") : "Tipo"}
              active={tipo.length > 0}
              onClear={() => setTipo([])}
            >
              <div className="space-y-1 w-44">
                <p className="text-xs font-semibold text-foreground mb-2">Tipo de imóvel <span className="text-muted-foreground font-normal">(múltipla)</span></p>
                {[
                  { v: "apartamento", l: "Apartamento" }, { v: "casa", l: "Casa" },
                  { v: "cobertura", l: "Cobertura" }, { v: "terreno", l: "Terreno" }, { v: "comercial", l: "Comercial" },
                  { v: "loft", l: "Loft / Studio" }, { v: "kitnet", l: "Kitnet" }
                ].map(({ v, l }) => {
                  const selected = tipo.includes(v);
                  return (
                    <button key={v} onClick={() => setTipo(prev => selected ? prev.filter(t => t !== v) : [...prev, v])} className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-2",
                      selected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50"
                    )}>
                      <Check className={cn("h-3 w-3 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                      {l}
                    </button>
                  );
                })}
              </div>
            </FilterChip>

            {/* Bairro */}
            <FilterChip label={bairro.length > 0 ? (bairro.length <= 2 ? bairro.join(", ") : `${bairro.length} bairros`) : "Bairro"} active={bairro.length > 0} onClear={() => setBairro([])}>
              <div className="w-56">
                <Command>
                  <CommandInput placeholder="Buscar bairro..." value={bairroSearch} onValueChange={setBairroSearch} className="h-8" />
                  <CommandList className="max-h-48">
                    <CommandEmpty>
                      {bairroSearch ? (
                        <button className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded" onClick={() => { setBairro(prev => [...prev, bairroSearch]); setBairroSearch(""); }}>
                          Usar "<strong>{bairroSearch}</strong>"
                        </button>
                      ) : "Nenhum encontrado"}
                    </CommandEmpty>
                    <CommandGroup>
                      {bairro.length > 0 && (
                        <CommandItem value="__limpar__" onSelect={() => { setBairro([]); setBairroSearch(""); }}>
                          <X className="mr-2 h-3 w-3 text-muted-foreground" /> Limpar seleção
                        </CommandItem>
                      )}
                      {filteredBairros.map((b) => {
                        const selected = bairro.includes(b);
                        return (
                          <CommandItem key={b} value={b} onSelect={() => { setBairro(prev => selected ? prev.filter(x => x !== b) : [...prev, b]); setBairroSearch(""); }}>
                            <Check className={cn("mr-2 h-3 w-3", selected ? "opacity-100" : "opacity-0")} /> {b}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            </FilterChip>

            {/* More filters */}
            <FilterChip
              label="Mais filtros"
              active={!!(suitesFilter && suitesFilter !== "all") || !!(vagas && vagas !== "all") || (areaRange[0] > 0 || areaRange[1] < 500) || somenteObras}
            >
              <div className="w-64 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Suítes</p>
                  <div className="flex gap-1.5">
                    {["all", "1", "2", "3"].map(v => (
                      <button key={v} onClick={() => setSuitesFilter(v === "all" ? "" : v)} className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                        (suitesFilter === v || (!suitesFilter && v === "all"))
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/40"
                      )}>
                        {v === "all" ? "Todos" : `${v}+`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Vagas</p>
                  <div className="flex gap-1.5">
                    {["all", "1", "2", "3"].map(v => (
                      <button key={v} onClick={() => setVagas(v === "all" ? "" : v)} className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                        (vagas === v || (!vagas && v === "all"))
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/40"
                      )}>
                        {v === "all" ? "Todos" : `${v}+`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">
                    Área: {areaRange[0]}m² — {areaRange[1] >= 500 ? "500+" : areaRange[1]}m²
                  </p>
                  <Slider min={0} max={500} step={10} value={areaRange} onValueChange={(v) => setAreaRange(v as [number, number])} />
                </div>

                <label className="flex items-center gap-2 text-xs cursor-pointer select-none pt-1 border-t border-border/50">
                  <input type="checkbox" checked={somenteObras} onChange={(e) => setSomenteObras(e.target.checked)} className="rounded border-border" />
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Em obras / na planta</span>
                </label>
              </div>
            </FilterChip>

            {/* Quick toggles */}
            <div className="border-l border-border/50 pl-2 ml-1 flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { setCampanhaAtiva(prev => !prev); setUhomeOnly(false); }}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                  campanhaAtiva ? "bg-primary/10 border-primary/30 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                <Megaphone className="h-3 w-3" /> Campanha
              </button>
              <button
                onClick={() => { setUhomeOnly(prev => !prev); setCampanhaAtiva(false); }}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                  uhomeOnly ? "bg-primary/10 border-primary/30 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                <Building2 className="h-3 w-3" /> uHome
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      {viewMode === "map" ? (
        /* ═══ MAP SPLIT VIEW ═══ */
        <div className="flex-1 flex overflow-hidden w-full">
          {/* Left: property list */}
          <div className="w-[420px] xl:w-[480px] shrink-0 h-[calc(100vh-120px)] overflow-y-auto px-4 py-3 space-y-3 border-r border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {loading ? <Skeleton className="h-4 w-24" /> : (
                  <span className="text-sm font-medium text-foreground">{total.toLocaleString()} imóveis</span>
                )}
              </div>
              <div className="flex border border-border/60 rounded-lg overflow-hidden">
                <button onClick={() => setViewMode("grid")} className={cn("p-1.5 transition-colors", "bg-background text-muted-foreground hover:bg-muted")}><LayoutGrid className="h-4 w-4" /></button>
                <button onClick={() => setViewMode("list")} className={cn("p-1.5 transition-colors", "bg-background text-muted-foreground hover:bg-muted")}><List className="h-4 w-4" /></button>
                <button onClick={() => setViewMode("map")} className="p-1.5 bg-primary text-primary-foreground"><Map className="h-4 w-4" /></button>
              </div>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden border-border/40">
                    <div className="flex"><Skeleton className="w-32 h-28 rounded-none shrink-0" /><div className="flex-1 p-2.5 space-y-1.5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div></div>
                  </Card>
                ))}
              </div>
            ) : sortedImoveis.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-sm font-medium text-foreground">Nenhum imóvel</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedImoveis.map((item, idx) => {
                  const isCampanha = campanhaOverrides.some((c) => c.codigo === item.codigo);
                  const imovelId = String(item.codigo || item.id_imovel || item.id || idx);
                  return <PropertyCardList key={item.id_imovel || item.codigo || idx} item={item} idx={idx} isCampanha={isCampanha} selectMode={selectMode} isSelected={selectedIds.has(imovelId)} onToggleSelect={toggleSelect} onFavorite={toggleFavorite} isFavorite={favorites.has(imovelId)} onOpenLightbox={openLightbox} getPreco={getPreco} />;
                })}
                {totalPages > 1 && !campanhaAtiva && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => fetchRef.current(page - 1)} className="gap-1 rounded-full text-xs"><ChevronLeft className="h-3 w-3" /></Button>
                    <span className="text-xs text-muted-foreground tabular-nums">{page}/{totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => fetchRef.current(page + 1)} className="gap-1 rounded-full text-xs"><ChevronRight className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Right: map */}
          <div className="flex-1 h-[calc(100vh-120px)]">
            <PropertyMap
              properties={sortedImoveis}
              loading={loading}
              onFavorite={toggleFavorite}
              favorites={favorites}
              getPreco={getPreco}
              className="h-full w-full rounded-none border-0"
            />
          </div>
        </div>
      ) : (
        /* ═══ GRID / LIST VIEW ═══ */
        <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 md:px-6 py-4">
          {/* Vitrine bar */}
          {selectMode && selectedIds.size > 0 && (
            <Card className="p-3 mb-4 flex items-center justify-between bg-primary/5 border-primary/20 flex-wrap gap-2">
              <span className="text-sm font-medium">{selectedIds.size} imóvel(is) selecionado(s)</span>
              <div className="flex items-center gap-2">
                {vitrineLink ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input value={vitrineLink} readOnly className="text-xs h-8 w-64" />
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(vitrineLink); toast.success("Link copiado!"); }}><Copy className="h-3.5 w-3.5" /></Button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Confira esta seleção de imóveis: ${vitrineLink}`)}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1"><Phone className="h-3.5 w-3.5" /> WhatsApp</Button>
                    </a>
                  </div>
                ) : (
                  <Button size="sm" disabled={creatingVitrine} onClick={async () => {
                    if (!user) return;
                    setCreatingVitrine(true);
                    try {
                      const { data, error } = await supabase.from("vitrines").insert({ created_by: user.id, titulo: "Seleção de Imóveis", tipo: "property_selection", imovel_ids: [...selectedIds] as any }).select("id").single();
                      if (error) throw error;
                      const link = getVitrinePublicUrl(data.id);
                      setVitrineLink(link); navigator.clipboard.writeText(link); toast.success("Vitrine criada! Link copiado.");
                    } catch { toast.error("Erro ao criar vitrine"); } finally { setCreatingVitrine(false); }
                  }} className="gap-1.5">
                    {creatingVitrine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Gerar Link
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* ═══ AI SEARCH RESULTS ═══ */}
          {searchMode === "ai" ? (
            <div className="space-y-4">
              {aiLoading && (
                <Card className="p-6 border-violet-200/50 dark:border-violet-800/30">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center">
                      <Brain className="h-4 w-4 text-white animate-pulse" />
                    </div>
                    <div className="space-y-1.5 flex-1"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                  </div>
                </Card>
              )}
              {aiError && <Card className="p-4 border-destructive/30 bg-destructive/5"><p className="text-sm text-destructive">{aiError}</p></Card>}
              {aiResult && !aiLoading && (
                <>
                  <Card className="p-4 border-violet-200/50 dark:border-violet-800/30">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium">{aiResult.explicacao}</p>
                        {aiResult.sugestao_alternativa && <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1"><ArrowRight className="h-3 w-3 shrink-0" /> {aiResult.sugestao_alternativa}</p>}
                        {aiSearchTime != null && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" /> {aiSearchTime}ms</p>}
                      </div>
                    </div>
                  </Card>
                  {aiResult.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">Filtros IA:</span>
                      {aiResult.tags.map(tag => (
                        <span key={tag.key} className={cn("inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border", tag.category === "perfil" ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20" : "bg-primary/8 text-primary border-primary/20")}>
                          {tag.label}
                          <button onClick={() => removeTag(tag.key)} className="hover:bg-primary/20 rounded-full p-0.5 -mr-0.5"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      ))}
                      <button onClick={() => { clearAISearch(); setAiQuery(""); }} className="text-xs text-muted-foreground hover:text-foreground ml-1 underline underline-offset-2">Limpar</button>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{aiTotal > 0 ? `${aiProperties.length} imóveis` : "Nenhum resultado"}{aiTotal > 0 && <span className="text-muted-foreground font-normal"> • por aderência</span>}</span>
                    <div className="flex border border-border/60 rounded-lg overflow-hidden">
                      <button onClick={() => setViewMode("grid")} className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}><LayoutGrid className="h-4 w-4" /></button>
                      <button onClick={() => setViewMode("list")} className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}><List className="h-4 w-4" /></button>
                      <button onClick={() => setViewMode("map")} className={cn("p-1.5 transition-colors", "bg-background text-muted-foreground hover:bg-muted")}><Map className="h-4 w-4" /></button>
                    </div>
                  </div>
                  {aiProperties.length === 0 ? (
                    <Card className="p-16 text-center border-border/40"><Sparkles className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" /><p className="text-lg font-semibold text-foreground">Nenhum imóvel encontrado</p><p className="text-sm text-muted-foreground mt-1">Tente descrever de outra forma</p></Card>
                  ) : (
                    <div className={cn("grid gap-4", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
                      {aiProperties.map(({ item, score }, idx) => {
                        const imovelId = String(item.codigo || item.id_imovel || item.id || idx);
                        const CardComponent = PropertyCardGrid;
                        return (
                          <div key={item.id_imovel || item.codigo || idx} className="relative">
                            <div className={cn("absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm backdrop-blur-sm", score >= 90 ? "bg-emerald-500/90 text-white" : score >= 75 ? "bg-primary/90 text-primary-foreground" : score >= 60 ? "bg-amber-500/90 text-white" : "bg-muted/90 text-foreground")}>
                              <Sparkles className="h-2.5 w-2.5" />{score}%
                            </div>
                            <CardComponent item={item} idx={idx} isCampanha={false} selectMode={selectMode} isSelected={selectedIds.has(imovelId)} onToggleSelect={toggleSelect} onFavorite={toggleFavorite} isFavorite={favorites.has(imovelId)} onOpenLightbox={openLightbox} getPreco={getPreco} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              {!aiResult && !aiLoading && !aiError && (
                <Card className="p-12 text-center border-violet-200/30 dark:border-violet-800/20">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center mx-auto mb-4"><Brain className="h-7 w-7 text-white" /></div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Busca Inteligente por IA</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">Descreva o imóvel que você procura em linguagem natural.</p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                    {["apartamento 3 dorm perto do Iguatemi até 1M", "studio para investir em Porto Alegre", "casa em condomínio com 3 suítes", "imóvel alto padrão com vista", "lançamento com entrada facilitada", "compacto para Airbnb"].map(s => (
                      <button key={s} onClick={() => { setAiQuery(s); searchWithAI(s); }} className="text-xs px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-800/40 text-muted-foreground hover:text-violet-700 dark:hover:text-violet-300 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-all">{s}</button>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <>
              {activeFilters.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {activeFilters.map(f => (
                    <span key={f.key} className="inline-flex items-center gap-1 bg-primary/8 text-primary text-xs font-medium px-2.5 py-1 rounded-full border border-primary/20">
                      {f.label}
                      <button onClick={f.onRemove} className="hover:bg-primary/20 rounded-full p-0.5 -mr-0.5"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground ml-1 underline underline-offset-2">Limpar tudo</button>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {loading ? <Skeleton className="h-4 w-24" /> : (
                    <>
                      <span className="text-sm font-medium text-foreground">{total.toLocaleString()} imóveis</span>
                      {searchTimeMs != null && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" /> {searchTimeMs}ms</span>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[140px] h-8 text-xs border-border/60"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevancia">Relevância</SelectItem>
                      <SelectItem value="menor_preco">Menor preço</SelectItem>
                      <SelectItem value="maior_preco">Maior preço</SelectItem>
                      <SelectItem value="maior_area">Maior área</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex border border-border/60 rounded-lg overflow-hidden">
                    <button onClick={() => setViewMode("grid")} className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}><LayoutGrid className="h-4 w-4" /></button>
                    <button onClick={() => setViewMode("list")} className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}><List className="h-4 w-4" /></button>
                    <button onClick={() => setViewMode("map")} className={cn("p-1.5 transition-colors", "bg-background text-muted-foreground hover:bg-muted")}><Map className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
              {loading ? (
                <div className={cn("grid gap-4", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden border-border/40">
                      <div><Skeleton className="aspect-[16/10] rounded-none" /><div className="p-3.5 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                    </Card>
                  ))}
                </div>
              ) : sortedImoveis.length === 0 ? (
                <Card className="p-16 text-center border-border/40">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
                  <p className="text-lg font-semibold text-foreground">Nenhum imóvel encontrado</p>
                  <p className="text-sm text-muted-foreground mt-1">Tente ajustar seus filtros ou termo de busca</p>
                  {activeFilters.length > 0 && <Button variant="outline" size="sm" className="mt-4" onClick={clearAllFilters}><X className="h-3.5 w-3.5 mr-1.5" /> Limpar filtros</Button>}
                </Card>
              ) : (
                <>
                  <div className={cn("grid gap-4", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
                    {sortedImoveis.map((item, idx) => {
                      const isCampanha = campanhaOverrides.some((c) => c.codigo === item.codigo);
                      const imovelId = String(item.codigo || item.id_imovel || item.id || idx);
                      return <PropertyCardGrid key={item.id_imovel || item.codigo || idx} item={item} idx={idx} isCampanha={isCampanha} selectMode={selectMode} isSelected={selectedIds.has(imovelId)} onToggleSelect={toggleSelect} onFavorite={toggleFavorite} isFavorite={favorites.has(imovelId)} onOpenLightbox={openLightbox} getPreco={getPreco} />;
                    })}
                  </div>
                  {totalPages > 1 && !campanhaAtiva && (
                    <div className="flex items-center justify-center gap-3 pt-6 pb-2">
                      <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => fetchRef.current(page - 1)} className="gap-1 rounded-full"><ChevronLeft className="h-4 w-4" /> Anterior</Button>
                      <span className="text-sm text-muted-foreground font-medium tabular-nums">{page} de {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => fetchRef.current(page + 1)} className="gap-1 rounded-full">Próxima <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
