import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState, EmptyState } from "@/components/ui/screen-states";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import {
  Search, Building2, Loader2, ChevronLeft, ChevronRight, Phone,
  MapPin, Megaphone, Check, X, Share2, Link2, Copy, CalendarClock,
  LayoutGrid, List, Heart, Zap,
  Sparkles, Brain, ArrowRight, Map, MessageCircle, Bookmark, Users
} from "lucide-react";
import PropertyMap from "@/components/imoveis/PropertyMap";
import PropertyPreviewDrawer from "@/components/imoveis/PropertyPreviewDrawer";
import FilterChip from "@/components/imoveis/FilterChip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getVitrinePublicUrl } from "@/lib/vitrineUrl";
import { useAISearch } from "@/hooks/useAISearch";
import { PropertyCardGrid, PropertyCardList } from "@/components/imoveis/PropertyCards";
import { getNum, fmtBRL, fmtCompact } from "@/lib/imovelHelpers";
import { useImoveisFilters } from "@/hooks/useImoveisFilters";
import { useImoveisSearch } from "@/hooks/useImoveisSearch";
import { useTypesenseFacets } from "@/hooks/useTypesenseFacets";
import { useLeadContext } from "@/hooks/useLeadContext";
import { useLeadPropertyProfile } from "@/hooks/useLeadPropertyProfile";
import { useLeadMatch } from "@/hooks/useLeadMatch";
import LeadSearchModal from "@/components/imoveis/LeadSearchModal";
import MatchConfirmModal from "@/components/imoveis/MatchConfirmModal";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ImoveisPage() {
  const { user } = useAuth();
  const { searchWithAI, clearAISearch, removeTag, aiLoading, aiResult, aiError, aiProperties, aiTotal, aiSearchTime } = useAISearch();
  const { leadId, leadNome, hasLeadContext, trackEvent } = useLeadContext();
  const { profile: leadProfile } = useLeadPropertyProfile(leadId);

  // ── Dynamic facets ──
  const { bairroFacets, tipoFacets, construtoraFacets, empreendimentoFacets, statusImovelFacets, cidadeFacets, fetchBairrosByCidade } = useTypesenseFacets();

  // ── Filters ──
  const filters = useImoveisFilters(bairroFacets, tipoFacets, construtoraFacets, empreendimentoFacets, cidadeFacets, fetchBairrosByCidade);
  const {
    contrato, tipo, setTipo, bairro, setBairro, bairroSearch, setBairroSearch,
    dormitorios, setDormitorios, suitesFilter, setSuitesFilter,
    vagas, setVagas, areaRange, setAreaRange, valorRange, setValorRange,
    somenteObras, setSomenteObras, campanhaAtiva, setCampanhaAtiva,
    uhomeOnly, setUhomeOnly, search, setSearch, sortBy, setSortBy,
    construtora, setConstrutora, construtoraSearch, setConstrutoraSearch,
    empreendimento, setEmpreendimento, empreendimentoSearch, setEmpreendimentoSearch,
    situacao, setSituacao,
    cidade, setCidade, cidadeOptions,
    filteredBairros, tipoOptions, filteredConstrutoras, filteredEmpreendimentos,
    activeFilters, clearAllFilters, filterKey,
  } = filters;

  // ── UI state (local to page) ──
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchMode, setSearchMode] = useState<"normal" | "ai">("normal");
  const [aiQuery, setAiQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Vitrine selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingVitrine, setCreatingVitrine] = useState(false);
  const [vitrineLink, setVitrineLink] = useState<string | null>(null);

  // Lead Match
  const leadMatch = useLeadMatch();
  const [leadSearchOpen, setLeadSearchOpen] = useState(false);
  const [matchConfirmOpen, setMatchConfirmOpen] = useState(false);

  // Preview drawer
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const openPreview = (item: any) => { setPreviewItem(item); setPreviewOpen(true); };
  const closePreview = () => setPreviewOpen(false);

  // ── Search ──
  const {
    loading, fetchError, page, totalPages, total, searchTimeMs, sortedImoveis,
    campanhaOverrides, suggestions, showSuggestions, setShowSuggestions,
    handleSearchChange, handleSuggestionClick, handleSearch, fetchPage, fetchRef,
  } = useImoveisSearch({
    filters: {
      search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas,
      areaRange, valorRange, somenteObras, uhomeOnly, campanhaAtiva, sortBy,
      construtora, empreendimento, situacao, cidade,
    },
    filterKey,
    setSearch,
    setBairro: (fn) => setBairro(fn as any),
    setCampanhaAtiva,
    setUhomeOnly,
    showFavoritesOnly,
    favorites,
  });

  // ── Lead adherence scoring (when lead context + profile exists) ──
  const scorePropertyForLead = useCallback((item: any): number => {
    if (!leadProfile) return 0;
    let score = 0;
    const preco = getNum(item, "valor_venda", "valor") || 0;
    // Valor (25pts)
    if (leadProfile.valor_min || leadProfile.valor_max) {
      const aboveMin = !leadProfile.valor_min || preco >= leadProfile.valor_min;
      const belowMax = !leadProfile.valor_max || preco <= leadProfile.valor_max;
      if (aboveMin && belowMax) score += 25;
      else if (!leadProfile.valor_max || preco <= leadProfile.valor_max * 1.15) score += 12;
    } else score += 12;
    // Bairro (20pts)
    const bairro = item.endereco_bairro || item.bairro || "";
    if (leadProfile.bairros?.length && bairro) {
      const nb = bairro.toLowerCase();
      if (leadProfile.bairros.some((b: string) => nb.includes(b.toLowerCase()))) score += 20;
    } else score += 10;
    // Dorms (15pts)
    const dorms = getNum(item, "dormitorios") || 0;
    if (leadProfile.dormitorios_min && dorms > 0) {
      if (dorms >= leadProfile.dormitorios_min) score += 15;
      else if (dorms === leadProfile.dormitorios_min - 1) score += 7;
    } else score += 7;
    // Tipo (10pts)
    if (leadProfile.tipos?.length && item.tipo) {
      if (leadProfile.tipos.some((t: string) => (item.tipo || "").toLowerCase().includes(t.toLowerCase()))) score += 10;
    } else score += 5;
    // Suítes (5pts)
    if (leadProfile.suites_min && (getNum(item, "suites") || 0) >= leadProfile.suites_min) score += 5;
    else if (!leadProfile.suites_min) score += 2;
    // Vagas (5pts)
    if (leadProfile.vagas_min && (getNum(item, "garagens", "vagas") || 0) >= leadProfile.vagas_min) score += 5;
    else if (!leadProfile.vagas_min) score += 2;

    return Math.min(Math.round((score / 85) * 100), 99);
  }, [leadProfile]);

  // When sorting by aderência, re-sort; also attach scores for badge display
  const displayImoveis = useMemo(() => {
    if (!hasLeadContext || !leadProfile || sortBy !== "aderencia") return sortedImoveis;
    return [...sortedImoveis].sort((a, b) => scorePropertyForLead(b) - scorePropertyForLead(a));
  }, [sortedImoveis, hasLeadContext, leadProfile, sortBy, scorePropertyForLead]);

  // Prev/next navigation in preview
  const previewIndex = previewItem ? displayImoveis.findIndex((it: any) => {
    const pid = String(previewItem.codigo || previewItem.id_imovel || previewItem.id);
    const iid = String(it.codigo || it.id_imovel || it.id);
    return pid === iid;
  }) : -1;
  const hasPrevPreview = previewIndex > 0;
  const hasNextPreview = previewIndex >= 0 && previewIndex < displayImoveis.length - 1;
  const goToPrevPreview = () => { if (hasPrevPreview) setPreviewItem(displayImoveis[previewIndex - 1]); };
  const goToNextPreview = () => { if (hasNextPreview) setPreviewItem(displayImoveis[previewIndex + 1]); };
  const previewPositionLabel = previewIndex >= 0 ? `${previewIndex + 1} / ${displayImoveis.length}` : undefined;

  // ── Favorites persistence ──
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

  // ── Helpers ──
  const getPreco = (item: any): string => {
    const venda = getNum(item, "valor_venda", "preco_venda", "valor", "price");
    if (venda) return fmtBRL(venda);
    return "Consultar";
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setVitrineLink(null);
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PropertyPreviewDrawer
        item={previewItem}
        open={previewOpen}
        onClose={closePreview}
        isFavorite={previewItem ? favorites.has(String(previewItem.codigo || previewItem.id_imovel || previewItem.id)) : false}
        onFavorite={toggleFavorite}
        getPreco={getPreco}
        selectMode={selectMode}
        isSelected={previewItem ? selectedIds.has(String(previewItem.codigo || previewItem.id_imovel || previewItem.id)) : false}
        onToggleSelect={toggleSelect}
        onPrev={goToPrevPreview}
        onNext={goToNextPreview}
        hasPrev={hasPrevPreview}
        hasNext={hasNextPreview}
        positionLabel={previewPositionLabel}
        trackEvent={hasLeadContext ? trackEvent : undefined}
      />

      {/* Lead context banner */}
      {hasLeadContext && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-center">
          <span className="text-xs font-medium text-primary">
            🔗 Buscando imóveis para: <strong>{leadNome || "Lead"}</strong>
          </span>
        </div>
      )}

      {/* Lead Match banner */}
      {leadMatch.hasMatch && (
        <div className="bg-accent/50 border-b border-accent px-4 py-2 flex items-center justify-center gap-2">
          <span className="text-xs font-medium text-foreground">
            🔍 Buscando imóveis para <strong>{leadMatch.matchedLead!.nome}</strong>
          </span>
          <button onClick={leadMatch.clearMatch} className="ml-2 p-0.5 rounded-full hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

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
                    <button onClick={() => { setSearch(""); setShowSuggestions(false); }} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/50">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Button onClick={() => { handleSearch(); if (hasLeadContext && search.trim()) trackEvent({ event_type: "search_performed", search_query: search.trim(), payload: { contrato, tipo, bairro, dormitorios } }); }} size="sm" className="h-7 px-3 rounded-full text-xs gap-1" disabled={loading}>
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
              <div className="space-y-1 w-48">
                <p className="text-xs font-semibold text-foreground mb-2">Tipo de imóvel <span className="text-muted-foreground font-normal">(múltipla)</span></p>
                {tipoOptions.map((facet) => {
                  const selected = tipo.includes(facet.value);
                  const label = facet.value.charAt(0).toUpperCase() + facet.value.slice(1);
                  return (
                    <button key={facet.value} onClick={() => setTipo(prev => selected ? prev.filter(t => t !== facet.value) : [...prev, facet.value])} className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-2",
                      selected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50"
                    )}>
                      <Check className={cn("h-3 w-3 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1">{label}</span>
                      {facet.count > 0 && <span className="text-[10px] text-muted-foreground">({facet.count})</span>}
                    </button>
                  );
                })}
              </div>
            </FilterChip>

            {/* Cidade */}
            <FilterChip
              label={cidade.length === 1 ? cidade[0] : cidade.length > 1 ? `${cidade.length} cidades` : "Cidade"}
              active={!(cidade.length === 1 && cidade[0] === "Porto Alegre")}
              onClear={() => setCidade(["Porto Alegre"])}
            >
              <div className="space-y-1 w-48">
                <p className="text-xs font-semibold text-foreground mb-2">Cidade <span className="text-muted-foreground font-normal">(múltipla)</span></p>
                {cidadeOptions.map((facet) => {
                  const selected = cidade.includes(facet.value);
                  return (
                    <button key={facet.value} onClick={() => {
                      setCidade(prev => {
                        if (selected) {
                          const next = prev.filter(c => c !== facet.value);
                          return next.length === 0 ? ["Porto Alegre"] : next;
                        }
                        return [...prev, facet.value];
                      });
                      // Clear bairro selections when city changes
                      setBairro([]);
                    }} className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-2",
                      selected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50"
                    )}>
                      <Check className={cn("h-3 w-3 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1">{facet.value}</span>
                      {facet.count > 0 && <span className="text-[10px] text-muted-foreground">({facet.count})</span>}
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
                      {filteredBairros.map((facet) => {
                        const selected = bairro.includes(facet.value);
                        return (
                          <CommandItem key={facet.value} value={facet.value} onSelect={() => { setBairro(prev => selected ? prev.filter(x => x !== facet.value) : [...prev, facet.value]); setBairroSearch(""); }}>
                            <Check className={cn("mr-2 h-3 w-3", selected ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1">{facet.value}</span>
                            {facet.count > 0 && <span className="text-[10px] text-muted-foreground ml-1">({facet.count})</span>}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            </FilterChip>

            {/* Construtora — only show if facets exist */}
            {filteredConstrutoras.length > 0 && (
            <FilterChip label={construtora.length > 0 ? (construtora.length <= 2 ? construtora.join(", ") : `${construtora.length} construtoras`) : "Construtora"} active={construtora.length > 0} onClear={() => setConstrutora([])}>
              <div className="w-56">
                <Command>
                  <CommandInput placeholder="Buscar construtora..." value={construtoraSearch} onValueChange={setConstrutoraSearch} className="h-8" />
                  <CommandList className="max-h-48">
                    <CommandEmpty>Nenhuma encontrada</CommandEmpty>
                    <CommandGroup>
                      {construtora.length > 0 && (
                        <CommandItem value="__limpar__" onSelect={() => { setConstrutora([]); setConstrutoraSearch(""); }}>
                          <X className="mr-2 h-3 w-3 text-muted-foreground" /> Limpar seleção
                        </CommandItem>
                      )}
                      {filteredConstrutoras.map((facet) => {
                        const selected = construtora.includes(facet.value);
                        return (
                          <CommandItem key={facet.value} value={facet.value} onSelect={() => { setConstrutora(prev => selected ? prev.filter(x => x !== facet.value) : [...prev, facet.value]); setConstrutoraSearch(""); }}>
                            <Check className={cn("mr-2 h-3 w-3", selected ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1">{facet.value}</span>
                            {facet.count > 0 && <span className="text-[10px] text-muted-foreground ml-1">({facet.count})</span>}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            </FilterChip>
            )}

            {/* Empreendimento — only show if facets exist */}
            {filteredEmpreendimentos.length > 0 && (
            <FilterChip label={empreendimento.length > 0 ? (empreendimento.length <= 2 ? empreendimento.join(", ") : `${empreendimento.length} empreend.`) : "Empreendimento"} active={empreendimento.length > 0} onClear={() => setEmpreendimento([])}>
              <div className="w-56">
                <Command>
                  <CommandInput placeholder="Buscar empreendimento..." value={empreendimentoSearch} onValueChange={setEmpreendimentoSearch} className="h-8" />
                  <CommandList className="max-h-48">
                    <CommandEmpty>Nenhum encontrado</CommandEmpty>
                    <CommandGroup>
                      {empreendimento.length > 0 && (
                        <CommandItem value="__limpar__" onSelect={() => { setEmpreendimento([]); setEmpreendimentoSearch(""); }}>
                          <X className="mr-2 h-3 w-3 text-muted-foreground" /> Limpar seleção
                        </CommandItem>
                      )}
                      {filteredEmpreendimentos.map((facet) => {
                        const selected = empreendimento.includes(facet.value);
                        return (
                          <CommandItem key={facet.value} value={facet.value} onSelect={() => { setEmpreendimento(prev => selected ? prev.filter(x => x !== facet.value) : [...prev, facet.value]); setEmpreendimentoSearch(""); }}>
                            <Check className={cn("mr-2 h-3 w-3", selected ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1 truncate">{facet.value}</span>
                            {facet.count > 0 && <span className="text-[10px] text-muted-foreground ml-1">({facet.count})</span>}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            </FilterChip>
            )}

            {/* Situação — uses status field from Typesense (Usado, Novo, Em construção, Na planta) */}
            <FilterChip
              label={situacao.length > 0 ? situacao.join(", ") : "Situação"}
              active={situacao.length > 0}
              onClear={() => setSituacao([])}
            >
              <div className="space-y-2 w-48">
                <p className="text-xs font-semibold text-foreground mb-2">Situação do imóvel <span className="text-muted-foreground font-normal">(múltipla)</span></p>
                {(statusImovelFacets.length > 0 ? statusImovelFacets : [
                  { value: "Usado", count: 0 },
                  { value: "Novo", count: 0 },
                  { value: "Em construção", count: 0 },
                  { value: "Na planta", count: 0 },
                ]).map(opt => {
                  const selected = situacao.includes(opt.value);
                  const emoji = opt.value === "Usado" ? "🏠" : opt.value === "Novo" ? "✨" : opt.value === "Em construção" ? "🏗️" : "📋";
                  return (
                    <button key={opt.value} onClick={() => setSituacao(prev => selected ? prev.filter(s => s !== opt.value) : [...prev, opt.value])} className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-2",
                      selected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50"
                    )}>
                      <Check className={cn("h-3 w-3 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                      <span>{emoji} {opt.value}</span>
                      {opt.count > 0 && <span className="text-[10px] text-muted-foreground ml-auto">({opt.count})</span>}
                    </button>
                  );
                })}
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
                onClick={() => { setCampanhaAtiva(!campanhaAtiva); setUhomeOnly(false); }}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                  campanhaAtiva ? "bg-primary/10 border-primary/30 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                <Megaphone className="h-3 w-3" /> Campanha
              </button>
              
              <button
                onClick={() => setLeadSearchOpen(true)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                  leadMatch.hasMatch ? "bg-primary/10 border-primary/30 text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                <Users className="h-3 w-3" /> Match Lead
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
            {fetchError ? (
              <div className="text-center py-8">
                <Search className="h-8 w-8 mx-auto text-destructive/30 mb-2" />
                <p className="text-sm font-medium text-foreground">Erro ao carregar</p>
                <p className="text-xs text-muted-foreground mt-1">{fetchError}</p>
                <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => fetchPage(1)}>Tentar novamente</Button>
              </div>
            ) : loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden border-border/40">
                    <div className="flex"><Skeleton className="w-32 h-28 rounded-none shrink-0" /><div className="flex-1 p-2.5 space-y-1.5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div></div>
                  </Card>
                ))}
              </div>
            ) : displayImoveis.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-sm font-medium text-foreground">Nenhum imóvel</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayImoveis.map((item, idx) => {
                  const isCampanha = campanhaOverrides.some((c) => c.codigo === item.codigo);
                  const imovelId = String(item.codigo || item.id_imovel || item.id || idx);
                  return <PropertyCardList key={item.id_imovel || item.codigo || idx} item={item} idx={idx} isCampanha={isCampanha} selectMode={selectMode} isSelected={selectedIds.has(imovelId)} onToggleSelect={toggleSelect} onFavorite={toggleFavorite} isFavorite={favorites.has(imovelId)} getPreco={getPreco} onPreview={openPreview} />;
                })}
                {totalPages > 1 && !campanhaAtiva && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1)} className="gap-1 rounded-full text-xs"><ChevronLeft className="h-3 w-3" /></Button>
                    <span className="text-xs text-muted-foreground tabular-nums">{page}/{totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => fetchPage(page + 1)} className="gap-1 rounded-full text-xs"><ChevronRight className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Right: map */}
          <div className="flex-1 h-[calc(100vh-120px)]">
            <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Erro ao carregar mapa</div>}>
              <PropertyMap
                properties={displayImoveis}
                loading={loading}
                onFavorite={toggleFavorite}
                favorites={favorites}
                getPreco={getPreco}
                className="h-full w-full rounded-none border-0"
              />
            </ErrorBoundary>
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
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Confira esta seleção de imóveis: ${vitrineLink}`)}`} target="_blank" rel="noopener noreferrer" onClick={() => { if (hasLeadContext) trackEvent({ event_type: "vitrine_sent", payload: { link: vitrineLink, channel: "whatsapp" } }); }}>
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
                      if (hasLeadContext) trackEvent({ event_type: "vitrine_created", vitrine_id: data.id, payload: { imovel_ids: [...selectedIds], link } });
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
                        return (
                          <div key={item.id_imovel || item.codigo || idx} className="relative">
                            <div className={cn("absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm backdrop-blur-sm", score >= 90 ? "bg-emerald-500/90 text-white" : score >= 75 ? "bg-primary/90 text-primary-foreground" : score >= 60 ? "bg-amber-500/90 text-white" : "bg-muted/90 text-foreground")}>
                              <Sparkles className="h-2.5 w-2.5" />{score}%
                            </div>
                            <PropertyCardGrid item={item} idx={idx} isCampanha={false} selectMode={selectMode} isSelected={selectedIds.has(imovelId)} onToggleSelect={toggleSelect} onFavorite={toggleFavorite} isFavorite={favorites.has(imovelId)} getPreco={getPreco} onPreview={openPreview} />
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
                      {hasLeadContext && <SelectItem value="aderencia">Aderência ao lead</SelectItem>}
                    </SelectContent>
                  </Select>
                  <div className="flex border border-border/60 rounded-lg overflow-hidden">
                    <button onClick={() => setViewMode("grid")} className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}><LayoutGrid className="h-4 w-4" /></button>
                    <button onClick={() => setViewMode("list")} className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}><List className="h-4 w-4" /></button>
                    <button onClick={() => setViewMode("map")} className={cn("p-1.5 transition-colors", "bg-background text-muted-foreground hover:bg-muted")}><Map className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
              {fetchError ? (
                <ErrorState
                  title="Erro ao carregar imóveis"
                  description={fetchError}
                  action={{ label: "Tentar novamente", onClick: () => fetchPage(1) }}
                />
              ) : loading ? (
                <div className={cn("grid gap-4", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden border-border/40">
                      <div><Skeleton className="aspect-[16/10] rounded-none" /><div className="p-3.5 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                    </Card>
                  ))}
                </div>
              ) : displayImoveis.length === 0 ? (
                <EmptyState
                  title="Nenhum imóvel encontrado"
                  description="Tente ajustar seus filtros ou termo de busca."
                  icon={<Search className="h-10 w-10 text-muted-foreground/30" />}
                  action={activeFilters.length > 0 ? { label: "Limpar filtros", onClick: clearAllFilters } : undefined}
                />
              ) : (
                <>
                  <div className={cn("grid gap-4", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
                    {displayImoveis.map((item, idx) => {
                      const isCampanha = campanhaOverrides.some((c) => c.codigo === item.codigo);
                      const imovelId = String(item.codigo || item.id_imovel || item.id || idx);
                      return (
                        <div key={item.id_imovel || item.codigo || idx} className="relative">
                          {hasLeadContext && leadProfile && sortBy === "aderencia" && (() => {
                            const score = scorePropertyForLead(item);
                            return score > 0 ? (
                              <div className={cn("absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm backdrop-blur-sm",
                                score >= 80 ? "bg-emerald-500/90 text-white" : score >= 60 ? "bg-primary/90 text-primary-foreground" : score >= 40 ? "bg-amber-500/90 text-white" : "bg-muted/90 text-foreground"
                              )}>
                                <Sparkles className="h-2.5 w-2.5" />{score}%
                              </div>
                            ) : null;
                          })()}
                          {leadMatch.hasMatch && (
                            <button
                              onClick={(e) => { e.stopPropagation(); leadMatch.toggleImovel(imovelId); }}
                              className={cn(
                                "absolute top-3 right-3 z-20 p-1.5 rounded-full shadow-sm backdrop-blur-sm transition-all",
                                leadMatch.matchedCodigos.has(imovelId)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background/70 text-muted-foreground hover:bg-background"
                              )}
                            >
                              <Bookmark className={cn("h-4 w-4", leadMatch.matchedCodigos.has(imovelId) && "fill-current")} />
                            </button>
                          )}
                          <PropertyCardGrid item={item} idx={idx} isCampanha={isCampanha} selectMode={selectMode} isSelected={selectedIds.has(imovelId)} onToggleSelect={toggleSelect} onFavorite={toggleFavorite} isFavorite={favorites.has(imovelId)} getPreco={getPreco} onPreview={openPreview} />
                        </div>
                      );
                    })}
                  </div>
                  {totalPages > 1 && !campanhaAtiva && (
                    <div className="flex items-center justify-center gap-3 pt-6 pb-2">
                      <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1)} className="gap-1 rounded-full"><ChevronLeft className="h-4 w-4" /> Anterior</Button>
                      <span className="text-sm text-muted-foreground font-medium tabular-nums">{page} de {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => fetchPage(page + 1)} className="gap-1 rounded-full">Próxima <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Mobile fixed selection bar ── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 md:hidden safe-bottom">
          <div className="bg-background/95 backdrop-blur-md border-t border-border/60 px-4 py-3 flex items-center gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">
                {selectedIds.size} imóve{selectedIds.size === 1 ? "l" : "is"}
              </p>
              <p className="text-[10px] text-muted-foreground">selecionado{selectedIds.size > 1 ? "s" : ""}</p>
            </div>
            {vitrineLink ? (
              <>
                <Button
                  size="sm" variant="outline"
                  onClick={() => { navigator.clipboard.writeText(vitrineLink); toast.success("Link copiado!"); }}
                  className="h-9 px-3 gap-1.5 rounded-lg text-xs font-semibold shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Confira esta seleção de imóveis: ${vitrineLink}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => { if (hasLeadContext) trackEvent({ event_type: "vitrine_sent", payload: { link: vitrineLink, channel: "whatsapp" } }); }}
                >
                  <Button size="sm" className="h-9 px-3 gap-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </a>
              </>
            ) : (
              <Button
                size="sm" disabled={creatingVitrine}
                onClick={async () => {
                  if (!user) return;
                  setCreatingVitrine(true);
                  try {
                    const { data, error } = await supabase.from("vitrines").insert({ created_by: user.id, titulo: "Seleção de Imóveis", tipo: "property_selection", imovel_ids: [...selectedIds] as any }).select("id").single();
                    if (error) throw error;
                    const link = getVitrinePublicUrl(data.id);
                    setVitrineLink(link); navigator.clipboard.writeText(link); toast.success("Vitrine criada! Link copiado.");
                    if (hasLeadContext) trackEvent({ event_type: "vitrine_created", vitrine_id: data.id, payload: { imovel_ids: [...selectedIds], link } });
                  } catch { toast.error("Erro ao criar vitrine"); } finally { setCreatingVitrine(false); }
                }}
                className="h-9 px-4 gap-1.5 rounded-lg text-xs font-bold shrink-0"
              >
                {creatingVitrine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Gerar Vitrine
              </Button>
            )}
          </div>
        </div>
      )}
      {/* Lead Match floating counter */}
      {leadMatch.hasMatch && leadMatch.matchedCodigos.size > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-primary text-primary-foreground rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
            <Bookmark className="h-4 w-4 fill-current shrink-0" />
            <span className="text-sm font-medium">
              {leadMatch.matchedCodigos.size} imóve{leadMatch.matchedCodigos.size === 1 ? "l" : "is"} para {leadMatch.matchedLead!.nome}
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="text-xs h-7 px-3"
              onClick={() => setMatchConfirmOpen(true)}
            >
              Salvar Indicação
            </Button>
          </div>
        </div>
      )}

      {/* Lead Search Modal */}
      <LeadSearchModal
        open={leadSearchOpen}
        onOpenChange={setLeadSearchOpen}
        onSelect={(lead) => {
          leadMatch.selectLead(lead);
          // Auto-populate filters from lead profile if available
          if (lead.bairro_regiao) {
            setBairro([lead.bairro_regiao]);
          }
        }}
      />

      {/* Match Confirm Modal */}
      <MatchConfirmModal
        open={matchConfirmOpen}
        onOpenChange={setMatchConfirmOpen}
        leadNome={leadMatch.matchedLead?.nome || ""}
        imoveis={displayImoveis.filter(item => {
          const id = String(item.codigo || item.id_imovel || item.id);
          return leadMatch.matchedCodigos.has(id);
        })}
        getPreco={getPreco}
        saving={leadMatch.saving}
        onConfirm={async (obs) => {
          const ok = await leadMatch.saveIndicacoes(obs);
          if (ok) setMatchConfirmOpen(false);
        }}
      />
    </div>
  );
}
