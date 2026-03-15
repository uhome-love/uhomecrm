/**
 * useTypesenseFacets — fetches distinct facet values + counts from Typesense.
 *
 * Makes a single lightweight facet-only request on mount for multiple fields
 * (bairro, tipo). Returns sorted lists of { value, count } with hardcoded
 * fallbacks on failure.
 *
 * Cache: session-scoped module-level variables to avoid re-fetching on re-mounts.
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Facet {
  value: string;
  count: number;
}

// ── Hardcoded fallbacks ──

const BAIRROS_FALLBACK: Facet[] = [
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
].map(b => ({ value: b, count: 0 }));

const TIPOS_FALLBACK: Facet[] = [
  { value: "apartamento", count: 0 },
  { value: "casa", count: 0 },
  { value: "cobertura", count: 0 },
  { value: "terreno", count: 0 },
  { value: "comercial", count: 0 },
  { value: "loft", count: 0 },
  { value: "kitnet", count: 0 },
];

// ── Module-level cache ──
let cachedBairros: Facet[] | null = null;
let cachedTipos: Facet[] | null = null;

function parseFacetField(facetCounts: any[], fieldName: string): Facet[] {
  const fc = facetCounts.find((f: any) => f.field_name === fieldName);
  if (!fc?.counts?.length) return [];
  return fc.counts
    .filter((c: any) => c.value && c.value.trim())
    .map((c: any) => ({ value: c.value, count: c.count || 0 }))
    .sort((a: Facet, b: Facet) => a.value.localeCompare(b.value, "pt-BR"));
}

export function useTypesenseFacets() {
  const [bairroFacets, setBairroFacets] = useState<Facet[]>(cachedBairros || BAIRROS_FALLBACK);
  const [tipoFacets, setTipoFacets] = useState<Facet[]>(cachedTipos || TIPOS_FALLBACK);
  const [loading, setLoading] = useState(!cachedBairros);
  const fetched = useRef(!!cachedBairros);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("typesense-search", {
          body: {
            q: "*",
            per_page: 0,
            facet_by: "bairro,tipo",
            max_facet_values: 200,
          },
        });

        if (error || !data?.facet_counts) {
          console.warn("Typesense facets: using fallback", error);
          return;
        }

        const bairros = parseFacetField(data.facet_counts, "bairro");
        if (bairros.length > 0) {
          cachedBairros = bairros;
          setBairroFacets(bairros);
        }

        const tipos = parseFacetField(data.facet_counts, "tipo");
        if (tipos.length > 0) {
          cachedTipos = tipos;
          setTipoFacets(tipos);
        }
      } catch (err) {
        console.warn("Typesense facets fetch failed, using fallback:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { bairroFacets, tipoFacets, facetsLoading: loading };
}

// Re-export Facet type as BairroFacet for backward compatibility
export type BairroFacet = Facet;
