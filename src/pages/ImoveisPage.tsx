import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search, Building2, Loader2, ChevronLeft, ChevronRight, Home, BedDouble, Bath,
  Maximize, MapPin, Car, Megaphone, ChevronsUpDown, Check, UserCircle, Phone,
  Mail, X, Share2, CheckSquare, Square, Link2, Copy, CalendarClock,
  LayoutGrid, List, Star, SlidersHorizontal, ChevronDown, Heart
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getVitrineShareUrl } from "@/lib/vitrineUrl";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Helpers ──

function extractImages(item: any): string[] {
  if (item._fotos_normalized?.length) return item._fotos_normalized;
  const arr = item.imagens;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr.map((img: any) => img.link_thumb || img.link || img.url || img.src || "").filter(Boolean);
}

function extractFullImages(item: any): string[] {
  if (item._fotos_normalized?.length) return item._fotos_normalized;
  const arr = item.imagens;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr.map((img: any) => img.link || img.link_thumb || img.url || img.src || "").filter(Boolean);
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

const CAMPANHA_CODES = [
  { codigo: "97325-UH", nome: "Shift" },
  { codigo: "32849-UH", nome: "Open Bosque" },
  { codigo: "57920-UH", nome: "Orygem" },
  { codigo: "39808-UH", nome: "Melnick Day - Compactos" },
  { codigo: "58935-UH", nome: "Lake Eyre" },
  { codigo: "4688-UH", nome: "Casa Bastian" },
  { codigo: "52101-UH", nome: "Casa Tua" },
  { codigo: "41190-UH", nome: "Las Casas" },
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
      <img src={images[current]} alt={alt} className="w-full h-full object-cover cursor-pointer transition-transform" loading="lazy" onClick={(e) => { e.stopPropagation(); onClickImage?.(); }} />
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
  useEffect(() => { setCurrent(initialIndex); }, [initialIndex]);
  if (!open || images.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 bg-black/95 border-none flex flex-col [&>button]:hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Fotos do imóvel</DialogTitle>
        <button onClick={onClose} className="absolute top-3 right-3 z-50 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white"><X className="h-5 w-5" /></button>
        <div className="flex-1 flex items-center justify-center relative min-h-0">
          <img src={images[current]} alt={`Foto ${current + 1}`} className="max-w-full max-h-full object-contain" />
          {images.length > 1 && (
            <>
              <button onClick={() => setCurrent((p) => (p - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white"><ChevronLeft className="h-6 w-6" /></button>
              <button onClick={() => setCurrent((p) => (p + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white"><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5 py-3 overflow-x-auto px-4">
          {images.map((img, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={cn("w-14 h-10 rounded overflow-hidden border-2 flex-shrink-0 transition-all", i === current ? "border-primary opacity-100" : "border-transparent opacity-50 hover:opacity-80")}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        <p className="text-center text-white/60 text-xs pb-2">{current + 1} / {images.length}</p>
      </DialogContent>
    </Dialog>
  );
}

// ── Grid Card ──
function PropertyCardGrid({ item, idx, isCampanha, selectMode, isSelected, onToggleSelect, onFavorite, isFavorite, onOpenLightbox, getPreco }: any) {
  const images = extractImages(item);
  const fullImages = extractFullImages(item);
  const loc = extractEndereco(item);
  const codigo = item.codigo;
  const titulo = item.titulo_anuncio || item.empreendimento_nome || "";
  const tipoImovel = item.subtipo || item.tipo || "";
  const dorms = getNum(item, "dormitorios");
  const suites = getNum(item, "suites");
  const area = getNumIncZero(item, "area_privativa", "area_util", "area_total");
  const vagas = getNum(item, "garagens", "vagas");
  const entrega = extractEntrega(item);
  const imovelId = String(codigo || item.id_imovel || item.id || idx);

  return (
    <Card className={cn(
      "overflow-hidden group hover:shadow-xl transition-all duration-300 relative border-border/50",
      isCampanha && "ring-1 ring-primary/20",
      selectMode && isSelected && "ring-2 ring-primary"
    )}>
      {selectMode && (
        <button onClick={() => onToggleSelect(imovelId)} className="absolute top-3 left-3 z-20 bg-background/90 backdrop-blur-sm rounded-md p-1 shadow-sm">
          {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </button>
      )}

      {/* Image area */}
      <div className="aspect-[4/3] relative bg-muted">
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
          className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:scale-110"
        >
          <Heart className={cn("h-4 w-4", isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-lg font-bold text-primary leading-tight">{getPreco(item)}</p>
          {codigo && <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{codigo}</Badge>}
        </div>

        {titulo && <p className="text-sm font-semibold text-foreground leading-snug line-clamp-1">{titulo}</p>}

        {(loc.bairro || loc.endereco) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            <span className="truncate">{[loc.bairro, loc.cidade].filter(Boolean).join(" · ")}</span>
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/50">
          {dorms != null && dorms > 0 && (
            <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {dorms}{suites ? ` (${suites}s)` : ""}</span>
          )}
          {area != null && area > 0 && (
            <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {area}m²</span>
          )}
          {vagas != null && vagas > 0 && (
            <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {vagas}</span>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary"
            onClick={() => {
              const url = `https://uhomesales.com/imovel/${codigo || item.id_imovel || item.id}`;
              navigator.clipboard.writeText(url);
              toast.success("Link copiado!");
            }}
          >
            <Copy className="h-3 w-3" /> Copiar
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Confira este imóvel: ${titulo} - ${loc.bairro} - ${getPreco(item)}\nhttps://uhomesales.com/imovel/${codigo || item.id_imovel || item.id}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-green-600">
              <Phone className="h-3 w-3" /> WhatsApp
            </Button>
          </a>
          {codigo && <ResponsavelButton codigo={codigo} />}
        </div>
      </div>
    </Card>
  );
}

// ── List Card ──
function PropertyCardList({ item, idx, isCampanha, selectMode, isSelected, onToggleSelect, onFavorite, isFavorite, onOpenLightbox, getPreco }: any) {
  const images = extractImages(item);
  const fullImages = extractFullImages(item);
  const loc = extractEndereco(item);
  const codigo = item.codigo;
  const titulo = item.titulo_anuncio || item.empreendimento_nome || "";
  const dorms = getNum(item, "dormitorios");
  const suites = getNum(item, "suites");
  const banhos = getNum(item, "banheiros");
  const area = getNumIncZero(item, "area_privativa", "area_util", "area_total");
  const vagas = getNum(item, "garagens", "vagas");
  const cond = getNum(item, "valor_condominio");
  const entrega = extractEntrega(item);
  const imovelId = String(codigo || item.id_imovel || item.id || idx);

  return (
    <Card className={cn(
      "overflow-hidden hover:shadow-lg transition-all duration-200 relative",
      isCampanha && "ring-1 ring-primary/20",
      selectMode && isSelected && "ring-2 ring-primary"
    )}>
      {selectMode && (
        <button onClick={() => onToggleSelect(imovelId)} className="absolute top-2 left-2 z-20 bg-background/90 rounded-md p-0.5 shadow-sm">
          {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </button>
      )}
      <div className="flex">
        <div className="w-52 h-44 flex-shrink-0 bg-muted relative">
          <ImageSlider images={images} alt={titulo || loc.endereco} onClickImage={() => onOpenLightbox(fullImages.length > 0 ? fullImages : images, 0)} />
          {isCampanha && <Badge className="absolute top-2 left-2 text-[10px] bg-primary/90 text-primary-foreground"><Megaphone className="h-2.5 w-2.5 mr-0.5" /> Campanha</Badge>}
          {codigo && <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] font-mono bg-background/80 backdrop-blur-sm">{codigo}</Badge>}
        </div>
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {titulo && <p className="text-sm font-semibold text-foreground truncate">{titulo}</p>}
                {(loc.bairro || loc.endereco) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{[loc.endereco, loc.bairro, loc.cidade].filter(Boolean).join(" · ")}</span>
                  </p>
                )}
              </div>
              <button onClick={() => onFavorite(imovelId)} className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors">
                <Heart className={cn("h-4 w-4", isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {entrega.emObras && (
                <Badge className="text-[10px] h-5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 border">
                  <CalendarClock className="h-2.5 w-2.5 mr-0.5" /> {entrega.previsao || "Em obras"}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {dorms != null && dorms > 0 && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {dorms} dorm{suites ? ` (${suites}s)` : ""}</span>}
              {banhos != null && banhos > 0 && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {banhos}</span>}
              {area != null && area > 0 && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {area}m²</span>}
              {vagas != null && vagas > 0 && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {vagas} vaga{vagas > 1 ? "s" : ""}</span>}
            </div>
          </div>

          <div className="flex items-end justify-between mt-2">
            <div>
              <p className="text-lg font-bold text-primary">{getPreco(item)}</p>
              {cond != null && cond > 0 && <p className="text-[10px] text-muted-foreground">Cond. {fmtBRL(cond)}</p>}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(`https://uhomesales.com/imovel/${codigo || item.id}`); toast.success("Link copiado!"); }}>
                <Copy className="h-3 w-3" />
              </Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${titulo} - ${loc.bairro} - ${getPreco(item)}`)}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:text-green-600"><Phone className="h-3 w-3" /></Button>
              </a>
              {codigo && <ResponsavelButton codigo={codigo} />}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ──

export default function ImoveisPage() {
  const { user } = useAuth();
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [campanhaAtiva, setCampanhaAtiva] = useState(false);
  const [uhomeOnly, setUhomeOnly] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sortBy, setSortBy] = useState("relevancia");

  // Vitrine selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingVitrine, setCreatingVitrine] = useState(false);
  const [vitrineLink, setVitrineLink] = useState<string | null>(null);

  // Filters
  const [contrato, setContrato] = useState("venda");
  const [tipo, setTipo] = useState("");
  const [bairro, setBairro] = useState("");
  const [bairroOpen, setBairroOpen] = useState(false);
  const [bairroSearch, setBairroSearch] = useState("");
  const [dormitorios, setDormitorios] = useState("");
  const [valorRange, setValorRange] = useState<[number, number]>([0, 5_000_000]);
  const [somenteObras, setSomenteObras] = useState(false);

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

  const fetchImoveis = useCallback(async (pageNum: number, campanha = campanhaAtiva, uhome = uhomeOnly) => {
    setLoading(true);
    try {
      if (campanha) {
        const results = await Promise.all(
          CAMPANHA_CODES.map((c) => supabase.functions.invoke("jetimob-proxy", { body: { action: "get_imovel", codigo: c.codigo } }))
        );
        const items = results.map((r) => r.data?.data || r.data).filter((d) => d && !d.not_found);
        setImoveis(items);
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
            tipo: tipo && tipo !== "all" ? tipo : undefined,
            cidade: "Porto Alegre",
            bairro: bairro || undefined,
            search_uhome: uhome ? true : undefined,
            dormitorios: dormitorios && dormitorios !== "all" ? dormitorios : undefined,
            valor_min: valorMin, valor_max: valorMax,
            somente_obras: somenteObras || undefined,
          },
        });
        if (error) { toast.error("Erro ao buscar imóveis"); return; }
        const items = Array.isArray(data?.data) ? data.data : [];
        setImoveis(items);
        setTotal(data?.total || items.length);
        setTotalPages(data?.totalPages || Math.ceil((data?.total || items.length) / 24));
        setPage(pageNum);
      }
    } catch { toast.error("Erro de conexão"); } finally { setLoading(false); }
  }, [search, contrato, tipo, bairro, dormitorios, valorRange, somenteObras, campanhaAtiva, uhomeOnly]);

  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    fetchImoveis(1, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setCampanhaAtiva(false); setUhomeOnly(false); fetchImoveis(1, false, false); };

  const getPreco = (item: any): string => {
    const venda = getNum(item, "valor_venda", "preco_venda", "valor", "price");
    const locacao = getNum(item, "valor_locacao", "preco_locacao", "valor_aluguel");
    if (contrato === "locacao" && locacao) return fmtBRL(locacao);
    if (venda) return fmtBRL(venda);
    if (locacao) return fmtBRL(locacao);
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

  const activeFilterCount = [
    tipo && tipo !== "all",
    bairro,
    dormitorios && dormitorios !== "all",
    valorRange[0] > 0 || valorRange[1] < 5_000_000,
    somenteObras,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <PhotoLightbox images={lightboxImages} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />

      {/* Hero search bar */}
      <div className="bg-gradient-to-b from-primary/5 to-background border-b border-border/50 px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2.5">
                <Building2 className="h-6 w-6 text-primary" />
                Busca de Imóveis
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Encontre o imóvel ideal para seu cliente</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); }}
                variant={showFavoritesOnly ? "default" : "outline"} size="sm" className="gap-1.5"
              >
                <Heart className={cn("h-4 w-4", showFavoritesOnly && "fill-current")} />
                Favoritos {favorites.size > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{favorites.size}</Badge>}
              </Button>
              <Button
                onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); setVitrineLink(null); }}
                variant={selectMode ? "default" : "outline"} size="sm" className="gap-1.5"
              >
                <Share2 className="h-4 w-4" />
                {selectMode ? `${selectedIds.size} selecionados` : "Vitrine"}
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por bairro, empreendimento, código ou endereço..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 h-11 text-sm bg-background border-border/80 focus-visible:ring-primary/30"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="h-11 px-6 gap-2 font-semibold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {/* Quick filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={contrato} onValueChange={(v) => { setContrato(v); }}>
              <SelectTrigger className="w-[110px] h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="locacao">Locação</SelectItem>
                <SelectItem value="temporada">Temporada</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => { const next = !campanhaAtiva; setCampanhaAtiva(next); setUhomeOnly(false); fetchImoveis(1, next, false); }}
              variant={campanhaAtiva ? "default" : "outline"} size="sm" className="h-8 gap-1.5 text-xs"
            >
              <Megaphone className="h-3.5 w-3.5" /> Campanha Ativa
            </Button>
            <Button
              onClick={() => { const next = !uhomeOnly; setUhomeOnly(next); setCampanhaAtiva(false); fetchImoveis(1, false, next); }}
              variant={uhomeOnly ? "default" : "outline"} size="sm" className="h-8 gap-1.5 text-xs"
            >
              <Building2 className="h-3.5 w-3.5" /> uHome
            </Button>
            <Button
              variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros {activeFilterCount > 0 && <Badge variant="default" className="text-[10px] h-4 px-1">{activeFilterCount}</Badge>}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        {/* Vitrine action bar */}
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
                    const { data, error } = await supabase.from("vitrines").insert({ created_by: user.id, titulo: "Seleção de Imóveis", imovel_ids: [...selectedIds] as any }).select("id").single();
                    if (error) throw error;
                    const link = getVitrineShareUrl(data.id);
                    setVitrineLink(link); navigator.clipboard.writeText(link); toast.success("Vitrine criada! Link copiado.");
                  } catch { toast.error("Erro ao criar vitrine"); } finally { setCreatingVitrine(false); }
                }} className="gap-1.5">
                  {creatingVitrine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Gerar Link
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Filters panel */}
        {!campanhaAtiva && !uhomeOnly && filtersOpen && (
          <Card className="p-4 mb-4 space-y-4 border-border/50">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tipo</label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="apartamento">Apartamento</SelectItem>
                    <SelectItem value="casa">Casa</SelectItem>
                    <SelectItem value="cobertura">Cobertura</SelectItem>
                    <SelectItem value="terreno">Terreno</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="loft">Loft / Studio</SelectItem>
                    <SelectItem value="kitnet">Kitnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Bairro</label>
                <Popover open={bairroOpen} onOpenChange={setBairroOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9 text-sm">
                      {bairro || "Todos"}
                      <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar bairro..." value={bairroSearch} onValueChange={setBairroSearch} />
                      <CommandList>
                        <CommandEmpty>
                          {bairroSearch ? (
                            <button className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded" onClick={() => { setBairro(bairroSearch); setBairroOpen(false); setBairroSearch(""); }}>
                              Usar "<strong>{bairroSearch}</strong>"
                            </button>
                          ) : "Nenhum bairro encontrado"}
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="__todos__" onSelect={() => { setBairro(""); setBairroOpen(false); setBairroSearch(""); }}>
                            <Check className={cn("mr-2 h-3 w-3", !bairro ? "opacity-100" : "opacity-0")} /> Todos
                          </CommandItem>
                          {filteredBairros.map((b) => (
                            <CommandItem key={b} value={b} onSelect={() => { setBairro(b); setBairroOpen(false); setBairroSearch(""); }}>
                              <Check className={cn("mr-2 h-3 w-3", bairro === b ? "opacity-100" : "opacity-0")} /> {b}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Dormitórios</label>
                <Select value={dormitorios} onValueChange={setDormitorios}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Valor: {fmtCompact(valorRange[0])} — {valorRange[1] >= 5_000_000 ? "5M+" : fmtCompact(valorRange[1])}
                </label>
                <Slider
                  min={0} max={5_000_000} step={50_000}
                  value={valorRange}
                  onValueChange={(v) => setValorRange(v as [number, number])}
                  className="mt-3"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={somenteObras} onChange={(e) => setSomenteObras(e.target.checked)} className="rounded border-border" />
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Em obras / na planta</span>
              </label>
              <Button onClick={handleSearch} size="sm" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Aplicar Filtros
              </Button>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => {
                  setTipo(""); setBairro(""); setDormitorios(""); setValorRange([0, 5_000_000]); setSomenteObras(false);
                }}>
                  <X className="h-3 w-3 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Results toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {total > 0 && <span className="text-sm font-medium text-foreground">{total.toLocaleString()} imóveis</span>}
            {showFavoritesOnly && <Badge variant="outline" className="text-xs gap-1"><Heart className="h-3 w-3 fill-red-500 text-red-500" /> Favoritos</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="relevancia">Relevância</SelectItem>
                <SelectItem value="menor_preco">Menor preço</SelectItem>
                <SelectItem value="maior_preco">Maior preço</SelectItem>
                <SelectItem value="maior_area">Maior área</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border border-border rounded-md overflow-hidden">
              <button onClick={() => setViewMode("grid")} className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1")}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                {viewMode === "grid" ? (
                  <div><Skeleton className="aspect-[4/3] rounded-none" /><div className="p-4 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div></div>
                ) : (
                  <div className="flex"><Skeleton className="w-52 h-44 rounded-none" /><div className="flex-1 p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-5 w-1/3 mt-4" /></div></div>
                )}
              </Card>
            ))}
          </div>
        ) : sortedImoveis.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-14 w-14 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum imóvel encontrado</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Tente ajustar seus filtros de busca</p>
          </Card>
        ) : (
          <>
            <div className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1")}>
              {sortedImoveis.map((item, idx) => {
                const isCampanha = CAMPANHA_CODES.some((c) => c.codigo === item.codigo);
                const imovelId = String(item.codigo || item.id_imovel || item.id || idx);
                const CardComponent = viewMode === "grid" ? PropertyCardGrid : PropertyCardList;
                return (
                  <CardComponent
                    key={item.id_imovel || item.codigo || idx}
                    item={item} idx={idx}
                    isCampanha={isCampanha}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(imovelId)}
                    onToggleSelect={toggleSelect}
                    onFavorite={toggleFavorite}
                    isFavorite={favorites.has(imovelId)}
                    onOpenLightbox={openLightbox}
                    getPreco={getPreco}
                  />
                );
              })}
            </div>

            {totalPages > 1 && !campanhaAtiva && (
              <div className="flex items-center justify-center gap-3 pt-6 pb-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => fetchImoveis(page - 1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground font-medium">{page} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => fetchImoveis(page + 1)} className="gap-1">
                  Próxima <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
