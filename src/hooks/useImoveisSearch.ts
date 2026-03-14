/**
 * useImoveisSearch — manages all search, fetch, pagination, and autocomplete
 * for the Imóveis page.
 *
 * Responsibilities:
 *  - Typesense search (primary) with Jetimob-proxy fallback
 *  - Request sequencing (fetchSeqRef) to prevent stale responses
 *  - AbortController for in-flight cancellation
 *  - Campanha overrides loading
 *  - Debounced reactive filter application
 *  - Immediate search (handleSearch)
 *  - Autocomplete with debounce
 *  - Client-side sorting + favorites filtering (sortedImoveis)
 *  - Pagination state
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTypesenseSearch, buildFilterBy, buildSortBy } from "@/hooks/useTypesenseSearch";
import { mapTypesenseDocs } from "@/lib/typesenseMapping";
import { extractEntrega, getNum, getNumIncZero } from "@/lib/imovelHelpers";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */

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

export interface CampanhaOverride {
  codigo: string;
  nome: string;
  fotos: string[];
  valor_min: number | null;
  valor_max: number | null;
  bairro: string | null;
  dormitorios: number | null;
  descricao: string | null;
  status_obra: string | null;
  previsao_entrega: string | null;
}

export interface Suggestion {
  type: string;
  value: string;
}

interface UseImoveisSearchParams {
  /** All filter values needed for queries */
  filters: {
    search: string;
    contrato: string;
    tipo: string[];
    bairro: string[];
    dormitorios: string[];
    suitesFilter: string;
    vagas: string;
    areaRange: [number, number];
    valorRange: [number, number];
    somenteObras: boolean;
    uhomeOnly: boolean;
    campanhaAtiva: boolean;
    sortBy: string;
  };
  /** Serialized filter key for change-detection */
  filterKey: string;
  /** Setters the search hook needs to call back into filters */
  setSearch: (v: string) => void;
  setBairro: (fn: (prev: string[]) => string[]) => void;
  setCampanhaAtiva: (v: boolean) => void;
  setUhomeOnly: (v: boolean) => void;
  /** For favorites filtering in sortedImoveis */
  showFavoritesOnly: boolean;
  favorites: Set<string>;
}

