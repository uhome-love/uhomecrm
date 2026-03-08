import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth check
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
    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get document
    const { data: doc, error: docError } = await supabase
      .from("homi_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) throw new Error("Document not found");
    if (!doc.content || doc.content.trim().length === 0) {
      await supabase.from("homi_documents").update({ status: "error" }).eq("id", documentId);
      throw new Error("Document has no content");
    }

    console.log(`Processing document: ${doc.title} (${doc.content.length} chars)`);

    // Split into chunks (~500 chars with 50 char overlap)
    const chunkSize = 500;
    const overlap = 50;
    const text = doc.content;
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.slice(i, i + chunkSize).trim();
      if (chunk.length > 20) chunks.push(chunk);
    }

    console.log(`Created ${chunks.length} chunks`);

    // Process in batches of 20 (OpenAI embedding API supports batch)
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

      // Insert chunks with embeddings
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
