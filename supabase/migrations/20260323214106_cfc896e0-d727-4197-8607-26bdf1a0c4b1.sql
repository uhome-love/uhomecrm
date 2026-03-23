CREATE OR REPLACE FUNCTION public.get_map_pins(
  lat_min double precision DEFAULT NULL,
  lat_max double precision DEFAULT NULL,
  lng_min double precision DEFAULT NULL,
  lng_max double precision DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_bairro text DEFAULT NULL,
  p_bairros text[] DEFAULT NULL,
  p_preco_min numeric DEFAULT NULL,
  p_preco_max numeric DEFAULT NULL,
  p_quartos integer DEFAULT NULL,
  p_banheiros integer DEFAULT NULL,
  p_vagas integer DEFAULT NULL,
  p_area_min numeric DEFAULT NULL,
  p_area_max numeric DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_cidades text[] DEFAULT ARRAY['Porto Alegre','Canoas','Cachoeirinha','Gravataí','Guaíba'],
  p_limite integer DEFAULT 2000
)
RETURNS TABLE(
  id uuid,
  codigo text,
  preco numeric,
  latitude double precision,
  longitude double precision,
  bairro text,
  tipo text,
  quartos integer,
  area_total numeric,
  foto_principal text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    p.codigo,
    p.valor_venda AS preco,
    p.latitude,
    p.longitude,
    p.bairro,
    p.tipo,
    p.dormitorios AS quartos,
    p.area_total,
    p.fotos[1] AS foto_principal
  FROM public.properties p
  WHERE p.ativo = true
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND (p_cidade IS NULL OR p.cidade = p_cidade)
    AND (p_cidade IS NOT NULL OR p.cidade = ANY(p_cidades))
    AND (lat_min IS NULL OR p.latitude >= lat_min)
    AND (lat_max IS NULL OR p.latitude <= lat_max)
    AND (lng_min IS NULL OR p.longitude >= lng_min)
    AND (lng_max IS NULL OR p.longitude <= lng_max)
    AND (p_tipo IS NULL OR p.tipo = p_tipo)
    AND (p_bairro IS NULL OR p.bairro ILIKE '%' || p_bairro || '%')
    AND (p_bairros IS NULL OR EXISTS (SELECT 1 FROM unnest(p_bairros) b WHERE p.bairro ILIKE '%' || b || '%'))
    AND (p_preco_min IS NULL OR p.valor_venda >= p_preco_min)
    AND (p_preco_max IS NULL OR p.valor_venda <= p_preco_max)
    AND (p_quartos IS NULL OR p.dormitorios >= p_quartos)
    AND (p_banheiros IS NULL OR p.banheiros >= p_banheiros)
    AND (p_vagas IS NULL OR p.vagas >= p_vagas)
    AND (p_area_min IS NULL OR p.area_total >= p_area_min)
    AND (p_area_max IS NULL OR p.area_total <= p_area_max)
  LIMIT p_limite;
$$;