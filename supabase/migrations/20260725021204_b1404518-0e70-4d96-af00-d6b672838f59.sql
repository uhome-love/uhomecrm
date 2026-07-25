-- Método Uhome / HOMI knowledge retrieval
-- 1) HNSW index para busca vetorial em homi_chunks (embedding é vector(1536))
CREATE INDEX IF NOT EXISTS homi_chunks_embedding_idx
  ON public.homi_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 2) RPC match_homi_chunks: top-k por similaridade cosine, filtro opcional por categoria
CREATE OR REPLACE FUNCTION public.match_homi_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 4,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.homi_chunks c
  LEFT JOIN public.homi_documents d ON d.id = c.document_id
  WHERE
    (filter_category IS NULL OR d.category = filter_category)
    AND d.status = 'ready'
  ORDER BY c.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

-- Permite chamar via PostgREST autenticado (edge functions usam service_role)
GRANT EXECUTE ON FUNCTION public.match_homi_chunks(vector, int, text) TO authenticated, service_role;
