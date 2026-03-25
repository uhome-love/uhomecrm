/**
 * Shared helper functions for property (imóvel) data extraction and formatting.
 *
 * CENTRALIZED IMAGE API — single source of truth:
 *
 * | Helper                        | Use case              | Priority                                         |
 * |-------------------------------|-----------------------|--------------------------------------------------|
 * | getPropertyCardImages(item)   | Grid/list card thumbs | _fotos_normalized → link_thumb → link → hero     |
 * | getPropertyPreviewImages(item)| Quick Preview hero    | _fotos_full → link_large → link → normalized     |
 * | getPropertyFullscreenImages() | Lightbox fullscreen   | _fotos_full → link_large → link → normalized     |
 *
 * Rules:
 * - No component picks image URLs ad hoc — always use these helpers.
 * - Thumbnail URLs must never be used for preview/fullscreen if better exists.
 * - Graceful degradation: if only thumbs exist, they're used everywhere.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Internal: best-quality images available ──

function _bestQualityImages(item: any): string[] {
  // 1. Explicit full-res array (from Typesense mapping or proxy)
  if (item._fotos_full?.length) return item._fotos_full;

  // 2. Raw fotos_full from PostgREST (properties table)
  if (Array.isArray(item.fotos_full) && item.fotos_full.length > 0) return item.fotos_full;

  // 3. Try imagens array for link_large (skip thumbs)
  const arr = item.imagens;
  if (Array.isArray(arr) && arr.length > 0) {
    const large = arr.map((img: any) => img.link_large || img.link || "").filter(Boolean);
    if (large.length > 0) return large;
  }

  // 4. Fallback to normalized thumbs (graceful degradation)
  if (item._fotos_normalized?.length) return item._fotos_normalized;

  // 5. Raw fotos from PostgREST
  if (Array.isArray(item.fotos) && item.fotos.length > 0) return item.fotos;

  return [];
}

// ── Internal: lightweight thumb images ──

function _thumbImages(item: any): string[] {
  if (item._fotos_normalized?.length) return item._fotos_normalized;
  const arr = item.imagens;
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.map((img: any) => img.link_thumb || img.link || img.url || "").filter(Boolean);
  }
  return [];
}

// ── Public API ──

/**
 * Card images (grid/list thumbnails) — lightweight, fast loading.
 * Falls back to best-quality if no thumbs exist.
 */
export function getPropertyCardImages(item: any): string[] {
  const thumbs = _thumbImages(item);
  return thumbs.length > 0 ? thumbs : _bestQualityImages(item);
}

/**
 * Preview hero images (Quick Preview drawer) — high quality.
 */
export function getPropertyPreviewImages(item: any): string[] {
  return _bestQualityImages(item);
}

/**
 * Fullscreen/lightbox images — highest quality available.
 */
export function getPropertyFullscreenImages(item: any): string[] {
  return _bestQualityImages(item);
}

/**
 * Thumbnail strip images — always lightweight.
 * Falls back to best-quality if no thumbs.
 */
export function getPropertyThumbImages(item: any): string[] {
  const thumbs = _thumbImages(item);
  return thumbs.length > 0 ? thumbs : _bestQualityImages(item);
}

// ── Legacy aliases (kept for any external consumers) ──

/** @deprecated Use getPropertyCardImages */
export const extractImages = getPropertyCardImages;
/** @deprecated Use getPropertyFullscreenImages */
export const extractFullImages = getPropertyFullscreenImages;
/** @deprecated Use getPropertyPreviewImages */
export const getPropertyHeroImages = getPropertyPreviewImages;

// ── Other property helpers ──

export function extractOrigemExterna(item: any) {
  const proprietario = item.proprietario_nome || item.proprietario?.nome;
  const agenciador = item.agenciador_nome || item.agenciador?.nome;
  const responsavel = item.responsavel_nome || item.corretor_nome || item.responsavel?.nome;
  const telefone = item.responsavel_telefone || item.corretor_telefone || item.proprietario_telefone || item.proprietario?.telefone;
  const email = item.responsavel_email || item.corretor_email || item.proprietario_email || item.proprietario?.email;
  const sistema = item.origem_sistema || item.sistema_origem;
  const textFields = [item.observacoes_internas, item.informacoes_origem_externa, item.obs_internas, item.observacoes].filter(Boolean);
  let parsedResp = responsavel, parsedTel = telefone, parsedEmail = email, parsedSistema = sistema;
  for (const obsText of textFields) {
    if (!obsText || typeof obsText !== "string") continue;
    const sysMatch = obsText.match(/Sistema:\s*(.+)/i);
    const respMatch = obsText.match(/Respons[áa]vel\/Corretor:\s*(.+)/i) || obsText.match(/Respons[áa]vel:\s*(.+)/i);
    const telMatch = obsText.match(/Telefone:\s*(.+)/i);
    const emailMatch = obsText.match(/E-?mail:\s*(.+)/i);
    if (sysMatch && !parsedSistema) parsedSistema = sysMatch[1].trim();
    if (respMatch && !parsedResp) parsedResp = respMatch[1].trim();
    if (telMatch && !parsedTel) parsedTel = telMatch[1].trim();
    if (emailMatch && !parsedEmail) parsedEmail = emailMatch[1].trim();
  }
  if (!parsedResp && !parsedTel && !parsedEmail && !parsedSistema && !proprietario && !agenciador) return null;
  return { sistema: parsedSistema, responsavel: parsedResp || proprietario || agenciador, telefone: parsedTel, email: parsedEmail };
}

export function extractEntrega(item: any) {
  const situacao = (item.situacao || item.status || item.fase || "").toLowerCase();
  const emObras = situacao.includes("obra") || situacao.includes("constru") || situacao.includes("planta") || situacao.includes("lançamento") || situacao === "lancamento";
  let previsao = item.previsao_entrega || item.data_entrega || item.prazo_entrega || item.previsao || item.entrega || null;
  if (!previsao) {
    const texts = [item.descricao_interna, item.observacoes_internas, item.observacoes, item.descricao].filter(Boolean);
    for (const t of texts) {
      if (typeof t !== "string") continue;
      const match = t.match(/(?:entrega|previs[ãa]o)[:\s]*(\d{1,2}[\/\-]\d{4}|\d{4})/i) || t.match(/(?:entrega|previs[ãa]o)[:\s]*([\w]+\s*(?:de\s*)?\d{4})/i);
      if (match) return { emObras, previsao: match[1].trim() };
    }
  }
  return { emObras, previsao };
}

export function extractEndereco(item: any) {
  const logradouro = item.endereco_logradouro || item.endereco || item.logradouro || "";
  const numero = item.endereco_numero || item.numero || "";
  const bairro = item.endereco_bairro || item.bairro || "";
  const cidade = item.endereco_cidade || item.cidade || "";
  return { endereco: `${logradouro}${numero ? `, ${numero}` : ""}`.trim(), bairro, cidade };
}

export function getNum(item: any, ...keys: string[]): number | null {
  for (const k of keys) { const v = item[k]; if (v != null && v !== "" && v !== 0 && !isNaN(Number(v))) return Number(v); }
  return null;
}

export function getNumIncZero(item: any, ...keys: string[]): number | null {
  for (const k of keys) { const v = item[k]; if (v != null && v !== "" && !isNaN(Number(v))) return Number(v); }
  return null;
}

export const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}mil`;
  return fmtBRL(v);
};
