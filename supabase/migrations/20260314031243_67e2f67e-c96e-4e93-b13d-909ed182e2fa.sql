CREATE OR REPLACE VIEW public.v_pipeline_parcerias_visual AS
SELECT
  pp.pipeline_lead_id,
  pp.corretor_principal_id,
  pp.corretor_parceiro_id,
  pp.divisao_principal,
  pp.divisao_parceiro,
  COALESCE(
    (SELECT p.nome FROM public.profiles p WHERE p.user_id = pp.corretor_principal_id LIMIT 1),
    (SELECT tm.nome FROM public.team_members tm WHERE tm.user_id = pp.corretor_principal_id LIMIT 1),
    'Principal'
  ) AS principal_nome,
  COALESCE(
    (SELECT p.nome FROM public.profiles p WHERE p.user_id = pp.corretor_parceiro_id LIMIT 1),
    (SELECT tm.nome FROM public.team_members tm WHERE tm.user_id = pp.corretor_parceiro_id LIMIT 1),
    'Parceiro'
  ) AS parceiro_nome
FROM public.pipeline_parcerias pp
WHERE pp.status = 'ativa';