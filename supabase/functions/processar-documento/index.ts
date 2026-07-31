/**
 * processar-documento — extrai texto, quebra em chunks e indexa no cérebro do HOMI.
 * Embeddings via Lovable AI Gateway (sem dependência de OPENAI_API_KEY).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { embedTexts } from "../_shared/homi-brain.ts";

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
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\")
        .replace(/\\([()])/g, "$1");
      if (text.trim()) textParts.push(text);
    }
  }

  if (textParts.length < 5) {
    const directText = raw
      .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (directText.length > textParts.join(" ").length) return directText;
  }

  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

const CHUNK_SIZE = 900;
const OVERLAP = 120;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const cronSecret = Deno.env.get("CRON_SECRET");
    const headerSecret = req.headers.get("x-cron-secret");

    let authorized =
      (cronSecret && headerSecret && headerSecret === cronSecret) ||
      (token && token === serviceKey);

    if (!authorized) {
      if (!token) throw new Error("Missing authorization");
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) throw new Error("Unauthorized");
      authorized = true;
    }

    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const { data: doc, error: docError } = await supabase
      .from("homi_documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (docError || !doc) throw new Error("Document not found");

    let content = doc.content || "";

    if ((!content || content.trim().length < 50) && doc.file_url) {
      const { data: fileData, error: dlError } = await supabase.storage
        .from("homi-documents")
        .download(doc.file_url);

      if (dlError || !fileData) {
        await supabase.from("homi_documents").update({ status: "error" }).eq("id", documentId);
        throw new Error("Failed to download file from storage");
      }

      if ((doc.file_type || "") === "pdf") {
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

    console.log(`[processar-documento] ${doc.title} (${content.length} chars)`);

    const clean = content.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
    const chunks: string[] = [];
    for (let i = 0; i < clean.length; i += CHUNK_SIZE - OVERLAP) {
      const chunk = clean.slice(i, i + CHUNK_SIZE).trim();
      if (chunk.length > 40) chunks.push(chunk);
    }

    // Reindexa do zero
    await supabase.from("homi_chunks").delete().eq("document_id", documentId);
    await supabase.from("homi_documents").update({ status: "processing" }).eq("id", documentId);

    const batchSize = 32;
    let processedChunks = 0;

    for (let b = 0; b < chunks.length; b += batchSize) {
      const batch = chunks.slice(b, b + batchSize);
      let embeddings: number[][];
      try {
        embeddings = await embedTexts(batch);
      } catch (e) {
        await supabase.from("homi_documents").update({ status: "error" }).eq("id", documentId);
        throw e;
      }

      const rows = batch.map((chunk, i) => ({
        document_id: documentId,
        content: chunk,
        embedding: embeddings[i],
        metadata: {
          title: doc.title,
          category: doc.category,
          source_type: doc.source_type ?? "documento",
          source_url: doc.source_url ?? null,
          empreendimento: doc.empreendimento,
          chunk_index: b + i,
        },
      }));

      const { error: insertError } = await supabase.from("homi_chunks").insert(rows);
      if (insertError) throw new Error("Failed to save chunks: " + insertError.message);
      processedChunks += batch.length;
    }

    await supabase.from("homi_documents").update({
      status: "indexed",
      chunk_count: processedChunks,
    }).eq("id", documentId);

    return new Response(
      JSON.stringify({ success: true, chunks: processedChunks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("processar-documento error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
