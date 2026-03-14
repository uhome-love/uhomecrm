/**
 * useBairroFacets — fetches distinct bairro values + counts from Typesense.
 *
 * Makes a single lightweight facet-only request on mount.
 * Returns sorted list of { value, count } with hardcoded fallback on failure.
 * Cache: session-scoped module-level Map to avoid re-fetching on re-mounts.
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BairroFacet {
  value: string;
  count: number;
}

// Hardcoded fallback (same list that was in useImoveisFilters)
const BAIRROS_POA_FALLBACK = [
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
];

const FALLBACK_FACETS: BairroFacet[] = BAIRROS_POA_FALLBACK.map(b => ({ value: b, count: 0 }));

// Module-level cache so remounts don't re-fetch
let cachedFacets: BairroFacet[] | null = null;

export function useBairroFacets() {
  const [facets, setFacets] = useState<BairroFacet[]>(cachedFacets || FALLBACK_FACETS);
  const [loading, setLoading] = useState(!cachedFacets);
  const fetched = useRef(!!cachedFacets);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("typesense-search", {
          body: {
            q: "*",
            per_page: 0,
            facet_by: "bairro",
            max_facet_values: 200,
          },
        });

        if (error || !data?.facet_counts) {
          console.warn("Bairro facets: using fallback", error);
          return;
        }

        const bairroFacet = data.facet_counts.find(
          (fc: any) => fc.field_name === "bairro"
        );
        if (!bairroFacet?.counts?.length) return;

        const dynamicFacets: BairroFacet[] = bairroFacet.counts
          .filter((c: any) => c.value && c.value.trim())
          .map((c: any) => ({ value: c.value, count: c.count || 0 }))
          .sort((a: BairroFacet, b: BairroFacet) => a.value.localeCompare(b.value, "pt-BR"));

        if (dynamicFacets.length > 0) {
          cachedFacets = dynamicFacets;
          setFacets(dynamicFacets);
        }
      } catch (err) {
        console.warn("Bairro facets fetch failed, using fallback:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { bairroFacets: facets, bairroFacetsLoading: loading };
}
