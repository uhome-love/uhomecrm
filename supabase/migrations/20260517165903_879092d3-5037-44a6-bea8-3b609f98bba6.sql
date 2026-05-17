UPDATE public.roleta_distribuicoes rd
SET status = 'expirado',
    expira_em = COALESCE(rd.expira_em, now())
WHERE rd.status = 'aguardando'
  AND rd.lead_id IN (
    SELECT pl.id FROM public.pipeline_leads pl
    WHERE pl.corretor_id IS NULL
      AND pl.aceite_status = 'pendente_distribuicao'
      AND pl.created_at >= '2026-05-15'
  );