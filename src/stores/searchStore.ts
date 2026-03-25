/**
 * searchStore.ts — Zustand store for property search state.
 * Mirrors the site's architecture: filters + pagination + UI state.
 */

import { create } from "zustand";

export interface MapBounds {
  lat_min: number;
  lat_max: number;
  lng_min: number;
  lng_max: number;
}

export interface SearchFilters {
  tipo: string;           // comma-separated multi-select
  bairro: string;         // comma-separated multi-select
  cidade: string;
  precoMin: number;
  precoMax: number;
  areaMin: number;
  areaMax: number;
  quartos: number;
  banheiros: number;
  vagas: number;
  diferenciais: string[];
  ordem: "recentes" | "preco_asc" | "preco_desc" | "area_desc";
  q: string;
  codigo: string;
  andarMin: number;
  condominioMax: number;
  iptuMax: number;
  bounds: MapBounds | null;
}

interface SearchState {
  filters: SearchFilters;
  page: number;
  scrollY: number;
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  resetFilters: () => void;
  setFilters: (partial: Partial<SearchFilters>) => void;
  setPage: (n: number) => void;
  setScrollY: (y: number) => void;
}

const DEFAULT_FILTERS: SearchFilters = {
  tipo: "",
  bairro: "",
  cidade: "Porto Alegre",
  precoMin: 0,
  precoMax: 0,
  areaMin: 0,
  areaMax: 0,
  quartos: 0,
  banheiros: 0,
  vagas: 0,
  diferenciais: [],
  ordem: "recentes",
  q: "",
  codigo: "",
  andarMin: 0,
  condominioMax: 0,
  iptuMax: 0,
  bounds: null,
};

export const useSearchStore = create<SearchState>((set) => ({
  filters: { ...DEFAULT_FILTERS },
  page: 0,
  scrollY: 0,

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      page: 0, // reset page on filter change
    })),

  resetFilters: () =>
    set({ filters: { ...DEFAULT_FILTERS }, page: 0 }),

  setFilters: (partial) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
      page: 0,
    })),

  setPage: (n) => set({ page: n }),
  setScrollY: (y) => set({ scrollY: y }),
}));
