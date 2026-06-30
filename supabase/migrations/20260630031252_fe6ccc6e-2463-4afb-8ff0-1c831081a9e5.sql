CREATE OR REPLACE FUNCTION public._pipeline_ultima_acao_humana(_lead_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    pl.stage_changed_at,
    pl.created_at,
    COALESCE(pl.aceito_em, 'epoch'::timestamptz),
    COALESCE((SELECT max(a.created_at) FROM pipeline_atividades a
              WHERE a.pipeline_lead_id = pl.id
                AND a.tipo IN ('ligacao','contato','visita','nota','proposta','email','reuniao','mudanca_etapa','retorno','envio_material','whatsapp')), 'epoch'::timestamptz),
    COALESCE((SELECT max(an.created_at) FROM pipeline_anotacoes an
              WHERE an.pipeline_lead_id = pl.id), 'epoch'::timestamptz),
    COALESCE((SELECT max(t.concluida_em) FROM pipeline_tarefas t
              WHERE t.pipeline_lead_id = pl.id AND t.concluida_em IS NOT NULL), 'epoch'::timestamptz),
    COALESCE((SELECT max(w.created_at) FROM whatsapp_mensagens w
              WHERE w.lead_id = pl.id AND w.direction = 'sent'), 'epoch'::timestamptz),
    COALESCE((SELECT max(v.created_at) FROM visitas v
              WHERE v.lead_id = pl.id), 'epoch'::timestamptz)
  )
  FROM pipeline_leads pl
  WHERE pl.id = _lead_id
$$;

GRANT EXECUTE ON FUNCTION public._pipeline_ultima_acao_humana(uuid) TO authenticated, service_role;