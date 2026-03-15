/**
 * Shared helper functions for property (imóvel) data extraction and formatting.
 * Extracted from ImoveisPage to be reused across components.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function extractImages(item: any): string[] {
  if (item._fotos_normalized?.length) return item._fotos_normalized;
  const arr = item.imagens;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr.map((img: any) => img.link_thumb || img.link || img.url || img.src || "").filter(Boolean);
}

export function extractFullImages(item: any): string[] {
  if (item._fotos_full?.length) return item._fotos_full;
  // Try imagens array for high-res sources before falling back to _fotos_normalized (thumbnails)
  const arr = item.imagens;
  if (Array.isArray(arr) && arr.length > 0) {
    const full = arr.map((img: any) => img.link_large || img.link || img.link_medio || img.link_thumb || img.url || img.src || "").filter(Boolean);
    if (full.length > 0) return full;
  }
  if (item._fotos_normalized?.length) return item._fotos_normalized;
  return [];
}

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
