/**
 * Busca de imóveis do CRM — lê o catálogo VIVO do banco do site (`imoveis`).
 *
 * Substitui o antigo `useTypesenseSearch`. A assinatura pública (search /
 * autocomplete, params `q`, `filter_by`, `sort_by`, `page`, `per_page`) foi
 * preservada de propósito: os consumidores (Radar de Imóveis e Busca por IA)
 * continuam falando a mesma "linguagem de filtro", que aqui é traduzida para
 * PostgREST em vez de ser enviada a um índice externo.
 *
 * Mapa de campos (linguagem de filtro → coluna do site):
 *   valor_venda      → preco
 *   dormitorios      → quartos
 *   area_privativa   → area_total
 *   empreendimento   → condominio_nome
 *   is_uhome         → destaque
 *   bairro / tipo / cidade / vagas / banheiros → iguais
 * Campos sem equivalente no catálogo (suites, construtora, em_obras, status)
 * são ignorados em vez de zerar o resultado.
 */
import { useState, useCallback, useRef } from "react";
import { supabaseSite } from "@/lib/supabaseSite";

interface ImoveisSearchParams {
  q?: string;
  page?: number;
  per_page?: number;
  filter_by?: string;
  sort_by?: string;
  autocomplete?: boolean;
}

interface SearchResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  total: number;
  totalPages: number;
  page: number;
  search_time_ms?: number;
}

interface Suggestion {
  type: string;
  value: string;
}

const LIST_SELECT =
  "id,slug,jetimob_id,tipo,finalidade,status,destaque,preco,preco_condominio,area_total,area_util,quartos,banheiros,vagas,andar,bairro,cidade,uf,latitude,longitude,titulo,fotos,foto_principal,condominio_nome,publicado_em,updated_at,endereco_completo";

/** Coluna do catálogo correspondente a cada campo da linguagem de filtro. */
const FIELD_MAP: Record<string, string | null> = {
  valor_venda: "preco",
  valor_locacao: "preco",
  dormitorios: "quartos",
  area_privativa: "area_total",
  empreendimento: "condominio_nome",
  is_uhome: "destaque",
  bairro: "bairro",
  tipo: "tipo",
  cidade: "cidade",
  vagas: "vagas",
  banheiros: "banheiros",
  data_atualizacao: "updated_at",
  // sem equivalente no catálogo do site — ignorados de propósito
  suites: null,
  construtora: null,
  em_obras: null,
  status: null,
  situacao: null,
  _text_match: null,
};

