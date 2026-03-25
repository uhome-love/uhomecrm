/**
 * usePostgRESTFacets — fetches distinct facet values from the properties table.
 * Drop-in replacement for useTypesenseFacets, using PostgREST instead.
 *
 * Returns bairro, tipo, construtora, empreendimento, situacao, and cidade facets
 * with the same { value, count } shape for backward compatibility.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Facet {
  value: string;
  count: number;
}

// ── Hardcoded fallbacks ──
const BAIRROS_FALLBACK: Facet[] = [
  "Auxiliadora", "Bela Vista", "Bom Fim", "Centro Histórico", "Cidade Baixa",
  "Higienópolis", "Independência", "Menino Deus", "Moinhos de Vento",
  "Mont'Serrat", "Petrópolis", "Rio Branco", "Santa Cecília",
  "Santana", "Três Figueiras", "Tristeza", "Vila Assunção",
].map(b => ({ value: b, count: 0 }));

const TIPOS_FALLBACK: Facet[] = [
  { value: "apartamento", count: 0 },
  { value: "casa", count: 0 },
  { value: "cobertura", count: 0 },
  { value: "terreno", count: 0 },
  { value: "comercial", count: 0 },
  { value: "studio", count: 0 },
];

// ── Cache ──
let cachedBairros: Facet[] | null = null;
let cachedTipos: Facet[] | null = null;
let cachedConstrutoras: Facet[] | null = null;
let cachedEmpreendimentos: Facet[] | null = null;
let cachedStatusImovel: Facet[] | null = null;
let cachedCidades: Facet[] | null = null;
const cachedBairrosByCidade: Record<string, Facet[]> = {};

export function usePostgRESTFacets() {
  const [bairroFacets, setBairroFacets] = useState<Facet[]>(cachedBairros || BAIRROS_FALLBACK);
  const [tipoFacets, setTipoFacets] = useState<Facet[]>(cachedTipos || TIPOS_FALLBACK);
  const [construtoraFacets, setConstrutoraFacets] = useState<Facet[]>(cachedConstrutoras || []);
  const [empreendimentoFacets, setEmpreendimentoFacets] = useState<Facet[]>(cachedEmpreendimentos || []);
  const [statusImovelFacets, setStatusImovelFacets] = useState<Facet[]>(cachedStatusImovel || []);
  const [cidadeFacets, setCidadeFacets] = useState<Facet[]>(cachedCidades || [{ value: "Porto Alegre", count: 0 }]);
  const [loading, setLoading] = useState(!cachedBairros);
  const fetched = useRef(!!cachedBairros);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    (async () => {
      try {
        // Fetch all facets in parallel
        const [bairrosRes, tiposRes, construtorasRes, empreendimentosRes, situacoesRes, cidadesRes] = await Promise.all([
          supabase.rpc("get_bairros_disponiveis"),
          supabase.from("properties").select("tipo").eq("ativo", true).not("tipo", "is", null),
          supabase.from("properties").select("construtora").eq("ativo", true).not("construtora", "is", null).not("construtora", "eq", ""),
          supabase.from("properties").select("empreendimento").eq("ativo", true).not("empreendimento", "is", null).not("empreendimento", "eq", ""),
          supabase.from("properties").select("situacao").eq("ativo", true).not("situacao", "is", null).not("situacao", "eq", ""),
          supabase.from("properties").select("cidade").eq("ativo", true).not("cidade", "is", null),
        ]);

        // Bairros (already grouped by RPC)
        if (bairrosRes.data?.length) {
          const bairros = bairrosRes.data.map((b: any) => ({ value: b.bairro, count: Number(b.count) || 0 }));
          cachedBairros = bairros;
          setBairroFacets(bairros);
        }

        // Aggregate tipos client-side
        if (tiposRes.data?.length) {
          const map = new Map<string, number>();
          for (const r of tiposRes.data) { map.set(r.tipo, (map.get(r.tipo) || 0) + 1); }
          const tipos = [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, "pt-BR"));
          cachedTipos = tipos;
          setTipoFacets(tipos);
        }

        // Aggregate construtoras
        if (construtorasRes.data?.length) {
          const map = new Map<string, number>();
          for (const r of construtorasRes.data) { map.set(r.construtora, (map.get(r.construtora) || 0) + 1); }
          const construtoras = [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, "pt-BR"));
          cachedConstrutoras = construtoras;
          setConstrutoraFacets(construtoras);
        }

        // Aggregate empreendimentos
        if (empreendimentosRes.data?.length) {
          const map = new Map<string, number>();
          for (const r of empreendimentosRes.data) { map.set(r.empreendimento, (map.get(r.empreendimento) || 0) + 1); }
          const empreendimentos = [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, "pt-BR"));
          cachedEmpreendimentos = empreendimentos;
          setEmpreendimentoFacets(empreendimentos);
        }

        // Aggregate situações
        if (situacoesRes.data?.length) {
          const map = new Map<string, number>();
          for (const r of situacoesRes.data) { map.set(r.situacao, (map.get(r.situacao) || 0) + 1); }
          const situacoes = [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, "pt-BR"));
          cachedStatusImovel = situacoes;
          setStatusImovelFacets(situacoes);
        }

        // Aggregate cidades
        if (cidadesRes.data?.length) {
          const map = new Map<string, number>();
          for (const r of cidadesRes.data) { map.set(r.cidade, (map.get(r.cidade) || 0) + 1); }
          const cidades = [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, "pt-BR"));
          cachedCidades = cidades;
          setCidadeFacets(cidades);
        }
      } catch (err) {
        console.warn("PostgREST facets fetch failed, using fallback:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Fetch bairro facets filtered by selected cities.
   */
  const fetchBairrosByCidade = useCallback(async (cidades: string[]): Promise<Facet[]> => {
    if (!cidades.length) return cachedBairros || BAIRROS_FALLBACK;
    const cacheKey = cidades.sort().join("|");
    if (cachedBairrosByCidade[cacheKey]) return cachedBairrosByCidade[cacheKey];

    try {
      const { data, error } = await supabase.rpc("get_bairros_disponiveis", {
        p_cidade: cidades.length === 1 ? cidades[0] : null,
        p_cidades: cidades.length > 1 ? cidades : undefined,
      });

      if (error || !data?.length) return cachedBairros || BAIRROS_FALLBACK;

      const bairros = data.map((b: any) => ({ value: b.bairro, count: Number(b.count) || 0 }));
      cachedBairrosByCidade[cacheKey] = bairros;
      return bairros;
    } catch {
      return cachedBairros || BAIRROS_FALLBACK;
    }
  }, []);

  return {
    bairroFacets,
    tipoFacets,
    construtoraFacets,
    empreendimentoFacets,
    statusImovelFacets,
    cidadeFacets,
    fetchBairrosByCidade,
    facetsLoading: loading,
  };
}

// Re-export for backward compat
export type BairroFacet = Facet;
