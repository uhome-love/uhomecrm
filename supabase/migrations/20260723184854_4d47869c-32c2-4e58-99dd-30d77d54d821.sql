
-- 1) RPC: adiciona guarda de elegibilidade (arquivado=true OU stage=Descarte)
CREATE OR REPLACE FUNCTION public.oferta_ativa_lock_next_lead(
  p_sessao_id uuid,
  p_corretor_id uuid,
  p_empreendimento_ids uuid[] DEFAULT '{}'::uuid[],
  p_segmento_ids uuid[] DEFAULT '{}'::uuid[],
  p_lock boolean DEFAULT true
)
RETURNS TABLE(
  id uuid, pipeline_lead_id uuid, balde text, bucket_order integer,
  empreendimento_id uuid, segmento_id uuid,
  motivo_descarte_raw text, reengajamento_status_raw text, locked_until timestamptz,
  lead_nome text, lead_telefone text, lead_telefone_normalizado text, lead_email text,
  lead_empreendimento_raw text, lead_campanha text, lead_origem text,
  lead_motivo_descarte text, lead_reengajamento_status text,
  lead_stage_changed_at timestamptz, lead_score integer, lead_temperatura text,
  lead_created_at timestamptz, lead_dias_desde_descarte integer,
  empreendimento_nome text, empreendimento_segmento_id uuid,
  segmento_nome text, segmento_cor text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lock_until timestamptz := now() + interval '15 minutes';
  v_id uuid;
  v_descarte_stage_id uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
BEGIN
  IF p_lock THEN
    -- Reutiliza lock ativo do mesmo corretor
    SELECT f.id INTO v_id
    FROM public.oferta_ativa_fila f
    JOIN public.pipeline_leads pl ON pl.id = f.pipeline_lead_id
    WHERE f.sessao_id = p_sessao_id
      AND f.locked_by = p_corretor_id
      AND f.locked_until > now()
      AND (pl.arquivado = true OR pl.stage_id = v_descarte_stage_id)
      AND (array_length(p_empreendimento_ids, 1) IS NULL OR f.empreendimento_id = ANY(p_empreendimento_ids))
      AND (array_length(p_segmento_ids, 1) IS NULL OR f.segmento_id = ANY(p_segmento_ids))
    ORDER BY f.locked_until DESC
    LIMIT 1;

    IF v_id IS NULL THEN
      SELECT f.id INTO v_id
      FROM public.oferta_ativa_fila f
      JOIN public.pipeline_leads pl ON pl.id = f.pipeline_lead_id
      WHERE f.sessao_id = p_sessao_id
        AND (f.locked_by IS NULL OR f.locked_until <= now())
        AND (f.claimed_by IS NULL OR f.claimed_until <= now())
        AND (f.cooldown_ate IS NULL OR f.cooldown_ate <= now())
        AND (f.ultimo_corretor_id IS NULL OR f.ultimo_corretor_id <> p_corretor_id)
        -- guarda de elegibilidade: só serve se ainda está descartado/arquivado
        AND (pl.arquivado = true OR pl.stage_id = v_descarte_stage_id)
        AND (array_length(p_empreendimento_ids, 1) IS NULL OR f.empreendimento_id = ANY(p_empreendimento_ids))
        AND (array_length(p_segmento_ids, 1) IS NULL OR f.segmento_id = ANY(p_segmento_ids))
        AND NOT EXISTS (
          SELECT 1 FROM public.oferta_ativa_ligacoes l
          WHERE l.pipeline_lead_id = f.pipeline_lead_id
            AND l.sessao_id = p_sessao_id
            AND l.corretor_id = p_corretor_id
            AND l.resultado = 'pulado'
        )
      ORDER BY f.bucket_order ASC, f.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1;

      IF v_id IS NULL THEN RETURN; END IF;

      UPDATE public.oferta_ativa_fila f
      SET locked_by = p_corretor_id, locked_until = v_lock_until,
          ultimo_oferecido_em = now(), updated_at = now()
      WHERE f.id = v_id;
    END IF;
  ELSE
    SELECT f.id INTO v_id
    FROM public.oferta_ativa_fila f
    JOIN public.pipeline_leads pl ON pl.id = f.pipeline_lead_id
    WHERE f.sessao_id = p_sessao_id
      AND (f.locked_by IS NULL OR f.locked_until <= now() OR f.locked_by = p_corretor_id)
      AND (f.claimed_by IS NULL OR f.claimed_until <= now())
      AND (f.cooldown_ate IS NULL OR f.cooldown_ate <= now())
      AND (f.ultimo_corretor_id IS NULL OR f.ultimo_corretor_id <> p_corretor_id)
      AND (pl.arquivado = true OR pl.stage_id = v_descarte_stage_id)
      AND (array_length(p_empreendimento_ids, 1) IS NULL OR f.empreendimento_id = ANY(p_empreendimento_ids))
      AND (array_length(p_segmento_ids, 1) IS NULL OR f.segmento_id = ANY(p_segmento_ids))
      AND NOT EXISTS (
        SELECT 1 FROM public.oferta_ativa_ligacoes l
        WHERE l.pipeline_lead_id = f.pipeline_lead_id
          AND l.sessao_id = p_sessao_id
          AND l.corretor_id = p_corretor_id
          AND l.resultado = 'pulado'
      )
    ORDER BY f.bucket_order ASC, f.created_at ASC
    LIMIT 1;

    IF v_id IS NULL THEN RETURN; END IF;
  END IF;

  RETURN QUERY
  SELECT
    f.id, f.pipeline_lead_id, f.balde, f.bucket_order,
    f.empreendimento_id, f.segmento_id,
    f.motivo_descarte_raw, f.reengajamento_status_raw, f.locked_until,
    pl.nome, pl.telefone, pl.telefone_normalizado, pl.email,
    pl.empreendimento, pl.campanha, pl.origem,
    pl.motivo_descarte, pl.reengajamento_status, pl.stage_changed_at,
    pl.lead_score, pl.lead_temperatura, pl.created_at,
    CASE WHEN pl.stage_changed_at IS NULL THEN NULL
         ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (
           date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
           - date_trunc('day', pl.stage_changed_at AT TIME ZONE 'America/Sao_Paulo')
         )) / 86400))::integer
    END,
    ec.nome, ec.segmento_id,
    rs.nome, NULL::text
  FROM public.oferta_ativa_fila f
  LEFT JOIN public.pipeline_leads pl ON pl.id = f.pipeline_lead_id
  LEFT JOIN public.empreendimentos_canonicos ec ON ec.id = f.empreendimento_id
  LEFT JOIN public.roleta_segmentos rs ON rs.id = f.segmento_id
  WHERE f.id = v_id;
