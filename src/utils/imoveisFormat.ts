/**
 * Canonical formatters and slug/share helpers for the property catalog.
 * Pure functions — no I/O, no side effects. Safe to import from any layer.
 */

import type { SiteImovel, MapPin, BuscaFilters } from "@/types/imoveis";

/* ── Private helpers ── */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slugify(text: string): string {
  return text
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Normalizes compound property types to their base form for URL slugs.
 * E.g. "Casa de Condomínio" → "casa", "Apartamento Duplex" → "apartamento" */
function normalizeTipoSlug(tipo: string): string {
  const t = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (t.startsWith("casa")) return "casa";
  if (t.startsWith("apartamento")) return "apartamento";
  if (t.startsWith("terreno")) return "terreno";
  if (t.startsWith("sala") || t.startsWith("comercial")) return "comercial";
  if (t.startsWith("cobertura")) return "cobertura";
  if (t.startsWith("loja")) return "loja";
  if (t.startsWith("galpao") || t.startsWith("galp")) return "galpao";
  if (t.startsWith("flat") || t.startsWith("loft")) return "flat";
  if (t.startsWith("sobrado")) return "sobrado";
  if (t.startsWith("kitnet") || t.startsWith("studio") || t.startsWith("estudio")) return "kitnet";
  return slugify(tipo || "imovel");
}

// Add jitter to avoid stacking pins at same centroid
function jitter(val: number, range = 0.003): number {
  return val + (Math.random() - 0.5) * range;
}

/* ── Bairro centroids (Porto Alegre + region) for fallback when lat/lng missing ── */
const BAIRRO_CENTROIDS: Record<string, [number, number]> = {
  "Moinhos de Vento": [-30.0270, -51.1990],
  "Bela Vista": [-30.0450, -51.1900],
  "Mont'Serrat": [-30.0310, -51.2010],
  "Petrópolis": [-30.0420, -51.1780],
  "Três Figueiras": [-30.0310, -51.1700],
  "Boa Vista": [-30.0200, -51.1790],
  "Chácara das Pedras": [-30.0360, -51.1600],
  "Auxiliadora": [-30.0290, -51.1870],
  "Rio Branco": [-30.0350, -51.2030],
  "Independência": [-30.0330, -51.2060],
  "Floresta": [-30.0220, -51.2060],
  "São João": [-30.0250, -51.2120],
  "Centro Histórico": [-30.0310, -51.2280],
  "Centro": [-30.0310, -51.2280],
  "Cidade Baixa": [-30.0410, -51.2220],
  "Menino Deus": [-30.0470, -51.2230],
  "Azenha": [-30.0430, -51.2120],
  "Santana": [-30.0370, -51.2120],
  "Farroupilha": [-30.0370, -51.2120],
  "Partenon": [-30.0560, -51.1730],
  "Santo Antônio": [-30.0340, -51.1640],
  "Jardim Botânico": [-30.0510, -51.1750],
  "Vila Jardim": [-30.0450, -51.1680],
  "Higienópolis": [-30.0350, -51.1930],
  "Passo d'Areia": [-30.0100, -51.1640],
  "São Sebastião": [-30.0120, -51.1540],
  "Cristo Redentor": [-30.0120, -51.1460],
  "Vila Ipiranga": [-30.0160, -51.1370],
  "Jardim Lindóia": [-30.0180, -51.1530],
  "Jardim São Pedro": [-30.0140, -51.1570],
  "São Geraldo": [-30.0160, -51.2010],
  "Navegantes": [-30.0120, -51.2070],
  "Humaitá": [-30.0060, -51.2010],
  "Anchieta": [-30.0030, -51.1950],
  "Sarandi": [-29.9900, -51.1400],
  "Rubem Berta": [-29.9760, -51.1370],
  "Jardim Carvalho": [-30.0350, -51.1500],
  "Vila Nova": [-30.0660, -51.1690],
  "Camaquã": [-30.0810, -51.2170],
  "Cavalhada": [-30.0870, -51.2090],
  "Cristal": [-30.0780, -51.2300],
  "Tristeza": [-30.1020, -51.2370],
  "Ipanema": [-30.1130, -51.2400],
  "Pedra Redonda": [-30.1190, -51.2480],
  "Espírito Santo": [-30.1100, -51.2280],
  "Guarujá": [-30.1200, -51.2220],
  "Nonoai": [-30.0690, -51.2040],
  "Teresópolis": [-30.0670, -51.1870],
  "Glória": [-30.0630, -51.1800],
  "Cascata": [-30.0720, -51.1750],
  "Medianeira": [-30.0570, -51.1940],
  "Santa Tereza": [-30.0460, -51.2050],
  "Praia de Belas": [-30.0460, -51.2350],
  "Hípica": [-30.1370, -51.2070],
  "Restinga": [-30.1520, -51.1800],
  "Belém Velho": [-30.1150, -51.1920],
  "Belém Novo": [-30.1850, -51.1870],
  "Lami": [-30.2400, -51.0780],
  "Vila Assunção": [-30.0970, -51.2470],
  "Vila Conceição": [-30.0890, -51.2460],
  "Serraria": [-30.1280, -51.2070],
  "Aberta dos Morros": [-30.1340, -51.1610],
  "Lomba do Pinheiro": [-30.0870, -51.1320],
  "Agronomia": [-30.0740, -51.1320],
  "Mário Quintana": [-29.9630, -51.0950],
  "Jardim Sabará": [-30.0430, -51.1450],
  "Jardim do Salso": [-30.0730, -51.1570],
  "Santa Cecília": [-30.0290, -51.2080],
  "Bom Fim": [-30.0360, -51.2110],
  "Farrapos": [-29.9970, -51.1720],
  "São José": [-30.0100, -51.1770],
  "Ponta Grossa": [-30.0790, -51.2470],
  "Sétimo Céu": [-30.1200, -51.2510],
  "Jardim Isabel": [-30.0940, -51.1920],
  "Jardim Itu": [-30.0240, -51.1310],
  "Coronel Aparício Borges": [-30.0650, -51.1470],
  "Jardim Floresta": [-29.9980, -51.1640],
  "Santa Maria Goretti": [-29.9810, -51.1630],
  "Jardim Leopoldina": [-29.9710, -51.1520],
  "Vila Jardim Europa": [-30.0570, -51.1530],
  "Passo da Areia": [-30.0100, -51.1640],
  "Morro Santana": [-30.0550, -51.1180],
  "Parque Santa Fé": [-30.0080, -51.1200],
  "Jardim Planalto": [-30.0230, -51.1190],
  "Jardim Europa": [-30.0570, -51.1530],
  "Jardim Dona Leopoldina": [-29.9700, -51.1510],
  "Vila João Pessoa": [-30.0470, -51.2050],
  "Mato Sampaio": [-30.0060, -51.1430],
  "São Caetano": [-30.0030, -51.1790],
  "Conjunto Habitacional Rubem Berta": [-29.9760, -51.1370],
  "Protásio Alves": [-30.0430, -51.1350],
  "Vila São José": [-30.0100, -51.1770],
  "Chapéu do Sol": [-30.1500, -51.2050],
  "Viamão": [-30.0810, -51.0230],
  "Canoas": [-29.9170, -51.1740],
  "Cachoeirinha": [-29.9510, -51.0990],
  "Gravataí": [-29.9440, -50.9920],
  "São Leopoldo": [-29.7600, -51.1470],
  "Novo Hamburgo": [-29.6880, -51.1310],
  "Esteio": [-29.8610, -51.1770],
  "Sapucaia do Sul": [-29.8280, -51.1450],
  "Guaíba": [-30.1130, -51.3250],
  "Alvorada": [-29.9900, -51.0830],
  "Eldorado do Sul": [-30.0860, -51.3720],
};

/* ── Public helpers ── */

/** Generate uhome.com.br-compatible slug.
 * With quartos:    {tipo}-{N}-quartos-{bairro}-{codigo}
 * Without quartos: {tipo}-para-venda-{bairro}-{codigo}
 * The codigo already contains its suffix (e.g. -LU, -MT, -JD).
 *
 * IMPORTANT: When a pre-built slug from the site DB is available,
 * prefer passing it directly instead of regenerating. */
export function gerarSlugUhome(imovel: { tipo: string; quartos: number | null; bairro: string; codigo: string; slug?: string | null }): string {
  // If the site DB slug is available, use it directly — it's the canonical source of truth
  if (imovel.slug) return imovel.slug;

  const tipo = normalizeTipoSlug(imovel.tipo || "imovel");
  const quartos = imovel.quartos ?? 0;
  const bairro = slugify(imovel.bairro || "");
  const codigo = imovel.codigo || "";
  if (quartos > 0 && bairro) return `${tipo}-${quartos}-quarto${quartos > 1 ? "s" : ""}-${bairro}-${codigo}`;
  if (bairro) return `${tipo}-para-venda-${bairro}-${codigo}`;
  return `${tipo}-para-venda-${codigo}`;
}

/** Build the uhome.com.br share URL for a property.
 * If slugRef is provided, generates a personalized broker link:
 *   https://uhome.com.br/c/{slugRef}/imovel/{slug}
 * Otherwise generates the standard link:
 *   https://uhome.com.br/imovel/{slug}
 *
 * When imovel.slug is available from the DB, it takes priority over generation.
 */
export function shareUrlUhome(
  imovel: { tipo: string; quartos: number | null; bairro: string; codigo: string; slug?: string | null },
  slugRef?: string | null,
): string {
  const slug = gerarSlugUhome(imovel);
  if (slugRef) return `https://uhome.com.br/c/${slugRef}/imovel/${slug}`;
  return `https://uhome.com.br/imovel/${slug}`;
}

export function tituloLimpo(imovel: { tipo: string; quartos: number | null; bairro: string }): string {
  const tipo = capitalize(imovel.tipo);
  const quartos = imovel.quartos ?? 0;
  if (quartos > 0) return `${tipo} ${quartos} quarto${quartos > 1 ? "s" : ""} — ${imovel.bairro}`;
  return `${tipo} para Venda — ${imovel.bairro}`;
}

export function fotoPrincipal(imovel: SiteImovel): string {
  if (imovel.foto_principal) return imovel.foto_principal;
  if (imovel.fotos && imovel.fotos.length > 0) return imovel.fotos[0];
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

export function siteImovelToMapPin(imovel: SiteImovel, bounds?: BuscaFilters["bounds"]): MapPin | null {
  let lat = imovel.latitude;
  let lng = imovel.longitude;

  if (
    lat == null || lng == null ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat === 0 || lng === 0 ||
    lat < -34 || lat > -27 || lng < -55 || lng > -48
  ) {
    const centroid = BAIRRO_CENTROIDS[imovel.bairro];
    if (!centroid) return null;
    lat = jitter(centroid[0]);
    lng = jitter(centroid[1]);
  }

  if (bounds && (lat < bounds.lat_min || lat > bounds.lat_max || lng < bounds.lng_min || lng > bounds.lng_max)) {
    return null;
  }

  return {
    id: imovel.id,
    slug: imovel.slug,
    preco: imovel.preco,
    latitude: lat,
    longitude: lng,
    bairro: imovel.bairro,
    titulo: imovel.titulo || tituloLimpo({ tipo: imovel.tipo || "imóvel", quartos: imovel.quartos, bairro: imovel.bairro }),
    tipo: imovel.tipo,
    quartos: imovel.quartos,
    area_total: imovel.area_total,
    foto_principal: imovel.foto_principal || undefined,
  };
}

/* ── Public constants ── */

export const CIDADES_PERMITIDAS = ["Porto Alegre", "Canoas", "Cachoeirinha", "Gravataí", "Guaíba"];

export const PROPERTY_TYPES = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "cobertura", label: "Cobertura" },
  { value: "terreno", label: "Terreno" },
  { value: "comercial", label: "Comercial" },
  { value: "loft", label: "Loft" },
  { value: "kitnet", label: "Kitnet" },
];
