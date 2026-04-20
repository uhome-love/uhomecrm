/**
 * Canonical types for the property catalog. Single source of truth used by
 * `siteImoveisRemote` (site DB), `siteImoveis` (legacy CRM properties), and
 * the UI layer (cards, drawers, map, radar).
 */

export interface SiteImovel {
  id: string;
  slug: string;
  codigo: string;
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
  suites: number | null;
  bairro: string;
  cidade: string;
  uf: string;
  publicado_em: string;
  foto_principal: string | null;
  fotos: string[];
  fotos_full: string[];
  condominio_nome: string | null;
  empreendimento: string | null;
  construtora: string | null;
  latitude: number | null;
  longitude: number | null;
  titulo: string | null;
  endereco: string | null;
  _raw?: Record<string, unknown>;
}

export interface MapPin {
  id: string;
  slug: string;
  preco: number;
  latitude: number;
  longitude: number;
  bairro: string;
  titulo: string;
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
  cidades?: string[];
  precoMin?: number;
  precoMax?: number;
  areaMin?: number;
  areaMax?: number;
  quartos?: number;
  banheiros?: number;
  vagas?: number;
  q?: string;
  codigo?: string;
  ordem?: "recentes" | "preco_asc" | "preco_desc" | "area_desc";
  limit?: number;
  offset?: number;
  bounds?: { lat_min: number; lat_max: number; lng_min: number; lng_max: number } | null;
  contrato?: "venda" | "locacao";
  situacao?: string[];
  construtora?: string[];
  empreendimento?: string[];
  statusImovel?: string;
  statusImovelList?: string[];
  condominioNome?: string;
  financiavel?: boolean;
  mobiliado?: boolean;
  comodidades?: string[];
  entregaAnoMin?: number;
  entregaAnoMax?: number;
}
