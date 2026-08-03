/**
 * Shared helper: busca semântica em materiais_links + monta bloco de prompt
 * para HOMI citar materiais reais da base de conhecimento Uhome.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeC4 } from "./homi-fontes.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";

export interface MaterialSuggestion {
  id: string;
  titulo: string;
  categoria: string | null;
  tipo: string | null;
  empreendimento: string | null;
  empreendimento_id: string | null;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  resumo_ia: string | null;
  tags: string[] | null;
  similarity: number;
  snippet: string;
}

/**
 * Busca materiais relevantes por similaridade semântica.
 * @param query texto (mensagem cliente, objetivo, situação — tudo concatenado)
 * @param opts.limit número máx de materiais (default 4)
 * @param opts.minSimilarity threshold (default 0.35)
 * @param opts.empreendimentoNome se informado, prioriza materiais deste empreendimento
 */
export async function searchMateriaisForHomi(
  query: string,
  opts: { limit?: number; minSimilarity?: number; empreendimentoNome?: string } = {},
): Promise<MaterialSuggestion[]> {
  const limit = opts.limit ?? 4;
  const minSimilarity = opts.minSimilarity ?? 0.35;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || !query || query.trim().length < 3) return [];

  try {
    const embResp = await fetch(`${AI_GATEWAY}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-embedding-001",
        input: query.slice(0, 2000),
      }),
    });
    if (!embResp.ok) {
      console.error("materiais-context: embedding failed", embResp.status);
      return [];
    }
    const embJson = await embResp.json();
    const vector = embJson.data?.[0]?.embedding;
    if (!vector) return [];

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: matches, error } = await admin.rpc("match_materiais", {
      query_embedding: `[${vector.join(",")}]` as any,
      match_count: Math.max(limit * 4, 20),
    });
    if (error) {
      console.error("materiais-context: match_materiais error", error);
      return [];
    }

    const byMaterial = new Map<string, { similarity: number; snippet: string }>();
    for (const m of (matches ?? []) as any[]) {
      if (m.similarity < minSimilarity) continue;
      const cur = byMaterial.get(m.material_id);
      if (!cur || m.similarity > cur.similarity) {
        byMaterial.set(m.material_id, {
          similarity: m.similarity,
          snippet: (m.content || "").slice(0, 240),
        });
      }
    }
    if (byMaterial.size === 0) return [];

    const ids = [...byMaterial.keys()];
    const { data: mats } = await admin
      .from("materiais_links")
      .select("id, empreendimento_id, categoria, tipo, titulo, url, storage_path, mime_type, resumo_ia, tags, materiais_empreendimentos!inner(id,nome)")
      .in("id", ids);

    const empNorm = opts.empreendimentoNome?.trim().toLowerCase() ?? "";
    const enriched: MaterialSuggestion[] = (mats ?? []).map((m: any) => {
      const s = byMaterial.get(m.id)!;
      const empNome = m.materiais_empreendimentos?.nome ?? null;
      // boost 0.15 quando empreendimento bate
      const boost = empNorm && empNome && empNome.toLowerCase().includes(empNorm) ? 0.15 : 0;
      return {
        id: m.id,
        titulo: m.titulo,
        categoria: m.categoria,
        tipo: m.tipo,
        empreendimento: empNome,
        empreendimento_id: m.empreendimento_id,
        url: m.url,
        storage_path: m.storage_path,
        mime_type: m.mime_type,
        resumo_ia: m.resumo_ia,
        tags: m.tags,
        similarity: s.similarity + boost,
        snippet: s.snippet,
      };
    });

    return enriched
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (e) {
    console.error("materiais-context: unexpected", e);
    return [];
  }
}

/**
 * Formata o bloco de prompt que o HOMI deve receber para citar materiais.
 *
 * Contrato de fontes: materiais são C4 (apoio). O metadado de NAVEGAÇÃO
 * (empreendimento canônico, link) é preservado para o HOMI indicar o material
 * certo — mas título, categoria e tags também passam pelo contrato central,
 * porque um título como "Tabela — Unidade 302 por R$ 499.000" transmite
 * afirmação volátil mesmo com o resumo limpo. Metadado suprimido vira rótulo
 * neutro, nunca conteúdo inventado.
 */
export function formatMateriaisBlock(items: MaterialSuggestion[]): string {
  if (items.length === 0) return "";

  let resumosOmitidos = 0;
  let metadadosNeutralizados = 0;

  const lines = items.map((m, i) => {
    // Empreendimento canônico pode permanecer (é identificador, não afirmação).
    const emp = m.empreendimento ? ` — ${m.empreendimento}` : "";

    const tituloLimpo = sanitizeMetadado(m.titulo, METADADO_NEUTRO) ?? METADADO_NEUTRO;
    if (m.titulo && tituloLimpo !== m.titulo) metadadosNeutralizados++;

    // Categoria e tags são descartadas quando voláteis (fallback null): não há
    // rótulo neutro útil para elas e inventar um seria pior que omitir.
    const catLimpa = sanitizeMetadado(m.categoria, null);
    if (m.categoria && !catLimpa) metadadosNeutralizados++;
    const cat = catLimpa ? ` [${catLimpa}]` : "";

    const bruto = m.resumo_ia ? m.resumo_ia : m.snippet;
    const limpo = sanitizeC4(bruto).texto.slice(0, 180);
    if (!limpo && bruto) resumosOmitidos++;
    const resumo = limpo || "(resumo omitido: continha dado sujeito a mudança — confirmar na fonte oficial vigente)";

    const tagsLimpas = (m.tags ?? [])
      .map((t) => sanitizeMetadado(t, null))
      .filter((t): t is string => !!t);
    if ((m.tags?.length ?? 0) > tagsLimpas.length) metadadosNeutralizados++;
    const tags = tagsLimpas.length > 0 ? ` #${tagsLimpas.slice(0, 4).join(" #")}` : "";

    return `${i + 1}. "${tituloLimpo}"${emp}${cat}\n   Resumo: ${resumo}${tags}`;
  }).join("\n");

  if (resumosOmitidos > 0 || metadadosNeutralizados > 0) {
    // Somente contagens — nunca texto, valor, nome ou PII.
    console.log(
      "[homi-fontes] materiais com resumo omitido:", resumosOmitidos,
      "metadados neutralizados:", metadadosNeutralizados,
    );
  }

  return `\n\n═══════════════════════════════════════
📚 MATERIAIS UHOME RELEVANTES (C4 — apoio, não é fonte de dado volátil)
═══════════════════════════════════════
Estes materiais da nossa base podem apoiar a resposta. Se algum fizer sentido para o momento do lead, MENCIONE explicitamente ("temos um material sobre X que ajuda") e sugira ao corretor enviar via "Gerar link comercial" no Hub de Materiais. Não invente materiais fora desta lista.
Material, anúncio, book ou tabela listados aqui NÃO confirmam preço, condição, unidade, disponibilidade ou prazo: indique o material e oriente conferir a fonte oficial vigente.

${lines}
═══════════════════════════════════════`;
}

