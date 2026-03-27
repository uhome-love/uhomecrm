/**
 * /imoveis page — unified search engine mirroring uhome.com.br,
 * adapted for CRM dark theme with broker-specific actions.
 * Layout: cards on the left + map always visible on the right (desktop).
 * Mobile: list fullscreen + "Ver mapa" button opens fullscreen overlay.
 * Infinite scroll (load more) instead of pagination per doc spec.
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
import {
  Search, Heart, Share2, Link2, Copy,
  Loader2, X, MapPin, RotateCcw, MessageCircle, Phone,
  ArrowUpDown, Map as MapIcon, List, Bell, Sparkles, Send, SlidersHorizontal,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { FilterPill, PillOption } from "@/components/imoveis/SiteFilterPill";
import { SitePropertyCard } from "@/components/imoveis/SitePropertyCard";
import { SearchMapBox } from "@/components/imoveis/SearchMapBox";
import PropertyPreviewDrawer from "@/components/imoveis/PropertyPreviewDrawer";
import { SearchAlertModal } from "@/components/imoveis/SearchAlertModal";
import {
  fetchSiteImoveis, fetchMapPins, fetchBairros, fetchImovelBySlug, siteImovelToMapPin,
  type SiteImovel, type MapPin as MapPinType, type BuscaFilters,
  formatPreco, CIDADES_PERMITIDAS, PROPERTY_TYPES,
} from "@/services/siteImoveis";
import {
  useImoveisSearchStore, filtersFromParams, filtersToParams, type MapBounds,
} from "@/stores/imoveisSearchStore";
import { useAuth } from "@/hooks/useAuth";
import { useAISearch } from "@/hooks/useAISearch";
import { getVitrinePublicUrl } from "@/lib/vitrineUrl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";

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

const areaRanges = [
  { label: "Até 50m²", min: 0, max: 50 },
  { label: "50 – 100m²", min: 50, max: 100 },
  { label: "100 – 200m²", min: 100, max: 200 },
  { label: "200 – 400m²", min: 200, max: 400 },
  { label: "Acima de 400m²", min: 400, max: 0 },
];

const sortLabels: Record<string, string> = {
  recentes: "Mais recentes",
  preco_asc: "Menor preço",
  preco_desc: "Maior preço",
  area_desc: "Maior área",
};

const quartoOptions = [1, 2, 3, 4];

function fmtPrecoLabel(min: number, max: number): string {
  const fmt = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1)}M` : `${(v / 1000).toFixed(0)}k`;
  if (min && max) return `R$ ${fmt(min)} – ${fmt(max)}`;
  if (min) return `A partir de R$ ${fmt(min)}`;
  if (max) return `Até R$ ${fmt(max)}`;
  return "";
}

function fmtAreaLabel(min: number, max: number): string {
  if (min && max) return `${min} – ${max}m²`;
  if (min) return `A partir de ${min}m²`;
  if (max) return `Até ${max}m²`;
  return "";
}

// ── Visualizado helpers ──
const VIEWED_KEY = "imoveis_visualizados";
function getViewedSlugs(): Set<string> {
  try {
    const raw = localStorage.getItem(VIEWED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function markViewed(slug: string) {
  try {
    const set = getViewedSlugs();
    set.add(slug);
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

// ── Scroll restore helpers ──
const SCROLL_KEY = "imoveis_scroll";

export default function ImoveisPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
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
  const [page, setPage] = useState(0);
  const [allImoveis, setAllImoveis] = useState<SiteImovel[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [viewedSlugs, setViewedSlugs] = useState<Set<string>>(getViewedSlugs);
  const activeBounds = filters.bounds;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sort dropdown
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort on outside click
  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortOpen]);

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

  // Alert modal
  const [alertOpen, setAlertOpen] = useState(false);

  // ── AI Search ──
  const { searchWithAI, clearAISearch, aiLoading, aiResult } = useAISearch();
  const [aiMode, setAiMode] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiActiveQuery, setAiActiveQuery] = useState<string | null>(null);
  const aiThrottleRef = useRef(0);

  const handleAISearch = useCallback(async () => {
    if (!aiInput.trim()) return;
    const now = Date.now();
    if (now - aiThrottleRef.current < 3000) {
      toast.info("Aguarde alguns segundos entre buscas IA");
      return;
    }
    aiThrottleRef.current = now;
    const query = aiInput.trim();
    setAiActiveQuery(query);

    // Call the existing AI search which invokes ai-search-imoveis edge function
    await searchWithAI(query);

    // Apply discovered filters to the store if aiResult has them
    // The AI search results are displayed via aiResult/aiProperties in the existing hook
    // But for the new UX, we want to apply filters to the store
    setAiMode(false);
    setAiInput("");
  }, [aiInput, searchWithAI]);

  // When AI result comes back, apply its filters to the store
  useEffect(() => {
    if (!aiResult?.filters || !aiActiveQuery) return;
    const f = aiResult.filters;
    const updates: any = {};
    if (f.tipos?.length) updates.tipo = f.tipos[0];
    if (f.dormitorios?.length) updates.quartos = Number(f.dormitorios[0]) || 0;
    if (f.vagas_min) updates.vagas = f.vagas_min;
    if (f.valor_min) updates.precoMin = f.valor_min;
    if (f.valor_max) updates.precoMax = f.valor_max;
    if (f.area_min) updates.areaMin = f.area_min;
    if (f.bairros?.length) updates.bairro = f.bairros.join(",");
    if (aiResult.text_query) updates.q = aiResult.text_query;
    setFilters(updates);
    setPage(0);
    setAllImoveis([]);
  }, [aiResult, aiActiveQuery, setFilters]);

  const handleClearAI = useCallback(() => {
    clearAISearch();
    setAiActiveQuery(null);
    resetFilters();
    setPage(0);
    setAllImoveis([]);
  }, [clearAISearch, resetFilters]);

  // Scroll restore on mount
  useEffect(() => {
    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    if (savedScroll && scrollContainerRef.current) {
      const val = parseInt(savedScroll, 10);
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo(0, val);
      });
      sessionStorage.removeItem(SCROLL_KEY);
    }
  }, []);

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

  const hasSearchFilters = !!(
    filters.tipo || filters.bairro || filters.precoMin || filters.precoMax ||
    filters.areaMin || filters.areaMax || filters.quartos || filters.vagas ||
    filters.banheiros || filters.q || filters.codigo || (filters.cidade && filters.cidade !== "Porto Alegre") ||
    filters.statusImovel || filters.statusImovelList?.length || filters.condominioNome || filters.financiavel || filters.mobiliado ||
    filters.comodidades?.length || filters.entregaAnoMin || filters.entregaAnoMax
  );

  const advancedFilterCount = [
    filters.banheiros > 0, filters.vagas > 0, !!filters.codigo, !!filters.condominioNome,
    filters.financiavel, filters.mobiliado, (filters.comodidades?.length || 0) > 0,
    filters.entregaAnoMin > 0, filters.entregaAnoMax > 0,
  ].filter(Boolean).length;

  const addBairro = useCallback((nome: string) => {
    const next = [...bairrosSelecionados, nome];
    setFilter("bairro", next.join(","));
    setBairroInput("");
    setPage(0);
    setAllImoveis([]);
  }, [bairrosSelecionados, setFilter]);

  const removeBairro = useCallback((nome: string) => {
    const next = bairrosSelecionados.filter(b => b !== nome);
    setFilter("bairro", next.join(","));
    setPage(0);
    setAllImoveis([]);
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
    codigo: filters.codigo || undefined,
    ordem: filters.ordem,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    bounds: activeBounds,
    statusImovel: filters.statusImovel || undefined,
    statusImovelList: filters.statusImovelList?.length ? filters.statusImovelList : undefined,
    condominioNome: filters.condominioNome || undefined,
    financiavel: filters.financiavel || undefined,
    mobiliado: filters.mobiliado || undefined,
    comodidades: filters.comodidades?.length ? filters.comodidades : undefined,
    entregaAnoMin: filters.entregaAnoMin || undefined,
    entregaAnoMax: filters.entregaAnoMax || undefined,
  }), [filters, bairrosSelecionados, page, activeBounds]);

  const debouncedQueryFilters = useDebounce(
    queryFilters,
    page > 0 ? 0 : (!hasSearchFilters && !activeBounds ? 0 : 300)
  );

  // ── Data query ──
  const { data: result, isLoading, isError, error: fetchError, isFetching } = useQuery({
    queryKey: ["site-imoveis", debouncedQueryFilters],
    queryFn: () => fetchSiteImoveis(debouncedQueryFilters),
    staleTime: 3 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const EMPTY_ARR: SiteImovel[] = useMemo(() => [], []);
  const currentPageData = result?.data ?? EMPTY_ARR;
  const rawTotal = result?.count ?? 0;
  const searchTimeMs = result?.search_time_ms;

  // Track the last known good total (from page 0 queries with actual count)
  const lastKnownTotal = useRef(0);
  useEffect(() => {
    if (page === 0 && rawTotal > 0) {
      lastKnownTotal.current = rawTotal;
    }
  }, [rawTotal, page]);

  // Use last known total when current page returns 0 count (416 fallback)
  const total = rawTotal > 0 ? rawTotal : (page > 0 ? lastKnownTotal.current : 0);

  // Accumulate items for load-more
  useEffect(() => {
    if (currentPageData.length === 0 && page === 0) {
      setAllImoveis([]);
      return;
    }
    if (page === 0) {
      setAllImoveis(currentPageData);
    } else {
      setAllImoveis(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const newItems = currentPageData.filter(i => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
    }
  }, [currentPageData, page]);

  const imoveis = page === 0
    ? (allImoveis.length > 0 ? allImoveis : currentPageData)
    : allImoveis;
  // Stop loading more when current page returned no new data OR we have all items
  const hasMore = currentPageData.length > 0 && imoveis.length < total;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isInitialListPending = page === 0 && imoveis.length === 0 && (isLoading || isFetching);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore || isLoading || isFetching) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isFetching]);

  // ── Map pins ──
  const mapPinFilters = useMemo((): BuscaFilters => ({
    tipo: filters.tipo || undefined,
    bairros: bairrosSelecionados.length > 0 ? bairrosSelecionados : undefined,
    cidade: filters.cidade || undefined,
    precoMin: filters.precoMin || undefined,
    precoMax: filters.precoMax || undefined,
    quartos: filters.quartos || undefined,
    vagas: filters.vagas || undefined,
    q: filters.q || undefined,
    ordem: filters.ordem,
    bounds: activeBounds,
  }), [filters, bairrosSelecionados, activeBounds]);

  const { data: mapPins = [] } = useQuery({
    queryKey: ["site-map-pins", mapPinFilters],
    queryFn: () => fetchMapPins(mapPinFilters),
    staleTime: 2 * 60 * 1000,
  });

  const effectiveMapPins = useMemo<MapPinType[]>(() => {
    if (mapPins.length > 0) return mapPins;
    return imoveis
      .map((item) => siteImovelToMapPin(item, activeBounds))
      .filter((pin): pin is MapPinType => Boolean(pin));
  }, [mapPins, imoveis, activeBounds]);

  // ── Active filters count ──
  const hasActiveFilters = hasSearchFilters || !!aiActiveQuery || !!activeBounds;

  // ── Preview drawer ──
  const openPreview = useCallback((item: SiteImovel) => {
    // Save scroll position
    if (scrollContainerRef.current) {
      sessionStorage.setItem(SCROLL_KEY, String(scrollContainerRef.current.scrollTop));
    }
    // Mark as viewed
    markViewed(item.slug);
    setViewedSlugs(prev => new Set(prev).add(item.slug));
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
  useEffect(() => {
    setPage(0);
    setAllImoveis([]);
  }, [filters.tipo, filters.bairro, filters.cidade, filters.precoMin, filters.precoMax, filters.quartos, filters.vagas, filters.ordem, filters.q, filters.statusImovel, filters.statusImovelList, filters.condominioNome, filters.financiavel, filters.mobiliado, filters.comodidades, filters.entregaAnoMin, filters.entregaAnoMax, activeBounds]);

  // Clear bounds
  const clearBounds = useCallback(() => {
    setFilter("bounds", null);
    setPage(0);
    setAllImoveis([]);
  }, [setFilter]);

  // ── Helpers ──
  const precoLabel = precoRanges.find(r => r.min === filters.precoMin && r.max === filters.precoMax)?.label;
  const areaLabel = areaRanges.find(r => r.min === filters.areaMin && r.max === filters.areaMax)?.label || (filters.areaMin || filters.areaMax ? fmtAreaLabel(filters.areaMin, filters.areaMax) : undefined);
  const cidadeLabel = filters.cidade || "Porto Alegre";
  const tipoLabel = PROPERTY_TYPES.find(t => t.value === filters.tipo)?.label;

  // Bairro display for subheader
  const bairroDisplay = bairrosSelecionados.length > 0
    ? bairrosSelecionados.length <= 3
      ? `, ${bairrosSelecionados.join(", ")}`
      : `, ${bairrosSelecionados.slice(0, 3).join(", ")} +${bairrosSelecionados.length - 3}`
    : "";

  // ── Build card list with CTA card inserted after 6th ──
  const renderCards = useMemo(() => {
    const cards: React.ReactNode[] = [];
    imoveis.forEach((item, idx) => {
      cards.push(
        <SitePropertyCard
          key={item.id}
          imovel={item}
          index={idx}
          highlighted={hoveredId === item.id}
          isFavorite={favorites.has(item.id)}
          onToggleFavorite={toggleFavorite}
          selectMode={selectMode}
          isSelected={selectedIds.has(item.id)}
          onToggleSelect={toggleSelect}
          onPreview={openPreview}
          onHover={setHoveredId}
          isViewed={viewedSlugs.has(item.slug)}
        />
      );

      // Insert CTA card after 6th item
      if (idx === 5 && imoveis.length > 6) {
        cards.push(
          <motion.div
            key="cta-ia"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.2 }}
            className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 border border-primary/20 p-6 text-center"
            style={{ aspectRatio: "4/3" }}
          >
            <Sparkles className="h-8 w-8 text-primary mb-3" />
            <h3 className="text-base font-bold text-foreground mb-1.5">Não encontrou o ideal?</h3>
            <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
              Use a Busca IA para descrever em linguagem natural
            </p>
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); setAiMode(true); }}
              className="gap-1.5 rounded-full"
            >
              <Sparkles className="h-3.5 w-3.5" /> Tentar Busca IA
            </Button>
          </motion.div>
        );
      }
    });
    return cards;
  }, [imoveis, hoveredId, favorites, selectMode, selectedIds, viewedSlugs, toggleFavorite, toggleSelect, openPreview]);

  const mapContent = (
    <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Erro ao carregar mapa</div>}>
      <SearchMapBox
        pins={effectiveMapPins}
        onBoundsSearch={(bounds) => { setFilter("bounds", bounds); setPage(0); setAllImoveis([]); }}
        onBoundsChange={() => {}}
        onPinClick={async (pin) => {
          const found = imoveis.find(i => i.id === pin.id);
          if (found) {
            openPreview(found);
            return;
          }
          const fetched = pin.slug ? await fetchImovelBySlug(pin.slug) : null;
          if (fetched) openPreview(fetched);
        }}
      />
    </ErrorBoundary>
  );

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-background">
      {/* Preview drawer */}
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

      {/* Alert modal */}
      {user && (
        <SearchAlertModal
          open={alertOpen}
          onClose={() => setAlertOpen(false)}
          filters={filters}
          queryIA={aiActiveQuery}
          userId={user.id}
        />
      )}

      {/* ── Mobile fullscreen map overlay ── */}
      <AnimatePresence>
        {isMobile && mobileMapOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
              <span className="text-sm font-semibold text-foreground">{total.toLocaleString("pt-BR")} imóveis no mapa</span>
              <Button variant="ghost" size="sm" onClick={() => setMobileMapOpen(false)} className="gap-1.5">
                <List className="h-4 w-4" /> Ver lista
              </Button>
            </div>
            <div className="flex-1">{mapContent}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Search overlay ── */}
      <AnimatePresence>
        {aiMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="z-40 border-b border-primary/30 bg-primary/5 px-4 sm:px-5 py-3"
          >
            <div className="flex items-center gap-2 max-w-2xl mx-auto">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="relative flex-1">
                <input
                  autoFocus
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAISearch(); if (e.key === "Escape") { setAiMode(false); setAiInput(""); } }}
                  placeholder='Descreva o imóvel ideal... ex: "apartamento 2 quartos perto do Iguatemi até 800k"'
                  className="w-full rounded-full border border-primary/30 bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary transition-colors"
                />
              </div>
              <Button
                size="sm"
                onClick={handleAISearch}
                disabled={aiLoading || !aiInput.trim()}
                className="gap-1.5 rounded-full shrink-0"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Buscar
              </Button>
              <button onClick={() => { setAiMode(false); setAiInput(""); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Query active chip ── */}
      {aiActiveQuery && !aiMode && (
        <div className="z-30 border-b border-primary/20 bg-primary/5 px-4 sm:px-5 py-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[12px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" />
            IA: "{aiActiveQuery}"
          </span>
          <button onClick={handleClearAI} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
            Limpar busca IA
          </button>
        </div>
      )}

      {/* ── Sticky filter bar ── */}
      <div className="z-50 border-b border-border bg-background relative">
        <div className="flex items-center gap-2 overflow-x-auto px-4 sm:px-5 py-3 scrollbar-hide">
          {/* Search input with bairro chips */}
          <div className="shrink-0">
            <div
              className="flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 transition-colors focus-within:border-primary"
              style={{ minWidth: isMobile ? 180 : 240, maxWidth: isMobile ? 280 : 420 }}
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
                placeholder={bairrosSelecionados.length > 0 ? "Adicionar bairro..." : "Bairro, cidade ou tipo..."}
                className="min-w-[80px] flex-1 border-none bg-transparent py-1 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* AI Search button */}
          <button
            onClick={() => setAiMode(!aiMode)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all shrink-0",
              aiMode || aiActiveQuery
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-primary/50 hover:text-primary"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" /> Busca IA
          </button>

          {/* Cidade */}
          <FilterPill label={cidadeLabel} value={cidadeLabel} active={!!filters.cidade && filters.cidade !== "Porto Alegre"} onClear={() => { setFilter("cidade", "Porto Alegre"); setPage(0); setAllImoveis([]); }}>
            <PillOption selected={!filters.cidade || filters.cidade === "Porto Alegre"} onClick={() => { setFilter("cidade", "Porto Alegre"); setPage(0); setAllImoveis([]); }}>Porto Alegre</PillOption>
            {CIDADES_PERMITIDAS.filter(c => c !== "Porto Alegre").map(c => (
              <PillOption key={c} selected={filters.cidade === c} onClick={() => { setFilter("cidade", filters.cidade === c ? "Porto Alegre" : c); setPage(0); setAllImoveis([]); }}>{c}</PillOption>
            ))}
          </FilterPill>

          {/* Tipo */}
          <FilterPill label="Tipo" value={tipoLabel} active={!!filters.tipo} onClear={() => { setFilter("tipo", ""); setPage(0); setAllImoveis([]); }}>
            {PROPERTY_TYPES.map(t => (
              <PillOption key={t.value} selected={filters.tipo === t.value} onClick={() => { setFilter("tipo", filters.tipo === t.value ? "" : t.value); setPage(0); setAllImoveis([]); }}>{t.label}</PillOption>
            ))}
          </FilterPill>

          {/* Status do Imóvel — multi-select */}
          <FilterPill
            label="Status"
            value={filters.statusImovelList?.length ? (filters.statusImovelList.length === 1 ? filters.statusImovelList[0] : `${filters.statusImovelList.length} status`) : undefined}
            active={!!(filters.statusImovelList?.length)}
            onClear={() => { setFilter("statusImovelList", []); setFilter("entregaAnoMin", 0); setFilter("entregaAnoMax", 0); setPage(0); setAllImoveis([]); }}
          >
            {["Usado", "Novo", "Em construção", "Na planta"].map(s => {
              const selected = filters.statusImovelList?.includes(s);
              return (
                <PillOption key={s} selected={!!selected} onClick={() => {
                  const current = filters.statusImovelList || [];
                  const next = selected ? current.filter(v => v !== s) : [...current, s];
                  setFilter("statusImovelList", next);
                  // Clear entrega if no construction statuses
                  if (!next.includes("Em construção") && !next.includes("Na planta")) {
                    setFilter("entregaAnoMin", 0);
                    setFilter("entregaAnoMax", 0);
                  }
                  setPage(0); setAllImoveis([]);
                }}>{s}</PillOption>
              );
            })}
            {/* Entrega range — only when Em construção or Na planta is selected */}
            {(filters.statusImovelList?.includes("Em construção") || filters.statusImovelList?.includes("Na planta")) && (
              <div className="mt-2 border-t border-border pt-3 px-1">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Previsão de entrega</p>
                <div className="flex items-center gap-2">
                  <select
                    value={filters.entregaAnoMin || ""}
                    onChange={(e) => { setFilter("entregaAnoMin", Number(e.target.value) || 0); setPage(0); setAllImoveis([]); }}
                    className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
                  >
                    <option value="">A partir de</option>
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span className="text-xs text-muted-foreground">–</span>
                  <select
                    value={filters.entregaAnoMax || ""}
                    onChange={(e) => { setFilter("entregaAnoMax", Number(e.target.value) || 0); setPage(0); setAllImoveis([]); }}
                    className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
                  >
                    <option value="">Até</option>
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}
          </FilterPill>


          <FilterPill
            label="Preço"
            value={precoLabel || (filters.precoMin || filters.precoMax ? fmtPrecoLabel(filters.precoMin, filters.precoMax) : undefined)}
            active={!!(filters.precoMin || filters.precoMax)}
            onClear={() => { setFilter("precoMin", 0); setFilter("precoMax", 0); setPage(0); setAllImoveis([]); }}
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
                  setAllImoveis([]);
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
          <FilterPill label="Quartos" value={filters.quartos ? `${filters.quartos}+ quartos` : undefined} active={!!filters.quartos} onClear={() => { setFilter("quartos", 0); setPage(0); setAllImoveis([]); }}>
            {quartoOptions.map(q => (
              <PillOption key={q} selected={filters.quartos === q} onClick={() => { setFilter("quartos", filters.quartos === q ? 0 : q); setPage(0); setAllImoveis([]); }}>{q}+ quartos</PillOption>
            ))}
          </FilterPill>

          {/* Área */}
          <FilterPill label="Área" value={areaLabel} active={!!(filters.areaMin || filters.areaMax)} onClear={() => { setFilter("areaMin", 0); setFilter("areaMax", 0); setPage(0); setAllImoveis([]); }}>
            {areaRanges.map(r => (
              <PillOption
                key={r.label}
                selected={filters.areaMin === r.min && filters.areaMax === r.max}
                onClick={() => {
                  const isSel = filters.areaMin === r.min && filters.areaMax === r.max;
                  setFilter("areaMin", isSel ? 0 : r.min);
                  setFilter("areaMax", isSel ? 0 : r.max);
                  setPage(0);
                  setAllImoveis([]);
                }}
              >{r.label}</PillOption>
            ))}
          </FilterPill>

          {/* +Filtros */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all shrink-0",
                  (filters.banheiros || filters.vagas)
                    || filters.codigo || filters.condominioNome || filters.financiavel || filters.mobiliado
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                + Filtros
                {advancedFilterCount > 0 && (
                  <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {advancedFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-h-[70vh] overflow-y-auto p-4 space-y-4">
              <p className="text-sm font-semibold text-foreground">Filtros avançados</p>

              {/* Banheiros */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Banheiros</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => { setFilter("banheiros", filters.banheiros === n ? 0 : n); setPage(0); setAllImoveis([]); }}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        filters.banheiros === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/40"
                      )}
                    >{n}+</button>
                  ))}
                </div>
              </div>

              {/* Vagas */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vagas</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => { setFilter("vagas", filters.vagas === n ? 0 : n); setPage(0); setAllImoveis([]); }}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        filters.vagas === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/40"
                      )}
                    >{n}+</button>
                  ))}
                </div>
              </div>

              {/* Comodidades */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comodidades</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Piscina", "Churrasqueira", "Sacada", "Elevador", "Pet friendly", "Móveis planejados", "Ar condicionado", "Vista panorâmica", "Espaço gourmet", "Dep. empregada", "Lareira", "Terraço"].map(c => {
                    const selected = filters.comodidades?.includes(c);
                    return (
                      <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => {
                            const current = filters.comodidades || [];
                            const next = selected ? current.filter(v => v !== c) : [...current, c];
                            setFilter("comodidades", next);
                            setPage(0); setAllImoveis([]);
                          }}
                          className="h-3.5 w-3.5 rounded border-border text-primary accent-primary"
                        />
                        <span className="text-[12px] text-foreground">{c}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Empreendimento/Condomínio */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Empreendimento</p>
                <input
                  type="text"
                  placeholder="Buscar empreendimento…"
                  value={filters.condominioNome}
                  onChange={(e) => { setFilter("condominioNome", e.target.value); }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.financiavel}
                    onChange={(e) => { setFilter("financiavel", e.target.checked); setPage(0); setAllImoveis([]); }}
                    className="h-4 w-4 rounded border-border text-primary accent-primary"
                  />
                  <span className="text-[13px] text-foreground">Aceita financiamento</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.mobiliado}
                    onChange={(e) => { setFilter("mobiliado", e.target.checked); setPage(0); setAllImoveis([]); }}
                    className="h-4 w-4 rounded border-border text-primary accent-primary"
                  />
                  <span className="text-[13px] text-foreground">Mobiliado</span>
                </label>
              </div>

              {/* Código do imóvel */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Código do imóvel</p>
                <input
                  type="text"
                  placeholder="Ex: 74726-UH"
                  value={filters.codigo}
                  onChange={(e) => { setFilter("codigo", e.target.value); setPage(0); setAllImoveis([]); }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              {/* Limpar avançados */}
              {(filters.banheiros > 0 || filters.vagas > 0 || !!filters.codigo || !!filters.condominioNome || filters.financiavel || filters.mobiliado || (filters.comodidades?.length || 0) > 0) && (
                <button
                  onClick={() => { setFilter("banheiros", 0); setFilter("vagas", 0); setFilter("codigo", ""); setFilter("condominioNome", ""); setFilter("financiavel", false); setFilter("mobiliado", false); setFilter("comodidades", []); setPage(0); setAllImoveis([]); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Limpar filtros avançados
                </button>
              )}
            </PopoverContent>
          </Popover>

          {/* Divider + actions */}
          <div className="border-l border-border/50 pl-2 ml-1 flex items-center gap-1.5 shrink-0">
            {hasActiveFilters && (
              <button onClick={() => { resetFilters(); handleClearAI(); setPage(0); setAllImoveis([]); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:text-foreground transition-all">
                <RotateCcw className="h-3 w-3" /> Limpar
              </button>
            )}
            <Button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); setVitrineLink(null); }} variant={selectMode ? "default" : "ghost"} size="sm" className="gap-1.5 h-9 rounded-full">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">{selectMode ? `${selectedIds.size} selecionados` : "Vitrine"}</span>
            </Button>
          </div>
        </div>
        {/* Bairro dropdown — outside overflow container */}
        {showBairroDropdown && bairroSuggestions.length > 0 && (
          <div className="absolute left-4 sm:left-5 top-full z-[60] mt-1 max-h-64 w-80 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl">
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

      {/* ── Subheader: counter + bounds badge + sort + alert ── */}
      <div className={`relative flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-background px-4 sm:px-5 py-3 ${sortOpen ? "z-30" : "z-0"}`}>
        <div className="flex items-center gap-2">
          {isLoading && page === 0 ? <Skeleton className="h-7 w-40" /> : (
            <div>
             <div className="text-lg font-extrabold leading-tight text-foreground">
                 {total.toLocaleString("pt-BR")} imóveis
                 {searchTimeMs != null && (
                   <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {searchTimeMs}ms</span>
                 )}
               </div>
               <div className="mt-0.5 text-xs text-muted-foreground">
                 {imoveis.length > 0 && `Mostrando ${imoveis.length.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} · `}
                 à venda em {filters.cidade || "Porto Alegre"}{bairroDisplay}
               </div>
            </div>
          )}

          {filters.bounds && (
            <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              <MapPin className="h-3 w-3" />
              Mapa
              <button onClick={clearBounds} className="ml-0.5 font-bold leading-none hover:opacity-70">×</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Alert */}
          <button
            onClick={() => setAlertOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Bell className="h-3.5 w-3.5" /> Alerta
          </button>

          {/* Sort */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-foreground"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortLabels[filters.ordem] || "Mais recentes"}
            </button>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-border bg-card p-1 shadow-xl"
              >
                {Object.entries(sortLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setFilter("ordem", key as any); setSortOpen(false); }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                      filters.ordem === key
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Vitrine bar ── */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && !isMobile && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border/30">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content: cards (left) + map (right) ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Cards column */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pt-3 pb-5 sm:px-5" style={{ minWidth: 0 }}>
          {isError ? (
            <ErrorState
              title="Erro ao carregar imóveis"
              description={fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
              action={{ label: "Tentar novamente", onClick: () => {} }}
            />
          ) : isInitialListPending ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : imoveis.length === 0 ? (
            <EmptyState
              title="Nenhum imóvel encontrado"
              description="Tente ajustar seus filtros ou termo de busca."
              icon={<Search className="h-10 w-10 text-muted-foreground/30" />}
              action={hasActiveFilters ? { label: "Limpar filtros", onClick: () => { resetFilters(); handleClearAI(); setPage(0); setAllImoveis([]); } } : undefined}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
                {renderCards}
              </div>

              {/* Load more */}
              {hasMore && (
                <div ref={loadMoreRef} className="flex items-center justify-center pt-8 pb-4">
                  {isFetching ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando mais imóveis...
                    </div>
                  ) : (
                    <button
                      onClick={() => setPage(p => p + 1)}
                      className="rounded-full border border-border px-8 py-3 text-sm font-semibold text-foreground transition-all hover:border-foreground hover:shadow-md active:scale-[0.97]"
                    >
                      Ver mais imóveis ({imoveis.length.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")})
                    </button>
                  )}
                </div>
              )}

              {!hasMore && imoveis.length > 0 && (
                <p className="text-center text-xs text-muted-foreground pt-6 pb-4">
                  Mostrando todos os {imoveis.length.toLocaleString("pt-BR")} imóveis
                </p>
              )}
            </>
          )}
        </div>

        {/* Map — desktop always visible */}
        <div className="relative hidden w-[40%] shrink-0 border-l border-border lg:block">
          {mapContent}
        </div>
      </div>

      {/* ── Mobile bottom bar ── */}
      {isMobile && !mobileMapOpen && (
        <div className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
          <div
            className="bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 flex items-center gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            {selectMode && selectedIds.size > 0 ? (
              <>
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
              </>
            ) : (
              <div className="flex w-full gap-2">
                <Button
                  onClick={() => setMobileMapOpen(true)}
                  className="flex-1 h-11 gap-2 rounded-xl font-semibold shadow-lg"
                >
                  <MapIcon className="h-4 w-4" />
                  Ver mapa · {total.toLocaleString("pt-BR")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAlertOpen(true)}
                  className="h-11 px-4 rounded-xl font-semibold shrink-0"
                >
                  <Bell className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
