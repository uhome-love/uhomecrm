/**
 * Zustand store for the new /imoveis page search filters.
 * Syncs with URL search params for shareability.
 */

import { create } from "zustand";

export interface MapBounds {
  lat_min: number;
  lat_max: number;
  lng_min: number;
  lng_max: number;
}

export interface ImoveisFilters {
  tipo: string;
  bairro: string; // comma-separated for multi
  cidade: string;
  precoMin: number;
  precoMax: number;
  areaMin: number;
  areaMax: number;
  quartos: number;
  banheiros: number;
  vagas: number;
  ordem: "recentes" | "preco_asc" | "preco_desc" | "area_desc";
  q: string;
  bounds: MapBounds | null;
}

interface ImoveisSearchState {
  filters: ImoveisFilters;
  setFilter: <K extends keyof ImoveisFilters>(key: K, value: ImoveisFilters[K]) => void;
  setFilters: (f: Partial<ImoveisFilters>) => void;
  resetFilters: () => void;
}

const defaultFilters: ImoveisFilters = {
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
  ordem: "recentes",
  q: "",
  bounds: null,
};

export const useImoveisSearchStore = create<ImoveisSearchState>((set) => ({
  filters: { ...defaultFilters },
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
}));

/** Parse URL search params into filters */
export function filtersFromParams(params: URLSearchParams): Partial<ImoveisFilters> {
  const f: Partial<ImoveisFilters> = {};
  if (params.get("tipo")) f.tipo = params.get("tipo")!;
  if (params.get("bairro")) f.bairro = params.get("bairro")!;
  if (params.get("cidade")) f.cidade = params.get("cidade")!;
  if (params.get("preco_min")) f.precoMin = Number(params.get("preco_min"));
  if (params.get("preco_max")) f.precoMax = Number(params.get("preco_max"));
  if (params.get("area_min")) f.areaMin = Number(params.get("area_min"));
  if (params.get("area_max")) f.areaMax = Number(params.get("area_max"));
  if (params.get("quartos")) f.quartos = Number(params.get("quartos"));
  if (params.get("vagas")) f.vagas = Number(params.get("vagas"));
  if (params.get("ordem")) f.ordem = params.get("ordem") as ImoveisFilters["ordem"];
  if (params.get("q")) f.q = params.get("q")!;
  return f;
}

/** Serialize filters to URL search params */
export function filtersToParams(filters: ImoveisFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.tipo) p.set("tipo", filters.tipo);
  if (filters.bairro) p.set("bairro", filters.bairro);
  if (filters.cidade && filters.cidade !== "Porto Alegre") p.set("cidade", filters.cidade);
  if (filters.precoMin) p.set("preco_min", String(filters.precoMin));
  if (filters.precoMax) p.set("preco_max", String(filters.precoMax));
  if (filters.areaMin) p.set("area_min", String(filters.areaMin));
  if (filters.areaMax) p.set("area_max", String(filters.areaMax));
  if (filters.quartos) p.set("quartos", String(filters.quartos));
  if (filters.vagas) p.set("vagas", String(filters.vagas));
  if (filters.ordem && filters.ordem !== "recentes") p.set("ordem", filters.ordem);
  if (filters.q) p.set("q", filters.q);
  return p;
}
