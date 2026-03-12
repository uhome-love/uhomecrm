import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypesenseSearchParams {
  q?: string;
  page?: number;
  per_page?: number;
  filter_by?: string;
  sort_by?: string;
  autocomplete?: boolean;
}

interface SearchResult {
  data: any[];
  total: number;
  totalPages: number;
  page: number;
  search_time_ms?: number;
}

interface Suggestion {
  type: string;
  value: string;
}

/**
 * Build Typesense filter_by string from structured filters.
 */
export function buildFilterBy(filters: {
  contrato?: string;
  tipo?: string;
  bairro?: string;
  dormitorios?: string;
  suites?: string;
  vagas?: string;
  valorRange?: [number, number];
  areaRange?: [number, number];
  somenteObras?: boolean;
  uhomeOnly?: boolean;
}): string {
  const parts: string[] = [];

  if (filters.bairro) {
    parts.push(`bairro:=${filters.bairro}`);
  }
  if (filters.tipo && filters.tipo !== "all") {
    parts.push(`tipo:=${filters.tipo}`);
  }
  if (filters.dormitorios && filters.dormitorios !== "all") {
    parts.push(`dormitorios:>=${filters.dormitorios}`);
  }
  if (filters.suites && filters.suites !== "all") {
    parts.push(`suites:>=${filters.suites}`);
  }
  if (filters.vagas && filters.vagas !== "all") {
    parts.push(`vagas:>=${filters.vagas}`);
  }
  if (filters.valorRange) {
    const [min, max] = filters.valorRange;
    const field = filters.contrato === "locacao" ? "valor_locacao" : "valor_venda";
    if (min > 0) parts.push(`${field}:>=${min}`);
    if (max < 5_000_000) parts.push(`${field}:<=${max}`);
  }
  if (filters.areaRange) {
    const [min, max] = filters.areaRange;
    if (min > 0) parts.push(`area_privativa:>=${min}`);
    if (max < 500) parts.push(`area_privativa:<=${max}`);
  }
  if (filters.somenteObras) {
    parts.push(`em_obras:=true`);
  }
  if (filters.uhomeOnly) {
    parts.push(`is_uhome:=true`);
  }

  return parts.join(" && ");
}

/**
 * Convert sort option to Typesense sort_by.
 */
export function buildSortBy(sortBy: string, contrato?: string): string {
  switch (sortBy) {
    case "menor_preco":
      return contrato === "locacao" ? "valor_locacao:asc" : "valor_venda:asc";
    case "maior_preco":
      return contrato === "locacao" ? "valor_locacao:desc" : "valor_venda:desc";
    case "maior_area":
      return "area_privativa:desc";
    default:
      return "_text_match:desc,data_atualizacao:desc";
  }
}

export function useTypesenseSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (params: TypesenseSearchParams): Promise<SearchResult | null> => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("typesense-search", {
        body: params,
      });

      if (controller.signal.aborted) return null;

      if (fnErr) {
        throw new Error(fnErr.message || "Search failed");
      }

      return {
        data: data?.data || [],
        total: data?.total || 0,
        totalPages: data?.totalPages || 1,
        page: data?.page || 1,
        search_time_ms: data?.search_time_ms,
      };
    } catch (e: any) {
      if (e?.name === "AbortError" || controller.signal.aborted) return null;
      const msg = e?.message || "Erro na busca";
      setError(msg);
      console.error("Typesense search error:", msg);
      return null;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const autocomplete = useCallback(async (q: string): Promise<Suggestion[]> => {
    if (!q || q.length < 2) return [];

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("typesense-search", {
        body: { q, autocomplete: true },
      });

      if (fnErr) return [];
      return data?.suggestions || [];
    } catch {
      return [];
    }
  }, []);

  return { search, autocomplete, loading, error };
}
