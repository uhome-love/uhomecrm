/**
 * useImoveisSearch — manages all search, fetch, pagination, and autocomplete
 * for the Imóveis page.
 *
 * Now uses PostgREST (Supabase) instead of Typesense.
 * Keeps the same public API for backward compatibility with ImoveisPage.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchImoveis, type ImoveisFilters } from "@/services/imoveis";
import { gerarSlugUhome } from "@/services/siteImoveis";
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
    construtora: string[];
    empreendimento: string[];
    situacao: string[];
    cidade: string[];
    codigoBusca: string;
  };
  filterKey: string;
  setSearch: (v: string) => void;
  setBairro: (fn: (prev: string[]) => string[]) => void;
  setCampanhaAtiva: (v: boolean) => void;
  setUhomeOnly: (v: boolean) => void;
  showFavoritesOnly: boolean;
  favorites: Set<string>;
}

const PAGE_SIZE = 24;

/**
 * Map a PostgREST property row to the format expected by PropertyCards.
 * Adds compatibility fields (titulo_anuncio, endereco_bairro, garagens, etc.)
 */
function mapPropertyRow(row: any): any {
  const fotos = row.fotos || [];
  const fotosFull = row.fotos_full || fotos;

  // Generate canonical slug for share URLs (properties table has no slug column)
  const slug = row.slug || gerarSlugUhome({
    tipo: row.tipo || "imovel",
    quartos: row.dormitorios != null ? Number(row.dormitorios) : null,
    bairro: row.bairro || "",
    codigo: row.codigo || "",
  });

  return {
    ...row,
    slug,
    // Compatibility aliases used by PropertyCards / imovelHelpers
    titulo_anuncio: row.titulo,
    empreendimento_nome: row.empreendimento,
    endereco_bairro: row.bairro,
    endereco_cidade: row.cidade,
    endereco_logradouro: row.endereco,
    garagens: row.vagas,
    valor: row.valor_venda,
    area_util: row.area_privativa,
    // Normalized photo arrays
    _fotos_normalized: fotos,
    _fotos_full: fotosFull,
    foto_principal: fotos[0] || null,
    imagens: fotos.map((url: string, i: number) => ({
      link_thumb: url,
      link: fotosFull[i] || url,
      link_large: fotosFull[i] || url,
    })),
  };
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
      try {
        // Search bairros via RPC
        const { data: bairros } = await supabase.rpc("get_bairros_disponiveis", {
          p_cidade: filters.cidade.length === 1 ? filters.cidade[0] : null,
        });

        const q = value.toLowerCase();
        const matched: Suggestion[] = [];

        // Filter bairros matching query
        if (bairros) {
          for (const b of bairros) {
            if (b.bairro.toLowerCase().includes(q)) {
              matched.push({ type: "bairro", value: b.bairro });
              if (matched.length >= 5) break;
            }
          }
        }

        // Also search properties by codigo
        const { data: codeMatches } = await supabase
          .from("properties")
          .select("codigo")
          .eq("ativo", true)
          .or(`codigo.ilike.%${value}%,titulo.ilike.%${value}%`)
          .limit(3);

        if (codeMatches) {
          for (const cm of codeMatches) {
            matched.push({ type: "codigo", value: cm.codigo });
          }
        }

        if (matched.length > 0) {
          setSuggestions(matched);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }, [setSearch, filters.cidade]);

  // ── Race-condition protection ──
  const fetchSeqRef = useRef(0);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  

  // ── Convert hook filters → PostgREST filters ──
  const buildQueryFilters = useCallback((pageNum: number): ImoveisFilters => {
    const f: ImoveisFilters = {
      limit: PAGE_SIZE,
      offset: (pageNum - 1) * PAGE_SIZE,
    };

    // Cidade
    if (filters.cidade.length === 1) {
      f.cidade = filters.cidade[0];
    } else if (filters.cidade.length > 1) {
      f.cidades = filters.cidade;
    }

    // Tipo
    if (filters.tipo.length > 0) {
      f.tipos = filters.tipo;
    }

    // Bairro
    if (filters.bairro.length > 0) {
      f.bairros = filters.bairro;
    }

    // Preço
    if (filters.valorRange[0] > 0) f.precoMin = filters.valorRange[0];
    if (filters.valorRange[1] < 5_000_000) f.precoMax = filters.valorRange[1];

    // Área
    if (filters.areaRange[0] > 0) f.areaMin = filters.areaRange[0];
    if (filters.areaRange[1] < 500) f.areaMax = filters.areaRange[1];

    // Quartos
    if (filters.dormitorios.length > 0) {
      f.quartos = Math.min(...filters.dormitorios.map(Number));
    }

    // Vagas
    if (filters.vagas && filters.vagas !== "all") {
      f.vagas = Number(filters.vagas);
    }

    // Banheiros (suites as proxy for now)
    if (filters.suitesFilter && filters.suitesFilter !== "all") {
      f.banheiros = Number(filters.suitesFilter);
    }

    // Search
    if (filters.search) {
      f.q = filters.search;
    }

    // Código
    if (filters.codigoBusca) {
      f.codigo = filters.codigoBusca;
    }

    // Sort
    switch (filters.sortBy) {
      case "menor_preco":
        f.ordem = "preco_asc";
        break;
      case "maior_preco":
        f.ordem = "preco_desc";
        break;
      case "maior_area":
        f.ordem = "area_desc";
        break;
      default:
        f.ordem = "recentes";
    }

    return f;
  }, [filters]);

  // ── PostgREST fetch ──
  const fetchViaPostgREST = useCallback(async (pageNum: number, seq: number): Promise<"ok" | "aborted" | "error"> => {
    const attempt = async (): Promise<"ok" | "aborted" | "error"> => {
      try {
        const startTime = Date.now();
        const queryFilters = buildQueryFilters(pageNum);
        const result = await fetchImoveis(queryFilters);

        if (seq !== fetchSeqRef.current) return "aborted";

        const elapsed = Date.now() - startTime;
        const mapped = result.data.map(mapPropertyRow);
        setImoveis(mapped);
        setTotal(result.count);
        setTotalPages(Math.max(1, Math.ceil(result.count / PAGE_SIZE)));
        setPage(pageNum);
        setSearchTimeMs(elapsed);
        return "ok";
      } catch (err) {
        if (seq !== fetchSeqRef.current) return "aborted";
        console.error("PostgREST fetch error:", err);
        return "error";
      }
    };

    const first = await attempt();
    if (first === "error") {
      // Retry once after 500ms
      await new Promise(r => setTimeout(r, 500));
      if (seq !== fetchSeqRef.current) return "aborted";
      return attempt();
    }
    return first;
  }, [buildQueryFilters]);

  // ── Campanha fetch (unchanged) ──
  const fetchCampanha = useCallback(() => {
    const items = campanhaOverrides.map(ov => ({
      codigo: ov.codigo,
      titulo_anuncio: ov.nome || ov.codigo,
      titulo: ov.nome || ov.codigo,
      empreendimento_nome: ov.nome || ov.codigo,
      empreendimento: ov.nome || ov.codigo,
      endereco_bairro: ov.bairro || "",
      bairro: ov.bairro || "",
      valor_venda: ov.valor_min || 0,
      valor_max: ov.valor_max || 0,
      dormitorios: ov.dormitorios || 0,
      descricao: ov.descricao || "",
      situacao: ov.status_obra || "Lançamento",
      previsao_entrega: ov.previsao_entrega || "",
      foto_principal: ov.fotos?.[0] || "",
      fotos: ov.fotos || [],
      imagens: (ov.fotos || []).map(url => ({ link: url, link_thumb: url, link_large: url })),
      _fotos_normalized: ov.fotos || [],
      _is_campanha_override: true,
    }));
    setImoveis(items as any[]);
    setTotal(items.length);
    setTotalPages(1);
    setPage(1);
  }, [campanhaOverrides]);

  // ── Main fetch orchestrator ──
  const fetchImoveisMain = useCallback(async (pageNum: number, campanha = filters.campanhaAtiva) => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setSearchTimeMs(null);
    setFetchError(null);

    try {
      if (campanha) {
        fetchCampanha();
        return;
      }

      const result = await fetchViaPostgREST(pageNum, seq);
      if (result === "aborted") return;
      if (result === "error") {
        setFetchError("Erro ao carregar imóveis. Tente novamente.");
        setImoveis([]);
        setTotal(0);
        setTotalPages(1);
      }
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
  }, [filters.campanhaAtiva, fetchViaPostgREST, fetchCampanha]);

  // Stable ref to latest fetch function
  const fetchRef = useRef(fetchImoveisMain);
  fetchRef.current = fetchImoveisMain;

  // ── Initial load ──
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    fetchRef.current(1);
  }, []);

  // ── Reactive debounced filter application ──
  const prevFilterKey = useRef(filterKey);
  const immediateNextFetch = useRef(false);
  useEffect(() => {
    if (!mounted.current) return;
    if (prevFilterKey.current === filterKey) return;
    prevFilterKey.current = filterKey;

    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);

    const delay = immediateNextFetch.current ? 50 : 400;
    immediateNextFetch.current = false;

    filterDebounceRef.current = setTimeout(() => {
      fetchRef.current(1);
    }, delay);
    return () => { if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current); };
  }, [filterKey]);

  // ── Immediate search (Enter / button click) ──
  const handleSearch = useCallback(() => {
    setShowSuggestions(false);
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Mark next filter change to fetch immediately (no 400ms debounce)
    immediateNextFetch.current = true;
    setCampanhaAtiva(false);
    setUhomeOnly(false);
    // Force filterKey change by toggling campanhaAtiva/uhomeOnly — this triggers the effect above.
    // If search hasn't changed other filters, we still need to force a fetch:
    // Use a microtask to check if effect already ran, if not force it
    Promise.resolve().then(() => {
      // If the effect didn't fire (filterKey unchanged), force fetch directly
      if (immediateNextFetch.current) {
        immediateNextFetch.current = false;
        fetchRef.current(1);
      }
    });
  }, [setCampanhaAtiva, setUhomeOnly]);

  // ── Suggestion click ──
  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    if (suggestion.type === "bairro") {
      setBairro(prev => prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]);
      setSearch("");
    } else {
      setSearch(suggestion.value);
      // Mark for immediate fetch on next filterKey change
      immediateNextFetch.current = true;
    }
  }, [setBairro, setSearch]);

  // ── Client-side sort + favorites filter ──
  const sortedImoveis = useMemo(() => {
    try {
      let items = [...(Array.isArray(imoveis) ? imoveis : [])];
      if (showFavoritesOnly) items = items.filter(item => favorites.has(String(item?.codigo || item?.id_imovel || item?.id)));
      if (filters.somenteObras) items = items.filter(item => extractEntrega(item).emObras);

      // PostgREST already sorts server-side, but apply client sort for edge cases
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
    imoveis,
    loading,
    fetchError,
    page,
    totalPages,
    total,
    searchTimeMs,
    sortedImoveis,
    campanhaOverrides,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    handleSearchChange,
    handleSuggestionClick,
    handleSearch,
    fetchPage,
    fetchRef,
  };
}
