/**
 * processar-documento — ingest de documentos para homi_chunks
 *
 * Mudanças (Método Uhome v1):
 * - Usa Lovable AI Gateway para embeddings (openai/text-embedding-3-small, 1536 dims)
 * - Chunker HIERÁRQUICO por ##/### com regras duras:
 *   • Seção 0 (COMO O HOMI DEVE USAR ESTA BASE) → 1 chunk único
 *   • Seção 11 (LINHAS VERMELHAS) → 1 chunk único
 *   • Cada ### ETAPA N não mistura com a próxima etapa
 *   • Seção 10 (casos reais): quebra só ENTRE casos
 *   • Seção 3 (biblioteca de objeções): bloco de 3 linhas
 *       **"..."** / →"..." / Técnica: ...  — nunca separar as 3 linhas
 * - Breadcrumb do chunk = linha **MÉTODO UHOME — ...** já presente no doc,
 *   + heading ### quando houver
 * - Idempotência: DELETE de chunks existentes do document_id antes do INSERT
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMBEDDINGS_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const TARGET_MIN = 2400;
const TARGET_MAX = 3600;
const OVERLAP = 400;

// ── PDF extractor (mantido) ────────────────────────────────────────────────
async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(pdfBytes);
  const textParts: string[] = [];
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    const tjRegex = /\(([^)]*)\)/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const text = tjMatch[1]
        .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\").replace(/\\([()])/g, "$1");
      if (text.trim()) textParts.push(text);
    }
  }
  if (textParts.length < 5) {
    const directText = raw
      .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF\n\r\t]/g, " ")
      .replace(/\s+/g, " ").trim();
    if (directText.length > textParts.join(" ").length) return directText;
  }
  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

// ── Chunker hierárquico ────────────────────────────────────────────────────

interface Chunk {
  content: string;
  heading_path: string;
  section_slug: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Extrai breadcrumb "**MÉTODO UHOME — ...**" no início do bloco, se houver.
 */
function extractBreadcrumb(block: string): string | null {
  const m = block.match(/\*\*(MÉTODO UHOME[^*]+?)\*\*/);
  return m ? m[1].trim().replace(/\.$/, "") : null;
}

/**
 * Divide o texto por ## (seções). Retorna { titulo, corpo, secaoNum } por seção.
 */
