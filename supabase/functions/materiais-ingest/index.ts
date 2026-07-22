import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MAX_INLINE_BYTES = 20 * 1024 * 1024; // 20MB inline to Gemini
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const EMBED_BATCH = 50;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    out.push(clean.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return out;
}

async function bufToBase64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function extractContentText(
  material: any,
  empreendimentoNome: string,
): Promise<string> {
  const context = `Empreendimento: ${empreendimentoNome}\nTítulo: ${material.titulo}\nCategoria: ${material.categoria}\n${material.descricao ? `Descrição: ${material.descricao}\n` : ""}`;

  // Link externo (sem storage): usa só metadados
  if (!material.storage_path) {
    return context;
  }

  // Baixa arquivo via signed URL
  const { data: signed, error: sErr } = await admin.storage
    .from("materiais-uhome")
    .createSignedUrl(material.storage_path, 300);
  if (sErr || !signed?.signedUrl) throw new Error(`signed url: ${sErr?.message}`);

  const mime = material.mime_type || "";
  const size = material.size_bytes || 0;

  // Vídeo ou arquivo grande: usa apenas contexto
  if (mime.startsWith("video/") || size > MAX_INLINE_BYTES) {
    return context + `\n[Arquivo ${mime} de ${(size / 1024 / 1024).toFixed(1)}MB — conteúdo não extraído]`;
  }

  // Imagem ou PDF: envia inline pra Gemini vision
  const fileResp = await fetch(signed.signedUrl);
  if (!fileResp.ok) throw new Error(`download: ${fileResp.status}`);
  const buf = await fileResp.arrayBuffer();
  const b64 = await bufToBase64(buf);

  const parts: any[] = [
    { type: "text", text:
      `Você é um extrator de conteúdo imobiliário. Contexto: ${context}\n` +
      `Extraia TODO o texto legível deste ${mime.startsWith("image/") ? "imagem" : "PDF"}, ` +
      `e descreva os elementos visuais relevantes (cômodos, plantas, características do imóvel, ` +
      `números como m², preços, dormitórios). Retorne texto corrido em português, sem markdown.`
    },
  ];

  if (mime.startsWith("image/")) {
    parts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
  } else if (mime === "application/pdf") {
    parts.push({ type: "file", file: { filename: material.titulo || "material.pdf", file_data: `data:${mime};base64,${b64}` } });
  } else {
    return context; // tipo não suportado
  }

  const chatResp = await fetch(`${AI_GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [{ role: "user", content: parts }],
    }),
  });
  if (!chatResp.ok) throw new Error(`vision: ${chatResp.status} ${await chatResp.text()}`);
  const chatJson = await chatResp.json();
  const extracted = chatJson.choices?.[0]?.message?.content ?? "";
  return context + "\n" + extracted;
}

async function generateSummaryTags(fullText: string): Promise<{ resumo: string; tags: string[] }> {
  const resp = await fetch(`${AI_GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: "Você organiza materiais imobiliários. Retorne SEMPRE JSON válido no formato { \"resumo\": string, \"tags\": string[] }. Resumo com no máximo 2 frases. Tags: 3 a 8 palavras/frases curtas em minúsculas, sem #, focadas em características do imóvel (dormitórios, área, localização, tipo, diferenciais)." },
        { role: "user", content: fullText.slice(0, 8000) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`summary: ${resp.status} ${await resp.text()}`);
  const j = await resp.json();
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: any) => typeof t === "string" && t.length > 0).slice(0, 8)
      : [];
    return { resumo: String(parsed.resumo || "").slice(0, 500), tags };
  } catch {
    return { resumo: "", tags: [] };
  }
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const resp = await fetch(`${AI_GATEWAY}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-embedding-001",
        input: batch,
      }),
    });
    if (!resp.ok) throw new Error(`embed: ${resp.status} ${await resp.text()}`);
    const j = await resp.json();
    const sorted = (j.data as any[]).sort((a, b) => a.index - b.index);
    for (const item of sorted) out.push(item.embedding);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { material_id } = await req.json();
    if (!material_id) {
      return new Response(JSON.stringify({ error: "material_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch material + empreendimento nome
    const { data: material, error: mErr } = await admin
      .from("materiais_links")
      .select("*, materiais_empreendimentos!inner(nome)")
      .eq("id", material_id)
      .single();
    if (mErr || !material) throw new Error(`material não encontrado: ${mErr?.message}`);

    await admin
      .from("materiais_links")
      .update({ ingest_status: "processing", ingest_error: null })
      .eq("id", material_id);

    const empNome = (material as any).materiais_empreendimentos?.nome || "";

    // 1. Extract text
    const fullText = await extractContentText(material, empNome);

    // 2. Summary + tags
    const { resumo, tags } = await generateSummaryTags(fullText);

    // 3. Chunks + embeddings
    const chunks = chunkText(fullText);
    let embeddings: number[][] = [];
    if (chunks.length > 0) {
      embeddings = await embedTexts(chunks);
    }

    // 4. Replace chunks
    await admin.from("materiais_chunks").delete().eq("material_id", material_id);
    if (chunks.length > 0) {
      const rows = chunks.map((content, i) => ({
        material_id,
        chunk_idx: i,
        content,
        embedding: `[${embeddings[i].join(",")}]`,
      }));
      const { error: insErr } = await admin.from("materiais_chunks").insert(rows);
      if (insErr) throw new Error(`insert chunks: ${insErr.message}`);
    }

    await admin
      .from("materiais_links")
      .update({
        resumo_ia: resumo,
        tags,
        ingest_status: "done",
        ingest_error: null,
        ingested_at: new Date().toISOString(),
      })
      .eq("id", material_id);

    return new Response(
      JSON.stringify({ ok: true, chunks: chunks.length, tags }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("materiais-ingest error:", e);
    try {
      const body = await req.clone().json();
      if (body?.material_id) {
        await admin
          .from("materiais_links")
          .update({ ingest_status: "error", ingest_error: String(e.message || e).slice(0, 500) })
          .eq("id", body.material_id);
      }
    } catch { /* ignore */ }
    return new Response(
      JSON.stringify({ error: String(e.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
