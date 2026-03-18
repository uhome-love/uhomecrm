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
  tipo?: string | string[];
  bairro?: string | string[];
  dormitorios?: string | string[];
  suites?: string;
  vagas?: string;
  valorRange?: [number, number];
  areaRange?: [number, number];
  somenteObras?: boolean;
  uhomeOnly?: boolean;
  construtora?: string | string[];
  empreendimento?: string | string[];
  situacao?: string | string[];
}): string {
  const parts: string[] = [];

  // Filter by contrato: ensure we only show properties with the relevant price > 0
  if (filters.contrato === "locacao") {
    parts.push(`valor_locacao:>0`);
  } else if (filters.contrato === "venda") {
    parts.push(`valor_venda:>0`);
  }

  // Multi-select bairro
  const bairros = Array.isArray(filters.bairro) ? filters.bairro : (filters.bairro ? [filters.bairro] : []);
  if (bairros.length === 1) {
    parts.push(`bairro:=${bairros[0]}`);
  } else if (bairros.length > 1) {
    parts.push(`bairro:[${bairros.join(",")}]`);
  }

  // Multi-select tipo
  const tipos = Array.isArray(filters.tipo) ? filters.tipo.filter(t => t && t !== "all") : (filters.tipo && filters.tipo !== "all" ? [filters.tipo] : []);
  if (tipos.length === 1) {
    parts.push(`tipo:=${tipos[0]}`);
  } else if (tipos.length > 1) {
    parts.push(`tipo:[${tipos.join(",")}]`);
  }

  // Multi-select dormitorios — exact match for selected values
  const dorms = Array.isArray(filters.dormitorios) ? filters.dormitorios.filter(d => d && d !== "all") : (filters.dormitorios && filters.dormitorios !== "all" ? [filters.dormitorios] : []);
  if (dorms.length === 1) {
    parts.push(`dormitorios:=${dorms[0]}`);
  } else if (dorms.length > 1) {
    parts.push(`dormitorios:[${dorms.join(",")}]`);
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
  // Situação multi-select (pronto, em_obras, lancamento)
  const situacoes = Array.isArray(filters.situacao) ? filters.situacao.filter(Boolean) : (filters.situacao ? [filters.situacao] : []);
  if (situacoes.length > 0) {
    // Map UI values to Typesense field values
    const hasPronto = situacoes.includes("pronto");
    const hasObras = situacoes.includes("em_obras") || situacoes.includes("lancamento");
    if (hasPronto && !hasObras) parts.push(`em_obras:=false`);
    else if (hasObras && !hasPronto) parts.push(`em_obras:=true`);
    // If both, no filter needed
  }
  if (filters.uhomeOnly) {
    parts.push(`is_uhome:=true`);
  }

  // Multi-select construtora
  const construtoras = Array.isArray(filters.construtora) ? filters.construtora.filter(Boolean) : (filters.construtora ? [filters.construtora] : []);
  if (construtoras.length === 1) {
    parts.push(`construtora:=${construtoras[0]}`);
  } else if (construtoras.length > 1) {
    parts.push(`construtora:[${construtoras.join(",")}]`);
  }

  // Multi-select empreendimento
  const empreendimentos = Array.isArray(filters.empreendimento) ? filters.empreendimento.filter(Boolean) : (filters.empreendimento ? [filters.empreendimento] : []);
  if (empreendimentos.length === 1) {
    parts.push(`empreendimento:=${empreendimentos[0]}`);
  } else if (empreendimentos.length > 1) {
    parts.push(`empreendimento:[${empreendimentos.join(",")}]`);
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
