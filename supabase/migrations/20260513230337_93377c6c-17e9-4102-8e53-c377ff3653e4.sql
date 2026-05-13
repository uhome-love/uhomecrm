UPDATE public.pipeline_leads
SET origem = 'reativacao_nutricao',
    reativado_por_nutricao = true,
    reativado_em = COALESCE(reativado_em, created_at)
WHERE origem = 'whatsapp_inbound'
  AND created_at >= CURRENT_DATE;