function splitBySections(text: string): { titulo: string; corpo: string; num: number | null }[] {
  const lines = text.split(/\r?\n/);
  const sections: { titulo: string; corpo: string; num: number | null }[] = [];
  let curTitle = "";
  let curBody: string[] = [];
  let curNum: number | null = null;

  const flush = () => {
    if (curTitle || curBody.length) {
      sections.push({ titulo: curTitle, corpo: curBody.join("\n").trim(), num: curNum });
    }
  };

  for (const ln of lines) {
    const m = ln.match(/^##\s+(?!#)(.+)$/); // exatamente 2 #, não 3
    if (m) {
      flush();
      curTitle = m[1].trim();
      const numMatch = curTitle.match(/^(\d+)\./);
      curNum = numMatch ? parseInt(numMatch[1], 10) : null;
      curBody = [];
    } else {
      curBody.push(ln);
    }
  }
  flush();
  return sections.filter((s) => s.titulo || s.corpo);
}

/**
 * Divide o corpo de uma seção por ### (subseções).
 * Retorna a subseção INCLUINDO a linha ### como cabeçalho.
 */
function splitBySubsections(body: string): { titulo: string; corpo: string }[] {
  const lines = body.split(/\r?\n/);
  const subs: { titulo: string; corpo: string }[] = [];
  let curTitle = "";
  let curBody: string[] = [];
  let hasSubs = false;

  const flush = () => {
    subs.push({ titulo: curTitle, corpo: curBody.join("\n").trim() });
  };

  for (const ln of lines) {
    const m = ln.match(/^###\s+(.+)$/);
    if (m) {
      hasSubs = true;
      if (curTitle || curBody.length) flush();
      curTitle = m[1].trim();
      curBody = [];
    } else {
      curBody.push(ln);
    }
  }
  if (curTitle || curBody.length) flush();

  if (!hasSubs) return [{ titulo: "", corpo: body.trim() }];
  return subs.filter((s) => s.titulo || s.corpo);
}

/**
 * Detecta blocos de 3 linhas da BIBLIOTECA DE OBJEÇÕES na seção 3:
 *   **"..."**
 *   → *"..."*
 *   Técnica: ...
 * Retorna uma lista de blocos consecutivos (cada bloco = 3 linhas).
 * Se a seção não for de objeções, retorna [] (fallback = chunker por parágrafo).
 */
function splitObjecoes(body: string): string[] | null {
  const lines = body.split(/\r?\n/);
  const blocks: string[] = [];
  let i = 0;
  let sawAnyBlock = false;
  let leading = "";
  const leadingLines: string[] = [];

  // Primeiro, capturar cabeçalho até a primeira linha **"..."**
  while (i < lines.length && !/^\*\*"[^"]+"\*\*/.test(lines[i].trim())) {
    leadingLines.push(lines[i]);
    i++;
  }
  leading = leadingLines.join("\n").trim();

  while (i < lines.length) {
    // pular linhas em branco
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;

    const l1 = lines[i]?.trim() || "";
    const l2 = lines[i + 1]?.trim() || "";
    const l3 = lines[i + 2]?.trim() || "";

    const isObjecao = /^\*\*".+"\*\*/.test(l1);
    const isResposta = l2.startsWith("→");
    const isTecnica = /^Técnica:/i.test(l3);

    if (isObjecao && isResposta && isTecnica) {
      blocks.push(`${l1}\n${l2}\n${l3}`);
      sawAnyBlock = true;
      i += 3;
    } else {
      // Não é um bloco de objeção — falha o modo objeção
      break;
    }
  }

  if (!sawAnyBlock) return null;

  // Agrupar 3 a 4 blocos por chunk, com cabeçalho da seção repetido
  const grouped: string[] = [];
  const perChunk = 3;
  for (let k = 0; k < blocks.length; k += perChunk) {
    const grp = blocks.slice(k, k + perChunk).join("\n\n");
    grouped.push([leading, grp].filter(Boolean).join("\n\n"));
  }
  return grouped;
}

/**
 * Detecta os 7 CASOS REAIS na seção 10: cada caso é um parágrafo
 * autossuficiente separado por linha em branco. Retorna um chunk por caso
 * (ou grupo de 2 se muito curtos).
 */
function splitCasos(body: string): string[] {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return paragraphs;
  // primeiro parágrafo = cabeçalho; demais = casos
  const [header, ...casos] = paragraphs;
  const chunks: string[] = [];
  for (let i = 0; i < casos.length; i++) {
    const caso = casos[i];
    // Se muito curto, tenta agrupar 2 casos
    if (caso.length < 400 && i + 1 < casos.length) {
      chunks.push(`${header}\n\n${caso}\n\n${casos[i + 1]}`);
      i++;
    } else {
      chunks.push(`${header}\n\n${caso}`);
    }
  }
  return chunks;
}

/**
 * Chunker por parágrafo (fallback). Respeita TARGET_MIN/MAX com overlap.
 */
function chunkByParagraph(body: string): string[] {
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (!cur) {
      cur = p;
      continue;
    }
    const combined = `${cur}\n\n${p}`;
    if (combined.length <= TARGET_MAX) {
      cur = combined;
    } else {
      chunks.push(cur);
      // overlap: pega o final do chunk anterior
      const tail = cur.slice(-OVERLAP);
      cur = `${tail}\n\n${p}`;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/**
 * Aplica todas as regras do Método Uhome e devolve a lista final de chunks
 * com breadcrumb resolvido.
 */
function buildChunks(fullText: string): Chunk[] {
  const sections = splitBySections(fullText);
  const chunks: Chunk[] = [];

  for (const sec of sections) {
    const secTitulo = sec.titulo;
    const secSlug = slugify(secTitulo);
    const secNum = sec.num;

    // REGRAS DURAS de indivisibilidade
    const isSecao0 = secNum === 0;
    const isSecao11 = secNum === 11;
    const isSecao3 = secNum === 3; // biblioteca de objeções
    const isSecao10 = secNum === 10; // casos reais
    const isSecao2 = secNum === 2; // 7 etapas

    // Breadcrumb padrão da seção
    const secBreadcrumb =
      extractBreadcrumb(sec.corpo) || `MÉTODO UHOME — ${secTitulo}`;

    if (isSecao0 || isSecao11) {
      // Chunk único, independente do tamanho
      chunks.push({
        content: `[${secBreadcrumb}]\n\n## ${secTitulo}\n\n${sec.corpo}`.trim(),
        heading_path: secBreadcrumb,
        section_slug: secSlug,
      });
      continue;
    }

    if (isSecao3) {
      const groups = splitObjecoes(sec.corpo);
      if (groups && groups.length > 0) {
        for (const g of groups) {
          chunks.push({
            content: `[${secBreadcrumb}]\n\n## ${secTitulo}\n\n${g}`.trim(),
            heading_path: secBreadcrumb,
            section_slug: secSlug,
          });
        }
        continue;
      }
      // fallback se detector falhar — chunker por parágrafo
    }

    if (isSecao10) {
      const casos = splitCasos(sec.corpo);
      for (const c of casos) {
        chunks.push({
          content: `[${secBreadcrumb}]\n\n## ${secTitulo}\n\n${c}`.trim(),
          heading_path: secBreadcrumb,
          section_slug: secSlug,
        });
      }
      continue;
    }

    if (isSecao2) {
      // Cada ### ETAPA N é a unidade mínima; pode gerar mais de 1 chunk
      // se estourar, mas nunca mistura fim de uma etapa com início da seguinte.
      const subs = splitBySubsections(sec.corpo);
      for (const sub of subs) {
        const subBreadcrumb = extractBreadcrumb(sub.corpo)
          || (sub.titulo ? `${secBreadcrumb} · ${sub.titulo}` : secBreadcrumb);
        if (sub.corpo.length <= TARGET_MAX) {
          chunks.push({
            content: `[${subBreadcrumb}]\n\n### ${sub.titulo}\n\n${sub.corpo}`.trim(),
            heading_path: subBreadcrumb,
            section_slug: `${secSlug}-${slugify(sub.titulo)}`,
          });
        } else {
          const parts = chunkByParagraph(sub.corpo);
          for (const p of parts) {
            chunks.push({
              content: `[${subBreadcrumb}]\n\n### ${sub.titulo}\n\n${p}`.trim(),
              heading_path: subBreadcrumb,
              section_slug: `${secSlug}-${slugify(sub.titulo)}`,
            });
          }
        }
      }
      continue;
    }

    // Caminho geral: subseções ### se existirem, senão parágrafo
    const subs = splitBySubsections(sec.corpo);
    for (const sub of subs) {
      const bc = sub.titulo
        ? `${secBreadcrumb} · ${sub.titulo}`
        : secBreadcrumb;
      const body = sub.corpo;
      if (body.length <= TARGET_MAX) {
        chunks.push({
          content: sub.titulo
            ? `[${bc}]\n\n### ${sub.titulo}\n\n${body}`.trim()
            : `[${bc}]\n\n## ${secTitulo}\n\n${body}`.trim(),
          heading_path: bc,
          section_slug: sub.titulo ? `${secSlug}-${slugify(sub.titulo)}` : secSlug,
        });
      } else {
        const parts = chunkByParagraph(body);
        for (const p of parts) {
          chunks.push({
            content: sub.titulo
              ? `[${bc}]\n\n### ${sub.titulo}\n\n${p}`.trim()
              : `[${bc}]\n\n## ${secTitulo}\n\n${p}`.trim(),
            heading_path: bc,
            section_slug: sub.titulo ? `${secSlug}-${slugify(sub.titulo)}` : secSlug,
          });
        }
      }
    }
  }

  // Filtra chunks minúsculos
  return chunks.filter((c) => c.content.trim().length >= 40);
}

// ── Embeddings via Lovable AI Gateway ──────────────────────────────────────

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");

  const r = await fetch(EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Gateway embeddings ${r.status}: ${t.slice(0, 300)}`);
  }
  const data = await r.json();
  const rows = (data?.data || []) as { index: number; embedding: number[] }[];
  rows.sort((a, b) => a.index - b.index);
  return rows.map((r) => r.embedding);
}

// ── HTTP handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: doc, error: docError } = await supabase
      .from("homi_documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (docError || !doc) throw new Error("Document not found");

    let content = doc.content || "";

    // Extrai do storage se necessário
    if ((!content || content.trim().length < 50) && doc.file_url) {
      console.log(`Downloading file from storage: ${doc.file_url}`);
      const { data: fileData, error: dlError } = await supabase.storage
        .from("homi-documents")
        .download(doc.file_url);
      if (dlError || !fileData) {
        await supabase.from("homi_documents").update({
          status: "error",
          content: `[ingest error: falha ao baixar do storage: ${dlError?.message || "unknown"}]`,
        }).eq("id", documentId);
        throw new Error("Failed to download file from storage");
      }
      const fileType = doc.file_type || "";
      if (fileType === "pdf") {
        const bytes = new Uint8Array(await fileData.arrayBuffer());
        content = await extractTextFromPdf(bytes);
      } else {
        content = await fileData.text();
      }
      if (content.trim().length > 0) {
        await supabase.from("homi_documents").update({ content }).eq("id", documentId);
      }
    }

    if (!content || content.trim().length < 50) {
      await supabase.from("homi_documents").update({ status: "error" }).eq("id", documentId);
      throw new Error("Document has no extractable content (too short or empty)");
    }

    console.log(`Processing document: ${doc.title} (${content.length} chars)`);

    // ── Idempotência: apaga chunks existentes ANTES de reinserir
    const { error: delErr } = await supabase
      .from("homi_chunks")
      .delete()
      .eq("document_id", documentId);
    if (delErr) {
      console.error("Delete existing chunks error:", delErr);
      // não é fatal — pode ser que nenhum existisse
    }

    // ── Chunker hierárquico Método Uhome
    const chunks = buildChunks(content);
    console.log(`Built ${chunks.length} chunks`);
    if (chunks.length === 0) {
      await supabase.from("homi_documents").update({
        status: "error",
      }).eq("id", documentId);
      throw new Error("Chunker returned 0 chunks");
    }

    // ── Embeddings via Lovable Gateway (batch 20)
    const batchSize = 20;
    let processed = 0;

    for (let b = 0; b < chunks.length; b += batchSize) {
      const batch = chunks.slice(b, b + batchSize);
      const inputs = batch.map((c) => c.content);
      let embeddings: number[][];
      try {
        embeddings = await embedBatch(inputs);
      } catch (e) {
        console.error("Embedding batch failed:", e);
        await supabase.from("homi_documents").update({
          status: "error",
        }).eq("id", documentId);
        throw e;
      }

      const rows = batch.map((c, i) => ({
        document_id: documentId,
        content: c.content,
        embedding: embeddings[i],
        metadata: {
          heading_path: c.heading_path,
          section_slug: c.section_slug,
          title: doc.title,
          category: doc.category,
          subcategory: doc.subcategory,
          empreendimento: doc.empreendimento,
          persona: doc.subcategory === "corretor" ? "corretor" : (doc.subcategory || null),
          tipo: doc.category || null,
          versao: "1.0",
          chunk_index: b + i,
        },
      }));

      const { error: insertError } = await supabase.from("homi_chunks").insert(rows);
      if (insertError) {
        console.error("Chunk insert error:", insertError);
        await supabase.from("homi_documents").update({
          status: "error",
        }).eq("id", documentId);
        throw new Error("Failed to save chunks: " + insertError.message);
      }
      processed += batch.length;
    }

    await supabase.from("homi_documents").update({
      status: "ready",
      chunk_count: processed,
    }).eq("id", documentId);

    console.log(`Document indexed: ${processed} chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        chunks: processed,
        sample_headings: chunks.slice(0, 5).map((c) => c.heading_path),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("processar-documento error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