END;
$function$;

-- 2) Trigger: remove da fila do Mutirão quando um lead é reativado
CREATE OR REPLACE FUNCTION public.trg_oferta_ativa_fila_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_descarte_stage_id uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
BEGIN
  -- Só age quando o lead sai do descarte OU deixa de ser arquivado
  IF (OLD.arquivado = true AND NEW.arquivado = false)
     OR (OLD.stage_id = v_descarte_stage_id AND NEW.stage_id <> v_descarte_stage_id)
  THEN
    DELETE FROM public.oferta_ativa_fila f
    USING public.oferta_ativa_sessoes s
    WHERE f.pipeline_lead_id = NEW.id
      AND s.id = f.sessao_id
      AND s.status IN ('ao_vivo', 'agendada');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oferta_ativa_fila_cleanup ON public.pipeline_leads;
CREATE TRIGGER trg_oferta_ativa_fila_cleanup
AFTER UPDATE OF arquivado, stage_id ON public.pipeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_oferta_ativa_fila_cleanup();

-- 3) Backfill: limpa da fila todos os leads que já foram reativados
DELETE FROM public.oferta_ativa_fila f
USING public.pipeline_leads pl, public.oferta_ativa_sessoes s
WHERE f.pipeline_lead_id = pl.id
  AND s.id = f.sessao_id
  AND s.status IN ('ao_vivo', 'agendada')
  AND (pl.arquivado = false AND pl.stage_id <> '1dd66c25-3848-4053-9f66-82e902989b4d');
