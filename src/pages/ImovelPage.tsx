/**
 * Public shareable property page — /imovel/:codigo
 * Fetches property from jetimob-proxy and renders a standalone premium view
 * reusing the same layout patterns as PropertyPreviewDrawer.
 */

import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Copy, Phone, MapPin, CalendarClock, Share2, Building2,
  Loader2, UserCircle, Mail, BedDouble, Bath, Car,
  ChevronLeft, ChevronRight, RulerIcon, DoorOpen,
  MessageCircle, ArrowLeft, Link2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getPropertyPreviewImages, getPropertyThumbImages,
  extractOrigemExterna, extractEntrega, extractEndereco,
  getNum, getNumIncZero, fmtBRL, fmtCompact,
} from "@/lib/imovelHelpers";
import PhotoLightbox from "@/components/imoveis/PhotoLightbox";
import { track } from "@/lib/tracker";

/* eslint-disable @typescript-eslint/no-explicit-any */

function getPrecoFromItem(item: any): string {
  const v = item.valor_venda || item.valor || item.preco || item.valor_locacao;
  if (v && !isNaN(Number(v)) && Number(v) > 0) return fmtBRL(Number(v));
  return "Sob consulta";
}

export default function ImovelPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageIdx, setImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const trackedRef = useRef(false);

  // Track property view
  useEffect(() => {
    if (item && !trackedRef.current) {
      trackedRef.current = true;
      track.visitouImovel({
        id: item.id,
        slug: item.slug,
        titulo: item.titulo_anuncio || item.empreendimento_nome,
        bairro: extractEndereco(item).bairro,
        preco: item.valor_venda || item.valor || item.preco,
        codigo: codigo,
        jetimob_id: item.jetimob_id ?? codigo,
      });
    }
  }, [item]);

  useEffect(() => {
    if (!codigo) return;
    setLoading(true);
    setError(false);
    supabase.functions
      .invoke("jetimob-proxy", { body: { action: "get_imovel", codigo } })
      .then(({ data }) => {
        // jetimob-proxy returns { imovel: {...}, not_found: bool }
        const imovel = data?.imovel ?? data?.data?.imovel ?? null;
        if (!imovel || data?.not_found) {
          setError(true);
        } else {
          setItem(imovel);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [codigo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Building2 className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-lg font-semibold text-foreground">Imóvel não encontrado</p>
        <p className="text-sm text-muted-foreground">O código "{codigo}" não retornou resultados.</p>
        <Link to="/imoveis">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao buscador
          </Button>
        </Link>
      </div>
    );
  }

  const heroImages = getPropertyPreviewImages(item);
  const thumbStrip = getPropertyThumbImages(item);
  const displayThumbs = thumbStrip.length > 0 ? thumbStrip : heroImages;

  const loc = extractEndereco(item);
  const titulo = item.titulo_anuncio || item.empreendimento_nome || "";
  const preco = getPrecoFromItem(item);
  const dorms = getNum(item, "dormitorios");
  const suitesVal = getNum(item, "suites");
  const banhos = getNum(item, "banheiros");
  const area = getNumIncZero(item, "area_privativa", "area_util", "area_total");
  const vagasVal = getNum(item, "garagens", "vagas");
  const cond = getNum(item, "valor_condominio");
  const entrega = extractEntrega(item);
  const origem = extractOrigemExterna(item);
  const descricao = item.descricao || item.descricao_interna || "";
  const tipo = item.tipo || item.subtipo || "";

  const prevImage = () => setImageIdx(i => (i > 0 ? i - 1 : heroImages.length - 1));
  const nextImage = () => setImageIdx(i => (i < heroImages.length - 1 ? i + 1 : 0));

  const PUBLIC_DOMAIN = "https://uhomesales.com";
  const shareUrl = `${PUBLIC_DOMAIN}/imovel/${codigo}`;
  const whatsappText = encodeURIComponent(
    [titulo, loc.bairro, preco, shareUrl].filter(Boolean).join(" - ")
  );

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado!");
  };

  const copyData = () => {
    const text = [
      titulo, preco,
      [loc.endereco, loc.bairro, loc.cidade].filter(Boolean).join(" · "),
      dorms ? `${dorms} dorm${suitesVal ? ` · ${suitesVal} suítes` : ""}` : "",
      area ? `${area} m²` : "",
      vagasVal ? `${vagasVal} vaga${vagasVal > 1 ? "s" : ""}` : "",
      codigo ? `Cód. ${codigo}` : "",
      shareUrl,
    ].filter(Boolean).join(" · ");
    navigator.clipboard.writeText(text);
    toast.success("Dados copiados!");
  };

  const specs = [
    dorms != null && dorms > 0 ? { icon: BedDouble, value: String(dorms), label: dorms === 1 ? "Dorm" : "Dorms" } : null,
    suitesVal != null && suitesVal > 0 ? { icon: DoorOpen, value: String(suitesVal), label: suitesVal === 1 ? "Suíte" : "Suítes" } : null,
    banhos != null && banhos > 0 ? { icon: Bath, value: String(banhos), label: banhos === 1 ? "Banho" : "Banhos" } : null,
    area != null && area > 0 ? { icon: RulerIcon, value: `${area}`, label: "m²" } : null,
    vagasVal != null && vagasVal > 0 ? { icon: Car, value: String(vagasVal), label: vagasVal === 1 ? "Vaga" : "Vagas" } : null,
  ].filter(Boolean) as { icon: any; value: string; label: string }[];

  return (
    <div className="min-h-screen bg-background">
      <PhotoLightbox images={heroImages} initialIndex={imageIdx} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/40">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-2.5">
          <Link to="/imoveis" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Buscador
          </Link>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={copyLink} className="gap-1.5 text-xs h-8">
              <Link2 className="h-3.5 w-3.5" /> Copiar link
            </Button>
            <a href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-3xl mx-auto">
        {/* ── Hero Gallery ── */}
        <div
          className="relative bg-muted/60 aspect-[16/9] md:aspect-[2/1] group cursor-pointer"
          onClick={() => heroImages.length > 0 && setLightboxOpen(true)}
        >
          {heroImages.length > 0 ? (
            <>
              <img
                src={heroImages[imageIdx] || ""}
                alt={titulo}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              {heroImages.length > 1 && (
                <>
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md rounded-full px-3 py-1 text-[11px] font-semibold text-white tabular-nums">
                    {imageIdx + 1} / {heroImages.length}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full p-2.5 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <ChevronLeft className="h-5 w-5 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full p-2.5 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <ChevronRight className="h-5 w-5 text-white" />
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
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="h-16 w-16 text-muted-foreground/20" />
            </div>
          )}
        </div>

        {/* ── Thumbnail strip ── */}
        {heroImages.length > 1 && (
          <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto bg-muted/30 scrollbar-none">
            {displayThumbs.slice(0, 10).map((img, i) => (
              <button
                key={i}
                onClick={() => setImageIdx(i)}
                className={cn(
                  "shrink-0 w-16 h-11 rounded-md overflow-hidden border-2 transition-all",
                  i === imageIdx
                    ? "border-primary ring-1 ring-primary/30 scale-105"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        <div className="px-5 pt-6 pb-10 space-y-6">
          {/* Title */}
          <div>
            {tipo && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">{tipo}</p>
            )}
            <h1 className="text-2xl font-bold text-foreground leading-tight">{titulo || "Imóvel"}</h1>
            {(loc.bairro || loc.endereco || loc.cidade) && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{[loc.endereco, loc.bairro, loc.cidade].filter(Boolean).join(" · ")}</span>
              </div>
            )}
            {codigo && (
              <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Cód. {codigo}</p>
            )}
          </div>

          {/* Price */}
          <div className="rounded-xl bg-primary/5 border border-primary/15 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/70 mb-1">Valor</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">{preco}</p>
            {cond != null && cond > 0 && (
              <p className="text-sm text-muted-foreground mt-1">Condomínio: <span className="font-semibold text-foreground/70">{fmtBRL(cond)}</span></p>
            )}
          </div>

          {/* Specs */}
          {specs.length > 0 && (
            <div className={cn(
              "grid gap-2",
              specs.length <= 3 ? "grid-cols-3" : specs.length === 4 ? "grid-cols-4" : "grid-cols-5"
            )}>
              {specs.map((s, i) => (
                <div key={i} className="flex flex-col items-center py-4 rounded-lg bg-muted/50 border border-border/50">
                  <s.icon className="h-5 w-5 text-primary mb-2" />
                  <span className="text-lg font-bold text-foreground leading-none">{s.value}</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* WhatsApp CTA */}
          <a href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full h-12 text-sm font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 rounded-xl">
              <MessageCircle className="h-5 w-5" /> Enviar por WhatsApp
            </Button>
          </a>

          {/* Share + Copy */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="h-10 gap-2 rounded-lg text-xs font-semibold">
              <Link2 className="h-4 w-4" /> Copiar link
            </Button>
            <Button variant="outline" size="sm" onClick={copyData} className="h-10 gap-2 rounded-lg text-xs font-semibold">
              <Copy className="h-4 w-4" /> Copiar dados
            </Button>
          </div>

          {/* Consultant */}
          {origem && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCircle className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground">Responsável / Origem</p>
              </div>
              <div className="space-y-1.5">
                {origem.sistema && <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{origem.sistema}</span></p>}
                {origem.responsavel && <p className="text-sm font-semibold text-foreground">{origem.responsavel}</p>}
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
            </div>
          )}

          {/* Description */}
          {descricao && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Descrição</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{descricao}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