/** Remove crases e aspas usadas para escapar valores com espaço. */
function limparValor(v: string): string {
  return v.trim().replace(/^[`'"]|[`'"]$/g, "").trim();
}

interface Condicao {
  campo: string;
  op: string;
  valores: string[];
}

/**
 * Interpreta uma expressão de filtro no formato
 * `campo:=valor && campo:>=10 && campo:[a,b]`.
 */
function parseFiltro(expr: string): Condicao[] {
  if (!expr) return [];
  const cond: Condicao[] = [];
  for (const bruto of expr.split("&&")) {
    const parte = bruto.trim();
    if (!parte) continue;
    const m = parte.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+)$/);
    if (!m) continue;
    const campo = m[1];
    let resto = m[2].trim();

    if (resto.startsWith("[")) {
      const lista = resto.replace(/^\[|\]$/g, "");
      cond.push({
        campo,
        op: "in",
        valores: lista.split(/,(?=(?:[^`]*`[^`]*`)*[^`]*$)/).map(limparValor).filter(Boolean),
      });
      continue;
    }

    let op = "=";
    for (const cand of [">=", "<=", "!=", ">", "<", "="]) {
      if (resto.startsWith(cand)) {
        op = cand;
        resto = resto.slice(cand.length).trim();
        break;
      }
    }
    cond.push({ campo, op, valores: [limparValor(resto)] });
  }
  return cond;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(query: any, expr: string) {
  let q = query;
  for (const { campo, op, valores } of parseFiltro(expr)) {
    const coluna = FIELD_MAP[campo];
    if (!coluna || valores.length === 0) continue;

    // `valor_locacao:>0` é a forma de pedir locação — vira filtro de finalidade.
    if (campo === "valor_locacao") {
      q = q.eq("finalidade", "locacao");
      continue;
    }

    const numerico = ["preco", "quartos", "area_total", "vagas", "banheiros"].includes(coluna);
    const cast = (v: string) => {
      if (coluna === "destaque") return v === "true";
      return numerico ? Number(v) : v;
    };

    if (op === "in") {
      q = q.in(coluna, valores.map(cast));
      continue;
    }

    const v = cast(valores[0]);
    if (numerico && Number.isNaN(v as number)) continue;

    switch (op) {
      case ">=": q = q.gte(coluna, v); break;
      case "<=": q = q.lte(coluna, v); break;
      case ">": q = q.gt(coluna, v); break;
      case "<": q = q.lt(coluna, v); break;
      case "!=": q = q.neq(coluna, v); break;
      default: q = q.eq(coluna, v);
    }
  }
  return q;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarOrdenacao(query: any, sortBy?: string) {
  let q = query;
  let aplicou = false;
  for (const parte of (sortBy || "").split(",")) {
    const [campo, dir] = parte.split(":").map((s) => s.trim());
    const coluna = FIELD_MAP[campo];
    if (!coluna) continue;
    q = q.order(coluna, { ascending: dir !== "desc", nullsFirst: false });
    aplicou = true;
  }
  return aplicou ? q : q.order("updated_at", { ascending: false, nullsFirst: false });
}

/** Escapa vírgulas e parênteses que quebram a sintaxe `.or()` do PostgREST. */
function textoSeguro(q: string): string {
  return q.replace(/[,()]/g, " ").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarTexto(query: any, q?: string) {
  const termo = textoSeguro(q || "");
  if (!termo || termo === "*") return query;
  const like = `%${termo}%`;
  return query.or(
    `titulo.ilike.${like},bairro.ilike.${like},condominio_nome.ilike.${like},jetimob_id.ilike.${like},endereco_completo.ilike.${like}`,
  );
}

/** Linha do catálogo → documento no formato consumido pelas telas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any) {
  const fotosRaw: { url?: string; ordem?: number }[] = Array.isArray(row.fotos) ? row.fotos : [];
  const fotos = fotosRaw
    .slice()
    .sort((a, b) => (a?.ordem ?? 0) - (b?.ordem ?? 0))
    .map((f) => (typeof f === "string" ? f : f?.url || ""))
    .filter(Boolean);
  const principal = row.foto_principal || fotos[0] || "";
  const area = Number(row.area_total || row.area_util || 0);

  return {
    id: row.id,
    codigo: row.jetimob_id || row.id,
    slug: row.slug || "",
    titulo: row.titulo || row.condominio_nome || "Imóvel",
    empreendimento: row.condominio_nome || "",
    construtora: "",
    bairro: row.bairro || "",
    cidade: row.cidade || "",
    uf: row.uf || "RS",
    endereco: row.endereco_completo || "",
    tipo: row.tipo || "",
    finalidade: row.finalidade || "venda",
    situacao: row.status || "",
    status: row.status || "",
    destaque: row.destaque ?? false,
    is_uhome: row.destaque ?? false,
    valor_venda: Number(row.preco || 0),
    valor_locacao: row.finalidade === "locacao" ? Number(row.preco || 0) : 0,
    valor_condominio: Number(row.preco_condominio || 0),
    area_privativa: area,
    area_total: area,
    dormitorios: Number(row.quartos || 0),
    banheiros: Number(row.banheiros || 0),
    vagas: Number(row.vagas || 0),
    suites: 0,
    andar: row.andar ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    fotos,
    fotos_full: fotos,
    foto_principal: principal,
    data_atualizacao: row.updated_at || row.publicado_em || "",
  };
}

export function useImoveisSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (params: ImoveisSearchParams): Promise<SearchResult | null> => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    const t0 = Date.now();

    try {
      const perPage = Math.min(Math.max(Number(params.per_page) || 24, 1), 100);
      const page = Math.max(Number(params.page) || 1, 1);
      const from = (page - 1) * perPage;

      let query = supabaseSite
        .from("imoveis")
        .select(LIST_SELECT, { count: "exact" })
        .eq("status", "disponivel")
        .gt("preco", 0);

      query = aplicarTexto(query, params.q);
      query = aplicarFiltros(query, params.filter_by || "");
      query = aplicarOrdenacao(query, params.sort_by);

      const { data, error: dbErr, count } = await query.range(from, from + perPage - 1);

      if (controller.signal.aborted) return null;
      if (dbErr) throw new Error(dbErr.message);

      const total = count ?? (data?.length || 0);
      return {
        data: (data || []).map(mapRow),
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
        page,
        search_time_ms: Date.now() - t0,
      };
    } catch (e) {
      if (controller.signal.aborted) return null;
      const msg = e instanceof Error ? e.message : "Erro na busca";
      setError(msg);
      console.error("[imoveis-search]", msg);
      return null;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const autocomplete = useCallback(async (q: string): Promise<Suggestion[]> => {
    const termo = textoSeguro(q);
    if (termo.length < 2) return [];
    try {
      const like = `%${termo}%`;
      const { data, error: dbErr } = await supabaseSite
        .from("imoveis")
        .select("bairro,condominio_nome,jetimob_id")
        .eq("status", "disponivel")
        .or(`bairro.ilike.${like},condominio_nome.ilike.${like},jetimob_id.ilike.${like}`)
        .limit(60);
      if (dbErr || !data) return [];

      const vistos = new Set<string>();
      const out: Suggestion[] = [];
      const push = (type: string, value?: string | null) => {
        const v = (value || "").trim();
        if (!v) return;
        const key = `${type}:${v.toLowerCase()}`;
        if (vistos.has(key)) return;
        vistos.add(key);
        out.push({ type, value: v });
      };
      for (const row of data) push("bairro", row.bairro);
      for (const row of data) push("empreendimento", row.condominio_nome);
      for (const row of data.slice(0, 5)) push("codigo", row.jetimob_id);
      return out.slice(0, 15);
    } catch {
      return [];
    }
  }, []);

  return { search, autocomplete, loading, error };
}