export function useImoveisSearch({
  filters,
  filterKey,
  setSearch,
  setBairro,
  setCampanhaAtiva,
  setUhomeOnly,
  showFavoritesOnly,
  favorites,
}: UseImoveisSearchParams) {
  const { search: typesenseSearch, autocomplete: typesenseAutocomplete } = useTypesenseSearch();

  // ── Result state ──
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTimeMs, setSearchTimeMs] = useState<number | null>(null);

  // ── Campanha overrides ──
  const [campanhaOverrides, setCampanhaOverrides] = useState<CampanhaOverride[]>([]);

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
        setCampanhaOverrides(CAMPANHA_CODES_FALLBACK.map(c => ({
          codigo: c.codigo, nome: c.nome, fotos: [],
          valor_min: null, valor_max: null, bairro: null, dormitorios: null,
          descricao: null, status_obra: null, previsao_entrega: null,
        })));
      }
    });
  }, []);

  // ── Autocomplete ──
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [typesenseAutocomplete, setSearch]);

  // ── Race-condition protection ──
  const abortRef = useRef<AbortController | null>(null);
  const fetchSeqRef = useRef(0);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextDebounce = useRef(false);

  // ── Typesense fetch ──
  const fetchViaTypesense = useCallback(async (pageNum: number, seq: number): Promise<"ok" | "aborted" | "error"> => {
    try {
      const filterBy = buildFilterBy({
        contrato: filters.contrato,
        tipo: filters.tipo,
        bairro: filters.bairro,
        dormitorios: filters.dormitorios,
        suites: filters.suitesFilter,
        vagas: filters.vagas,
        valorRange: filters.valorRange,
        areaRange: filters.areaRange,
        somenteObras: filters.somenteObras,
        uhomeOnly: filters.uhomeOnly,
      });
      const sortByStr = filters.search ? "" : buildSortBy(filters.sortBy, filters.contrato);

      const result = await typesenseSearch({
        q: filters.search || "*",
        page: pageNum,
        per_page: 24,
        filter_by: filterBy || undefined,
        sort_by: sortByStr || undefined,
      });

      if (seq !== fetchSeqRef.current) return "aborted";
      if (!result) return "aborted";

      const items = mapTypesenseDocs(result.data || []);
      setImoveis(items);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);
      setPage(pageNum);
      setSearchTimeMs(result.search_time_ms || null);
      return "ok";
    } catch (err) {
      if (seq !== fetchSeqRef.current) return "aborted";
      console.error("Typesense fetch error:", err);
      return "error";
    }
  }, [filters.search, filters.contrato, filters.tipo, filters.bairro, filters.dormitorios, filters.suitesFilter, filters.vagas, filters.areaRange, filters.valorRange, filters.somenteObras, filters.uhomeOnly, filters.sortBy, typesenseSearch]);

  // ── Jetimob fallback ──
  const fetchViaJetimob = useCallback(async (pageNum: number, campanha = filters.campanhaAtiva, uhome = filters.uhomeOnly) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (campanha) {
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
        const valorMin = filters.valorRange[0] > 0 ? String(filters.valorRange[0]) : undefined;
        const valorMax = filters.valorRange[1] < 5_000_000 ? String(filters.valorRange[1]) : undefined;
        const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
          body: {
            action: "list_imoveis", page: pageNum, pageSize: 24,
            search: filters.search || undefined,
            contrato: filters.contrato || undefined,
            tipo: filters.tipo.length ? filters.tipo.join(",") : undefined,
            cidade: "Porto Alegre",
            bairro: filters.bairro.length ? filters.bairro.join(",") : undefined,
            search_uhome: uhome ? true : undefined,
            dormitorios: filters.dormitorios.length ? filters.dormitorios[0] : undefined,
            suites: filters.suitesFilter && filters.suitesFilter !== "all" ? filters.suitesFilter : undefined,
            vagas: filters.vagas && filters.vagas !== "all" ? filters.vagas : undefined,
            area_min: filters.areaRange[0] > 0 ? String(filters.areaRange[0]) : undefined,
            area_max: filters.areaRange[1] < 500 ? String(filters.areaRange[1]) : undefined,
            valor_min: valorMin, valor_max: valorMax,
            somente_obras: filters.somenteObras || undefined,
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
  }, [filters.search, filters.contrato, filters.tipo, filters.bairro, filters.dormitorios, filters.suitesFilter, filters.vagas, filters.areaRange, filters.valorRange, filters.somenteObras, filters.campanhaAtiva, filters.uhomeOnly, campanhaOverrides]);

  // ── Main fetch orchestrator ──
  const fetchImoveis = useCallback(async (pageNum: number, campanha = filters.campanhaAtiva, uhome = filters.uhomeOnly) => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setSearchTimeMs(null);
    setFetchError(null);

    try {
      if (campanha) {
        await fetchViaJetimob(pageNum, campanha, uhome);
        if (seq !== fetchSeqRef.current) return;
        return;
      }

      const tsResult = await fetchViaTypesense(pageNum, seq);
      if (tsResult === "aborted") return;
      if (tsResult === "ok") return;

      console.warn("Typesense error, falling back to jetimob-proxy");
      await fetchViaJetimob(pageNum, campanha, uhome);
    } catch (err: any) {
      if (seq !== fetchSeqRef.current) return;
      console.error("fetchImoveis critical error:", err);
      setFetchError(err?.message || "Erro ao buscar imóveis");
      setImoveis([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [filters.campanhaAtiva, filters.uhomeOnly, fetchViaTypesense, fetchViaJetimob]);

  // Stable ref to latest fetch function
  const fetchRef = useRef(fetchImoveis);
  fetchRef.current = fetchImoveis;

  // ── Initial load ──
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    fetchRef.current(1, false);
  }, []);

  // ── Reactive debounced filter application ──
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (!mounted.current) return;
    if (prevFilterKey.current === filterKey) return;
    prevFilterKey.current = filterKey;

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

  // ── Immediate search (Enter / button click) ──
  const handleSearch = useCallback(() => {
    setShowSuggestions(false);
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    skipNextDebounce.current = true;
    setCampanhaAtiva(false);
    setUhomeOnly(false);
    requestAnimationFrame(() => {
      setTimeout(() => {
        prevFilterKey.current = JSON.stringify({
          search: filters.search, contrato: filters.contrato, tipo: filters.tipo,
          bairro: filters.bairro, dormitorios: filters.dormitorios, suitesFilter: filters.suitesFilter,
          vagas: filters.vagas, areaRange: filters.areaRange, valorRange: filters.valorRange,
          somenteObras: filters.somenteObras, sortBy: filters.sortBy,
          uhomeOnly: false, campanhaAtiva: false,
        });
        fetchRef.current(1);
      }, 0);
    });
  }, [filters, setCampanhaAtiva, setUhomeOnly]);

  // ── Suggestion click ──
  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
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
  }, [setBairro, setSearch]);

  // ── Client-side sort + favorites filter ──
  const sortedImoveis = useMemo(() => {
    try {
      let items = [...(Array.isArray(imoveis) ? imoveis : [])];
      if (showFavoritesOnly) items = items.filter(item => favorites.has(String(item?.codigo || item?.id_imovel || item?.id)));
      if (filters.somenteObras) items = items.filter(item => extractEntrega(item).emObras);

      if (filters.sortBy === "menor_preco") items.sort((a, b) => (getNum(a, "valor_venda", "valor") || 999999999) - (getNum(b, "valor_venda", "valor") || 999999999));
      else if (filters.sortBy === "maior_preco") items.sort((a, b) => (getNum(b, "valor_venda", "valor") || 0) - (getNum(a, "valor_venda", "valor") || 0));
      else if (filters.sortBy === "maior_area") items.sort((a, b) => (getNumIncZero(b, "area_privativa", "area_util") || 0) - (getNumIncZero(a, "area_privativa", "area_util") || 0));
      return items;
    } catch (err) {
      console.error("Sort error:", err);
      return [];
    }
  }, [imoveis, filters.sortBy, showFavoritesOnly, favorites, filters.somenteObras]);

  // ── Public API for pagination ──
  const fetchPage = useCallback((pageNum: number) => {
    fetchRef.current(pageNum);
  }, []);

  return {
    // Result state
    imoveis,
    loading,
    fetchError,
    page,
    totalPages,
    total,
    searchTimeMs,
    sortedImoveis,
    // Campanha
    campanhaOverrides,
    // Autocomplete
    suggestions,
    showSuggestions,
    setShowSuggestions,
    handleSearchChange,
    handleSuggestionClick,
    // Actions
    handleSearch,
    fetchPage,
    fetchRef,
  };
}
