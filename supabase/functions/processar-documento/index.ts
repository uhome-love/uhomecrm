import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  // Basic PDF text extraction - decode streams and extract text between BT/ET markers
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(pdfBytes);
  
  const textParts: string[] = [];
  
  // Extract text from PDF text objects (between BT and ET)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    // Extract text strings in parentheses (Tj/TJ operators)
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
  
  // Also try to extract readable text directly (for simple PDFs)
  if (textParts.length < 5) {
    const directText = raw
      .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (directText.length > textParts.join(" ").length) {
      return directText;
    }
  }
  
  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

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

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY necessária para gerar embeddings de documentos.");

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get document
    const { data: doc, error: docError } = await supabase
      .from("homi_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) throw new Error("Document not found");

    let content = doc.content || "";

    // If content is empty but file_url exists, download from storage and extract
    if ((!content || content.trim().length < 50) && doc.file_url) {
      console.log(`Downloading file from storage: ${doc.file_url}`);
      const { data: fileData, error: dlError } = await supabase.storage
        .from("homi-documents")
        .download(doc.file_url);

      if (dlError || !fileData) {
        await supabase.from("homi_documents").update({ status: "error" }).eq("id", documentId);
        throw new Error("Failed to download file from storage");
      }

      const fileType = doc.file_type || "";
      if (fileType === "pdf") {
        const bytes = new Uint8Array(await fileData.arrayBuffer());
        content = await extractTextFromPdf(bytes);
        console.log(`Extracted ${content.length} chars from PDF`);
      } else {
        // txt, md, etc.
        content = await fileData.text();
      }

      // Save extracted content back to document
      if (content.trim().length > 0) {
        await supabase.from("homi_documents").update({ content }).eq("id", documentId);
      }
    }

    if (!content || content.trim().length < 50) {
      await supabase.from("homi_documents").update({ status: "error" }).eq("id", documentId);
      throw new Error("Document has no extractable content (too short or empty)");
    }

    console.log(`Processing document: ${doc.title} (${content.length} chars)`);

    // Split into chunks (~500 chars with 50 char overlap)
    const chunkSize = 500;
    const overlap = 50;
    const chunks: string[] = [];

    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const chunk = content.slice(i, i + chunkSize).trim();
      if (chunk.length > 20) chunks.push(chunk);
    }

    console.log(`Created ${chunks.length} chunks`);

    // Process in batches of 20
    const batchSize = 20;
    let processedChunks = 0;

    for (let b = 0; b < chunks.length; b += batchSize) {
      const batch = chunks.slice(b, b + batchSize);

      const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: batch,
        }),
      });

      if (!embeddingRes.ok) {
        const errText = await embeddingRes.text();
        console.error("OpenAI embedding error:", errText);
        await supabase.from("homi_documents").update({ status: "error" }).eq("id", documentId);
        throw new Error("Failed to generate embeddings: " + errText);
      }

      const embeddingData = await embeddingRes.json();

      const rows = batch.map((chunk, i) => ({
        document_id: documentId,
        content: chunk,
        embedding: embeddingData.data[i].embedding,
        metadata: {
          title: doc.title,
          category: doc.category,
          empreendimento: doc.empreendimento,
          chunk_index: b + i,
        },
      }));

      const { error: insertError } = await supabase.from("homi_chunks").insert(rows);
      if (insertError) {
        console.error("Chunk insert error:", insertError);
        throw new Error("Failed to save chunks");
      }

      processedChunks += batch.length;
    }

    // Update document status
    await supabase.from("homi_documents").update({
      status: "indexed",
      chunk_count: processedChunks,
    }).eq("id", documentId);

    console.log(`Document indexed: ${processedChunks} chunks`);

    return new Response(
      JSON.stringify({ success: true, chunks: processedChunks }),
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
