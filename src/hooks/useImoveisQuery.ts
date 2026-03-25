/**
 * useImoveisQuery — React Query wrapper around fetchImoveis.
 * Provides cached, deduped, auto-refetching property data.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchImoveis, type ImoveisFilters, type ImoveisResult } from "@/services/imoveis";

const PAGE_SIZE = 20;

export function useImoveisQuery(filters: ImoveisFilters, enabled = true) {
  return useQuery<ImoveisResult>({
    queryKey: ["imoveis", "list", filters],
    queryFn: () => fetchImoveis(filters),
    staleTime: 3 * 60 * 1000,       // 3 min
    gcTime: 10 * 60 * 1000,         // 10 min
    placeholderData: (prev) => prev, // keep previous data during refetch
    enabled,
  });
}

export { PAGE_SIZE };
