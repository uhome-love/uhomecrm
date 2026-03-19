
CREATE OR REPLACE FUNCTION public.check_phone_duplicate(p_telefone text)
RETURNS TABLE(lead_id uuid, lead_nome text, lead_telefone text, lead_empreendimento text, corretor_nome text, lead_stage_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pl.id AS lead_id,
    pl.nome AS lead_nome,
    pl.telefone AS lead_telefone,
    pl.empreendimento AS lead_empreendimento,
    pr.nome AS corretor_nome,
    pl.stage_id AS lead_stage_id
  FROM pipeline_leads pl
  LEFT JOIN profiles pr ON pr.user_id = pl.corretor_id
  WHERE regexp_replace(pl.telefone, '\D', '', 'g') ILIKE '%' || right(regexp_replace(p_telefone, '\D', '', 'g'), 8) || '%'
  LIMIT 5;
$$;
