DROP VIEW IF EXISTS public.v_corretor_roleta_status;
CREATE VIEW public.v_corretor_roleta_status AS
SELECT 
  p.user_id AS corretor_id,
  p.nome,
  corretor_pode_entrar_roleta(p.user_id) AS pode_entrar_roleta,
  contar_leads_desatualizados(p.user_id) AS leads_desatualizados,
  ( SELECT count(*) 
    FROM pipeline_tarefas pt
    JOIN pipeline_leads pl ON pl.id = pt.pipeline_lead_id
    WHERE pt.responsavel_id = p.user_id 
      AND pt.concluida_em IS NULL 
      AND pt.vence_em < (now() - interval '24 hours')::date
  ) AS tarefas_atrasadas,
  ( SELECT count(*) 
    FROM pipeline_leads pl
    WHERE pl.corretor_id = p.user_id 
      AND pl.lead_temperatura = ANY(ARRAY['quente','urgente'])
  ) AS leads_quentes
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.user_id
WHERE ur.role = 'corretor'::app_role;