
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add AI columns to materiais_links
ALTER TABLE public.materiais_links
  ADD COLUMN IF NOT EXISTS resumo_ia text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS ingest_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ingest_error text,
  ADD COLUMN IF NOT EXISTS ingested_at timestamptz;

-- Chunks table
CREATE TABLE IF NOT EXISTS public.materiais_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materiais_links(id) ON DELETE CASCADE,
  chunk_idx int NOT NULL,
  content text NOT NULL,
  embedding vector(3072) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, chunk_idx)
);

GRANT SELECT ON public.materiais_chunks TO authenticated;
GRANT ALL ON public.materiais_chunks TO service_role;

ALTER TABLE public.materiais_chunks ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read chunks (materials themselves already visible via materiais_links RLS)
CREATE POLICY "chunks_read_authenticated"
  ON public.materiais_chunks
  FOR SELECT
  TO authenticated
  USING (true);

-- Writes only via service role (edge function)
CREATE POLICY "chunks_write_service"
  ON public.materiais_chunks
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- HNSW index on halfvec cast (3072-dim column needs halfvec for HNSW)
CREATE INDEX IF NOT EXISTS materiais_chunks_embedding_idx
  ON public.materiais_chunks
  USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE INDEX IF NOT EXISTS materiais_chunks_material_idx
  ON public.materiais_chunks (material_id);

-- Similarity search function
CREATE OR REPLACE FUNCTION public.match_materiais(
  query_embedding vector(3072),
  match_count int DEFAULT 20
)
RETURNS TABLE (
  material_id uuid,
  chunk_id uuid,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.material_id,
    c.id AS chunk_id,
    c.content,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.materiais_chunks c
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_materiais(vector, int) TO authenticated, service_role;
