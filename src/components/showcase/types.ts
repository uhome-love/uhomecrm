/* ═══════════ Showcase Types ═══════════ */

export type ShowcaseType = "product_page" | "melnick_day" | "property_selection";

export interface ShowcaseImovel {
  id: number;
  codigo?: string;
  titulo: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  area: number | null;
  quartos: number | null;
  suites: number | null;
  vagas: number | null;
  banheiros: number | null;
  valor: number | null;
  fotos: string[];
  empreendimento: string | null;
  descricao: string | null;
  // Melnick Day specific
  precoDe?: string | null;
  precoPor?: string | null;
  descontoMax?: string | null;
  status?: string | null;
  metragens?: string | null;
  dorms?: string | null;
  condicoes?: string | null;
  segmento?: string | null;
}

export interface ShowcaseLanding {
  diferenciais?: string[];
  plantas?: string[];
  video_url?: string | null;
  mapa_url?: string | null;
  cor_primaria?: string;
  landing_titulo?: string | null;
  landing_subtitulo?: string | null;
  descricao?: string | null;
  fotos?: string[];
  bairro?: string | null;
  valor_min?: number | null;
  valor_max?: number | null;
  tipologias?: { dorms: number; area_min?: number; area_max?: number; suites?: number }[];
  status_obra?: string | null;
  previsao_entrega?: string | null;
  vagas?: number | null;
}

export interface ShowcaseCorretor {
  nome: string;
  telefone: string | null;
  avatar_url: string | null;
}

export interface ShowcaseVitrine {
  id: string;
  titulo: string;
  subtitulo?: string | null;
  mensagem: string | null;
  created_at: string;
  tipo?: string;
}

export interface ShowcaseData {
  vitrine: ShowcaseVitrine;
  corretor: ShowcaseCorretor | null;
  imoveis: ShowcaseImovel[];
  landing?: ShowcaseLanding | null;
}

/* ═══════════ Helpers ═══════════ */
export function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|v=|\/embed\/)([^?&#]+)/);
  return match?.[1] || "";
}

export function buildWhatsappLink(telefone: string | null | undefined, nome: string, contextMessage: string): string | null {
  if (!telefone) return null;
  return `https://wa.me/55${telefone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Olá ${nome}! ${contextMessage}`
  )}`;
}

export function getSegmentoStyle(segmento: string) {
  const raw = (segmento || "").toLowerCase();
  if (raw.includes("mcmv") || raw.includes("open"))
    return { label: "MCMV", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" };
  if (raw.includes("alto"))
    return { label: "Alto Padrão", color: "#b45309", bg: "#fffbeb", border: "#fde68a" };
  return { label: "Médio Padrão", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" };
}
