/**
 * Service layer for fetching properties from the Site Uhome's Supabase
 * via the site-proxy edge function.
 */

import { supabase } from "@/integrations/supabase/client";

/* ── Types ── */

export interface SiteImovel {
  id: string;
  slug: string;
  tipo: string;
  finalidade: string;
  status: string;
  destaque: boolean;
  preco: number;
  preco_condominio: number | null;
  area_total: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  bairro: string;
  cidade: string;
  uf: string;
  publicado_em: string;
  foto_principal: string | null;
  condominio_nome: string | null;
  // Detail-only fields
  descricao?: string | null;
  fotos?: Array<{ url: string; ordem: number; principal: boolean }>;
  diferenciais?: string[];
  latitude?: number | null;
  longitude?: number | null;
}

export interface MapPin {
  id: string;
  slug: string;
  preco: number;
  latitude: number;
  longitude: number;
  bairro: string;
  tipo: string;
  quartos: number | null;
  area_total: number | null;
  foto_principal?: string;
}

export interface BairroCount {
  bairro: string;
  count: number;
}

export interface BuscaFilters {
  tipo?: string;
  bairro?: string;
  bairros?: string[];
  cidade?: string;
  precoMin?: number;
  precoMax?: number;
  areaMin?: number;
  areaMax?: number;
  quartos?: number;
  banheiros?: number;
  vagas?: number;
  q?: string;
  ordem?: "recentes" | "preco_asc" | "preco_desc" | "area_desc";
  limit?: number;
  offset?: number;
  bounds?: { lat_min: number; lat_max: number; lng_min: number; lng_max: number } | null;
}

/* ── Helpers ── */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function tituloLimpo(imovel: { tipo: string; quartos: number | null; bairro: string }): string {
  const tipo = capitalize(imovel.tipo);
  const quartos = imovel.quartos ?? 0;
  if (quartos > 0) return `${tipo} ${quartos} quarto${quartos > 1 ? "s" : ""} — ${imovel.bairro}`;
  return `${tipo} para Venda — ${imovel.bairro}`;
}

export function fotoPrincipal(imovel: SiteImovel): string {
  if (imovel.foto_principal) return imovel.foto_principal;
  if (imovel.fotos && imovel.fotos.length > 0) {
    const p = imovel.fotos.find(f => f.principal);
    return (p ?? imovel.fotos[0]).url;
  }
  return "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop";
}

export function formatPreco(preco: number): string {
  if (!preco || preco <= 0) return "Consulte";
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function formatPrecoCompact(preco: number): string {
  if (!preco) return "";
  if (preco >= 1_000_000) return `R$${(preco / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (preco >= 1_000) return `R$${Math.round(preco / 1_000)}k`;
  return `R$${preco}`;
}

/* ── API calls via edge function ── */

async function invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("site-proxy", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "site-proxy error");
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function fetchSiteImoveis(filters: BuscaFilters = {}): Promise<{ data: SiteImovel[]; count: number }> {
  return invoke<{ data: SiteImovel[]; count: number }>("list", { ...filters });
}

export async function fetchMapPins(filters: BuscaFilters = {}): Promise<MapPin[]> {
  const result = await invoke<{ data: MapPin[] }>("pins", { ...filters });
  return result.data;
}

export async function fetchBairros(): Promise<BairroCount[]> {
  const result = await invoke<{ data: BairroCount[] }>("bairros");
  return result.data;
}

export async function fetchImovelBySlug(slug: string): Promise<SiteImovel | null> {
  const result = await invoke<{ data: SiteImovel | null }>("detail", { slug });
  return result.data;
}

export const CIDADES_PERMITIDAS = ["Porto Alegre", "Canoas", "Cachoeirinha", "Gravataí", "Guaíba"];

export const PROPERTY_TYPES = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "cobertura", label: "Cobertura" },
  { value: "studio", label: "Studio" },
  { value: "comercial", label: "Comercial" },
];
