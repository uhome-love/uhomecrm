/**
 * New /imoveis page — unified search engine mirroring uhome.com.br,
 * adapted for CRM dark theme with broker-specific actions.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState, EmptyState } from "@/components/ui/screen-states";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Search, LayoutGrid, List, Map, Heart, Share2, Link2, Copy,
  Loader2, ChevronLeft, ChevronRight, X, MapPin, Sparkles,
  RotateCcw, MessageCircle, Phone, Zap,
} from "lucide-react";
import { FilterPill, PillOption } from "@/components/imoveis/SiteFilterPill";
import { SitePropertyCard } from "@/components/imoveis/SitePropertyCard";
import { SearchMapBox } from "@/components/imoveis/SearchMapBox";
import PropertyPreviewDrawer from "@/components/imoveis/PropertyPreviewDrawer";
import {
  fetchSiteImoveis, fetchMapPins, fetchBairros,
  type SiteImovel, type MapPin as MapPinType, type BuscaFilters,
  formatPreco, CIDADES_PERMITIDAS, PROPERTY_TYPES,
} from "@/services/siteImoveis";
import {
  useImoveisSearchStore, filtersFromParams, filtersToParams,
} from "@/stores/imoveisSearchStore";
import { useAuth } from "@/hooks/useAuth";
import { getVitrinePublicUrl } from "@/lib/vitrineUrl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 24;

const precoRanges = [
  { label: "Até R$ 300k", min: 0, max: 300000 },
  { label: "R$ 300k – 600k", min: 300000, max: 600000 },
  { label: "R$ 600k – 1M", min: 600000, max: 1000000 },
  { label: "R$ 1M – 2M", min: 1000000, max: 2000000 },
  { label: "R$ 2M – 5M", min: 2000000, max: 5000000 },
  { label: "Acima de R$ 5M", min: 5000000, max: 0 },
];

const quartoOptions = [1, 2, 3, 4];

function fmtPrecoLabel(min: number, max: number): string {
  const fmt = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1)}M` : `${(v / 1000).toFixed(0)}k`;
  if (min && max) return `R$ ${fmt(min)} – ${fmt(max)}`;
  if (min) return `A partir de R$ ${fmt(min)}`;
  if (max) return `Até R$ ${fmt(max)}`;
  return "";
}

export default function ImoveisPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilter, setFilters, resetFilters } = useImoveisSearchStore();

  // Sync URL → store on mount
  useEffect(() => {
    const fromUrl = filtersFromParams(searchParams);
    if (Object.keys(fromUrl).length > 0) setFilters(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync store → URL on filter change
  const debouncedFilters = useDebounce(filters, 400);
  useEffect(() => {
    const params = filtersToParams(debouncedFilters);
    setSearchParams(params, { replace: true });
  }, [debouncedFilters, setSearchParams]);

  // ── View state ──
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [page, setPage] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Vitrine
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingVitrine, setCreatingVitrine] = useState(false);
  const [vitrineLink, setVitrineLink] = useState<string | null>(null);

  // Bairro search
  const [bairroInput, setBairroInput] = useState("");
  const [showBairroDropdown, setShowBairroDropdown] = useState(false);
  const bairroInputRef = useRef<HTMLInputElement>(null);

  // Preview drawer
  const [previewItem, setPreviewItem] = useState<SiteImovel | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Load favorites
  useEffect(() => {
    const saved = localStorage.getItem(`uhome-site-favorites-${user?.id}`);
    if (saved) setFavorites(new Set(JSON.parse(saved)));
  }, [user?.id]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(`uhome-site-favorites-${user?.id}`, JSON.stringify([...next]));
      return next;
    });
  }, [user?.id]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setVitrineLink(null);
  }, []);

  // ── Bairros ──
  const { data: bairros = [] } = useQuery({
    queryKey: ["site-bairros"],
    queryFn: fetchBairros,
    staleTime: 5 * 60 * 1000,
  });

  const bairrosSelecionados = useMemo(() => {
    return filters.bairro ? filters.bairro.split(",").map(s => s.trim()).filter(Boolean) : [];
  }, [filters.bairro]);

  const bairroSuggestions = useMemo(() => {
    const all = bairros.map(b => b.bairro);
    const filtered = all.filter(b => !bairrosSelecionados.includes(b));
    if (!bairroInput.trim()) return filtered.slice(0, 8);
    const q = bairroInput.toLowerCase();
    return filtered.filter(b => b.toLowerCase().includes(q)).slice(0, 10);
  }, [bairroInput, bairrosSelecionados, bairros]);

  const addBairro = useCallback((nome: string) => {
    const next = [...bairrosSelecionados, nome];
    setFilter("bairro", next.join(","));
    setBairroInput("");
    setPage(0);
  }, [bairrosSelecionados, setFilter]);

  const removeBairro = useCallback((nome: string) => {
    const next = bairrosSelecionados.filter(b => b !== nome);
    setFilter("bairro", next.join(","));
    setPage(0);
  }, [bairrosSelecionados, setFilter]);

  // ── Query filters ──
  const queryFilters = useMemo((): BuscaFilters => ({
    tipo: filters.tipo || undefined,
    bairros: bairrosSelecionados.length > 0 ? bairrosSelecionados : undefined,
    cidade: filters.cidade || undefined,
    precoMin: filters.precoMin || undefined,
    precoMax: filters.precoMax || undefined,
    areaMin: filters.areaMin || undefined,
    areaMax: filters.areaMax || undefined,
    quartos: filters.quartos || undefined,
    banheiros: filters.banheiros || undefined,
    vagas: filters.vagas || undefined,
    q: filters.q || undefined,
    ordem: filters.ordem,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    bounds: filters.bounds,
  }), [filters, bairrosSelecionados, page]);

  const debouncedQueryFilters = useDebounce(queryFilters, 300);

  // ── Data query ──
  const { data: result, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ["site-imoveis", debouncedQueryFilters],
    queryFn: () => fetchSiteImoveis(debouncedQueryFilters),
    staleTime: 3 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const imoveis = result?.data ?? [];
  const total = result?.count ?? 0;
  const searchTimeMs = result?.search_time_ms;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Map pins ──
  const mapPinFilters = useMemo((): BuscaFilters => ({
    tipo: filters.tipo || undefined,
    bairros: bairrosSelecionados.length > 0 ? bairrosSelecionados : undefined,
    cidade: filters.cidade || undefined,
    precoMin: filters.precoMin || undefined,
    precoMax: filters.precoMax || undefined,
    quartos: filters.quartos || undefined,
    bounds: filters.bounds,
  }), [filters, bairrosSelecionados]);

  const { data: mapPins = [] } = useQuery({
    queryKey: ["site-map-pins", mapPinFilters],
    queryFn: () => fetchMapPins(mapPinFilters),
    enabled: viewMode === "map",
    staleTime: 2 * 60 * 1000,
  });

  // ── Active filters count ──
  const hasActiveFilters = !!(
    filters.tipo || filters.bairro || filters.precoMin || filters.precoMax ||
    filters.areaMin || filters.areaMax || filters.quartos || filters.vagas ||
    filters.q || (filters.cidade && filters.cidade !== "Porto Alegre")
  );

  // ── Preview drawer ──
  const openPreview = useCallback((item: SiteImovel) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  }, []);

  const previewGetPreco = useCallback((item: any) => formatPreco(item.preco), []);

  // ── Vitrine creation ──
  const createVitrine = useCallback(async () => {
    if (!user) return;
    setCreatingVitrine(true);
    try {
      const { data, error } = await supabase.from("vitrines").insert({
        created_by: user.id,
        titulo: "Seleção de Imóveis",
        tipo: "property_selection",
        imovel_ids: [...selectedIds] as any,
      }).select("id").single();
      if (error) throw error;
      const link = getVitrinePublicUrl(data.id);
      setVitrineLink(link);
      navigator.clipboard.writeText(link);
      toast.success("Vitrine criada! Link copiado.");
    } catch {
      toast.error("Erro ao criar vitrine");
    } finally {
      setCreatingVitrine(false);
    }
  }, [user, selectedIds]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filters.tipo, filters.bairro, filters.cidade, filters.precoMin, filters.precoMax, filters.quartos, filters.vagas, filters.ordem, filters.q]);

  // ── Helpers ──
  const precoLabel = precoRanges.find(r => r.min === filters.precoMin && r.max === filters.precoMax)?.label;
  const cidadeLabel = filters.cidade || "Todas";
  const tipoLabel = PROPERTY_TYPES.find(t => t.value === filters.tipo)?.label;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Preview drawer — reuse existing */}
      {previewItem && (
        <PropertyPreviewDrawer
          item={previewItem}
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          isFavorite={favorites.has(previewItem.id)}
          onFavorite={toggleFavorite}
          getPreco={previewGetPreco}
          selectMode={selectMode}
          isSelected={selectedIds.has(previewItem.id)}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* ── Sticky filter bar ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-2 overflow-x-auto px-5 py-3 scrollbar-hide">
          {/* Search input with bairro chips */}
          <div className="relative shrink-0">
            <div
              className="flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 transition-colors focus-within:border-primary"
              style={{ minWidth: 240, maxWidth: 420 }}
              onClick={() => { setShowBairroDropdown(true); bairroInputRef.current?.focus(); }}
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              {bairrosSelecionados.map(b => (
                <span key={b} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[12px] font-medium text-primary">
                  {b}
                  <X className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeBairro(b); }} />
                </span>
              ))}
              <input
                ref={bairroInputRef}
                type="text"
                value={bairroInput}
                onChange={(e) => { setBairroInput(e.target.value); setShowBairroDropdown(true); }}
                onFocus={() => setShowBairroDropdown(true)}
                onBlur={() => setTimeout(() => setShowBairroDropdown(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !bairroInput && bairrosSelecionados.length > 0) removeBairro(bairrosSelecionados[bairrosSelecionados.length - 1]);
                  if (e.key === "Enter" && bairroInput && bairroSuggestions.length > 0) { e.preventDefault(); addBairro(bairroSuggestions[0]); }
                  if (e.key === "Escape") { setShowBairroDropdown(false); bairroInputRef.current?.blur(); }
                }}
                placeholder={bairrosSelecionados.length > 0 ? "Adicionar bairro..." : "Bairro, cidade ou código..."}
                className="min-w-[100px] flex-1 border-none bg-transparent py-1 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            {showBairroDropdown && bairroSuggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-2 z-50 max-h-64 w-80 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bairros</p>
                {bairroSuggestions.map(b => (
                  <button
                    key={b}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addBairro(b)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/50"
                  >
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cidade */}
          <FilterPill label="Cidade" value={cidadeLabel} active={filters.cidade !== "Porto Alegre"} onClear={() => { setFilter("cidade", "Porto Alegre"); setPage(0); }}>
            <PillOption selected={!filters.cidade} onClick={() => setFilter("cidade", "")}>Todas</PillOption>
            {CIDADES_PERMITIDAS.map(c => (
              <PillOption key={c} selected={filters.cidade === c} onClick={() => { setFilter("cidade", filters.cidade === c ? "" : c); setPage(0); }}>{c}</PillOption>
            ))}
          </FilterPill>

          {/* Tipo */}
          <FilterPill label="Tipo" value={tipoLabel} active={!!filters.tipo} onClear={() => { setFilter("tipo", ""); setPage(0); }}>
            {PROPERTY_TYPES.map(t => (
              <PillOption key={t.value} selected={filters.tipo === t.value} onClick={() => { setFilter("tipo", filters.tipo === t.value ? "" : t.value); setPage(0); }}>{t.label}</PillOption>
            ))}
          </FilterPill>

          {/* Preço */}
          <FilterPill
            label="Preço"
            value={precoLabel || (filters.precoMin || filters.precoMax ? fmtPrecoLabel(filters.precoMin, filters.precoMax) : undefined)}
            active={!!(filters.precoMin || filters.precoMax)}
            onClear={() => { setFilter("precoMin", 0); setFilter("precoMax", 0); setPage(0); }}
          >
            {precoRanges.map(r => (
              <PillOption
                key={r.label}
                selected={filters.precoMin === r.min && filters.precoMax === r.max}
                onClick={() => {
                  const isSel = filters.precoMin === r.min && filters.precoMax === r.max;
                  setFilter("precoMin", isSel ? 0 : r.min);
                  setFilter("precoMax", isSel ? 0 : r.max);
                  setPage(0);
                }}
              >{r.label}</PillOption>
            ))}
            <div className="mt-2 border-t border-border pt-3 px-1">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor personalizado</p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">R$</span>
                  <input type="number" placeholder="Mín" value={filters.precoMin || ""} onChange={(e) => setFilter("precoMin", Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-[13px] text-foreground outline-none transition-colors focus:border-primary" />
                </div>
                <span className="text-xs text-muted-foreground">–</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">R$</span>
                  <input type="number" placeholder="Máx" value={filters.precoMax || ""} onChange={(e) => setFilter("precoMax", Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-[13px] text-foreground outline-none transition-colors focus:border-primary" />
                </div>
              </div>
            </div>
          </FilterPill>

          {/* Quartos */}
          <FilterPill label="Quartos" value={filters.quartos ? `${filters.quartos}+ quartos` : undefined} active={!!filters.quartos} onClear={() => { setFilter("quartos", 0); setPage(0); }}>
            {quartoOptions.map(q => (
              <PillOption key={q} selected={filters.quartos === q} onClick={() => { setFilter("quartos", filters.quartos === q ? 0 : q); setPage(0); }}>{q}+ quartos</PillOption>
            ))}
          </FilterPill>

          {/* Vagas */}
          <FilterPill label="Vagas" value={filters.vagas ? `${filters.vagas}+ vagas` : undefined} active={!!filters.vagas} onClear={() => { setFilter("vagas", 0); setPage(0); }}>
            {[1, 2, 3].map(v => (
              <PillOption key={v} selected={filters.vagas === v} onClick={() => { setFilter("vagas", filters.vagas === v ? 0 : v); setPage(0); }}>{v}+ vagas</PillOption>
            ))}
          </FilterPill>

          {/* Ordenação */}
          <FilterPill label="Ordenar" value={
            filters.ordem === "preco_asc" ? "Menor preço" :
            filters.ordem === "preco_desc" ? "Maior preço" :
            filters.ordem === "area_desc" ? "Maior área" : "Mais recentes"
          }>
            <PillOption selected={filters.ordem === "recentes"} onClick={() => setFilter("ordem", "recentes")}>Mais recentes</PillOption>
            <PillOption selected={filters.ordem === "preco_asc"} onClick={() => setFilter("ordem", "preco_asc")}>Menor preço</PillOption>
            <PillOption selected={filters.ordem === "preco_desc"} onClick={() => setFilter("ordem", "preco_desc")}>Maior preço</PillOption>
            <PillOption selected={filters.ordem === "area_desc"} onClick={() => setFilter("ordem", "area_desc")}>Maior área</PillOption>
          </FilterPill>

          {/* Divider + actions */}
          <div className="border-l border-border/50 pl-2 ml-1 flex items-center gap-1.5 shrink-0">
            {hasActiveFilters && (
              <button onClick={() => { resetFilters(); setPage(0); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:text-foreground transition-all">
                <RotateCcw className="h-3 w-3" /> Limpar
              </button>
            )}
            <Button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); setVitrineLink(null); }} variant={selectMode ? "default" : "ghost"} size="sm" className="gap-1.5 h-9 rounded-full">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">{selectMode ? `${selectedIds.size} selecionados` : "Vitrine"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Results header ── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          {isLoading ? <Skeleton className="h-4 w-32" /> : (
            <span className="text-sm font-medium text-foreground">
              {total.toLocaleString()} imóveis
              {searchTimeMs != null && <span className="text-muted-foreground font-normal ml-1.5">· {searchTimeMs}ms</span>}
            </span>
          )}
        </div>
        <div className="flex border border-border/60 rounded-lg overflow-hidden">
          <button onClick={() => setViewMode("grid")} className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setViewMode("list")} className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}><List className="h-4 w-4" /></button>
          <button onClick={() => setViewMode("map")} className={cn("p-1.5 transition-colors", viewMode === "map" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}><Map className="h-4 w-4" /></button>
        </div>
      </div>

      {/* ── Vitrine bar ── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="px-5 py-2.5">
          <Card className="p-3 flex items-center justify-between bg-primary/5 border-primary/20 flex-wrap gap-2">
            <span className="text-sm font-medium">{selectedIds.size} imóvel(is) selecionado(s)</span>
            <div className="flex items-center gap-2">
              {vitrineLink ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input value={vitrineLink} readOnly className="text-xs h-8 w-64" />
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(vitrineLink); toast.success("Link copiado!"); }}><Copy className="h-3.5 w-3.5" /></Button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Confira esta seleção de imóveis: ${vitrineLink}`)}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"><Phone className="h-3.5 w-3.5" /> WhatsApp</Button>
                  </a>
                </div>
              ) : (
                <Button size="sm" disabled={creatingVitrine} onClick={createVitrine} className="gap-1.5">
                  {creatingVitrine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Gerar Vitrine
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Main content ── */}
      {viewMode === "map" ? (
        <div className="flex-1 flex overflow-hidden w-full">
          {/* Sidebar list */}
          <div className="w-[420px] xl:w-[480px] shrink-0 h-[calc(100vh-130px)] overflow-y-auto px-4 py-3 space-y-3 border-r border-border/50">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden border-border/40">
                    <div className="flex"><Skeleton className="w-32 h-28 rounded-none shrink-0" /><div className="flex-1 p-2.5 space-y-1.5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div></div>
                  </Card>
                ))}
              </div>
            ) : imoveis.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-sm font-medium text-foreground">Nenhum imóvel</p>
              </div>
            ) : (
              <div className="space-y-2">
                {imoveis.map((item, idx) => (
                  <Card key={item.id} className="overflow-hidden border-border/40 cursor-pointer hover:shadow-lg transition-all" onClick={() => openPreview(item)}>
                    <div className="flex">
                      <div className="w-32 h-28 shrink-0 bg-muted relative overflow-hidden">
                        <img src={item.foto_principal || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=300&h=200&fit=crop"} alt={item.bairro} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="flex-1 p-2.5 min-w-0">
                        <p className="text-sm font-bold text-foreground">{formatPreco(item.preco)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {(item.quartos ?? 0) > 0 && <span><strong className="text-foreground">{item.quartos}</strong> quarto{item.quartos! > 1 ? "s" : ""}</span>}
                          {(item.area_total ?? 0) > 0 && <span><strong className="text-foreground">{item.area_total}</strong> m²</span>}
                          {(item.vagas ?? 0) > 0 && <span><strong className="text-foreground">{item.vagas}</strong> vaga{item.vagas! > 1 ? "s" : ""}</span>}
                        </div>
                        <p className="text-xs text-foreground/80 font-medium truncate mt-1">{item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}</p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" /> {item.bairro} · {item.cidade}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
          {/* Map */}
          <div className="flex-1 h-[calc(100vh-130px)]">
            <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Erro ao carregar mapa</div>}>
              <SearchMapBox
                pins={mapPins}
                onBoundsSearch={(bounds) => { setFilter("bounds", bounds); setPage(0); }}
                onBoundsChange={() => {}}
                onPinClick={(pin) => {
                  const found = imoveis.find(i => i.id === pin.id);
                  if (found) openPreview(found);
                }}
              />
            </ErrorBoundary>
          </div>
        </div>
      ) : (
        /* ═══ GRID / LIST VIEW ═══ */
        <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 md:px-6 py-4">
          {isError ? (
            <ErrorState
              title="Erro ao carregar imóveis"
              description={fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
              action={{ label: "Tentar novamente", onClick: () => {} }}
            />
          ) : isLoading ? (
            <div className={cn("grid gap-4", viewMode === "list" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden border-border/40">
                  <Skeleton className="aspect-[4/3] rounded-none" />
                  <div className="p-3 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-1/3" /></div>
                </Card>
              ))}
            </div>
          ) : imoveis.length === 0 ? (
            <EmptyState
              title="Nenhum imóvel encontrado"
              description="Tente ajustar seus filtros ou termo de busca."
              icon={<Search className="h-10 w-10 text-muted-foreground/30" />}
              action={hasActiveFilters ? { label: "Limpar filtros", onClick: () => { resetFilters(); setPage(0); } } : undefined}
            />
          ) : (
            <>
              <div className={cn("grid gap-5", viewMode === "list" ? "grid-cols-1 max-w-3xl" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
                {imoveis.map((item, idx) => (
                  <SitePropertyCard
                    key={item.id}
                    imovel={item}
                    index={idx}
                    isFavorite={favorites.has(item.id)}
                    onToggleFavorite={toggleFavorite}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={toggleSelect}
                    onPreview={openPreview}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-6 pb-2">
                  <Button variant="outline" size="sm" disabled={page <= 0 || isLoading} onClick={() => setPage(p => p - 1)} className="gap-1 rounded-full">
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground font-medium tabular-nums">{page + 1} de {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1 || isLoading} onClick={() => setPage(p => p + 1)} className="gap-1 rounded-full">
                    Próxima <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Mobile vitrine bar ── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 md:hidden safe-bottom">
          <div className="bg-background/95 backdrop-blur-md border-t border-border/60 px-4 py-3 flex items-center gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{selectedIds.size} imóve{selectedIds.size === 1 ? "l" : "is"}</p>
            </div>
            {vitrineLink ? (
              <>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(vitrineLink); toast.success("Link copiado!"); }} className="h-9 px-3 gap-1.5 rounded-lg text-xs font-semibold shrink-0">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <a href={`https://wa.me/?text=${encodeURIComponent(`Confira esta seleção: ${vitrineLink}`)}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="h-9 px-3 gap-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </a>
              </>
            ) : (
              <Button size="sm" disabled={creatingVitrine} onClick={createVitrine} className="h-9 px-4 gap-1.5 rounded-lg text-xs font-bold shrink-0">
                {creatingVitrine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Gerar Vitrine
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
