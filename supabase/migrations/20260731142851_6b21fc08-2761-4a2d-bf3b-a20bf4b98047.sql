ALTER TABLE public.homi_documents
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'documento',
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS homi_documents_source_uidx
  ON public.homi_documents (source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS homi_documents_status_idx ON public.homi_documents (status);

DROP FUNCTION IF EXISTS public.buscar_conhecimento(vector, double precision, integer, text);

CREATE OR REPLACE FUNCTION public.buscar_conhecimento(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.6,
  match_count integer DEFAULT 8,
  filter_empreendimento text DEFAULT NULL,
  filter_source_types text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity double precision,
  title text,
  category text,
  source_type text,
  source_url text,
  priority integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    hc.id,
    hc.document_id,
    hc.content,
    hc.metadata,
    (1 - (hc.embedding <=> query_embedding))::float AS similarity,
    hd.title,
    hd.category,
    hd.source_type,
    hd.source_url,
    hd.priority
  FROM homi_chunks hc
  JOIN homi_documents hd ON hc.document_id = hd.id
  WHERE
    hc.embedding IS NOT NULL
    AND 1 - (hc.embedding <=> query_embedding) > match_threshold
    AND hd.status IN ('indexed', 'ready')
    AND (filter_empreendimento IS NULL OR hd.empreendimento = filter_empreendimento)
    AND (filter_source_types IS NULL OR hd.source_type = ANY(filter_source_types))
  ORDER BY hd.priority DESC, similarity DESC
  LIMIT match_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.buscar_conhecimento(vector, double precision, integer, text, text[]) TO authenticated, service_role;