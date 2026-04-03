
CREATE OR REPLACE FUNCTION public.reciclar_leads_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_lead record;
BEGIN
  FOR v_lead IN
    SELECT pl.id, pl.corretor_id, pl.segmento_id, pl.distribuido_em
    FROM pipeline_leads pl
    WHERE pl.aceite_expira_em < now()
      AND pl.aceite_status IN ('pendente', 'aguardando_aceite')
      AND pl.corretor_id IS NOT NULL
  LOOP
    INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao, motivo_rejeicao, tempo_resposta_seg)
    VALUES (
      v_lead.id,
      v_lead.corretor_id,
      v_lead.segmento_id,
      'timeout',
      'tempo_excedido',
      EXTRACT(EPOCH FROM (now() - v_lead.distribuido_em))::integer
    );

    UPDATE pipeline_leads
    SET corretor_id = NULL,
        distribuido_em = NULL,
        aceite_expira_em = NULL,
        aceite_status = 'pendente_distribuicao',
        updated_at = now()
    WHERE id = v_lead.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
