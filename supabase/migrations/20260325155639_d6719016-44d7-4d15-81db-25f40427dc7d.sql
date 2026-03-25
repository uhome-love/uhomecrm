CREATE OR REPLACE FUNCTION public.get_bairros_disponiveis(p_cidade text DEFAULT NULL, p_cidades text[] DEFAULT NULL)
RETURNS TABLE(bairro text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.bairro, count(*) as count
  FROM properties p
  WHERE p.ativo = true
    AND p.bairro IS NOT NULL
    AND p.bairro <> ''
    AND (
      (p_cidade IS NULL AND p_cidades IS NULL)
      OR (p_cidade IS NOT NULL AND p.cidade = p_cidade)
      OR (p_cidades IS NOT NULL AND p.cidade = ANY(p_cidades))
    )
  GROUP BY p.bairro
  ORDER BY p.bairro;
$$;

CREATE OR REPLACE FUNCTION public.count_imoveis(p_tipo text DEFAULT NULL, p_bairro text DEFAULT NULL, p_cidade text DEFAULT NULL)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
  FROM properties p
  WHERE p.ativo = true
    AND (p_tipo IS NULL OR p.tipo = p_tipo)
    AND (p_bairro IS NULL OR p.bairro ILIKE '%' || p_bairro || '%')
    AND (p_cidade IS NULL OR p.cidade = p_cidade);
$$;