CREATE OR REPLACE FUNCTION public.get_corretor_pre_estagnacao()
 RETURNS TABLE(lead_id uuid, nome text, empreendimento text, etapa text, stage_id uuid, dias_limite integer, dias_sem_acao integer, prazo_em timestamp with time zone, dias_para_estagnar integer, categoria text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT c.stage_id, c.dias_limite
    FROM pipeline_estagnacao_config c
    WHERE c.ativo = true
  ),
  base AS (
    SELECT
      pl.id,
      pl.nome,
      pl.empreendimento,
      s.nome AS etapa,
      pl.stage_id,
      COALESCE(cfg.dias_limite, 7) AS dias_limite,
      pl.estagnado_aviso_em,
      pl.estagnado_prazo_em,
      public._pipeline_tem_tarefa_pendente_futura(pl.id) AS tem_tarefa_futura,
      public._pipeline_referencia_estagnacao(pl.id) AS ref,
      (SELECT MIN((t.vence_em + interval '1 day') AT TIME ZONE 'America/Sao_Paulo')
         FROM public.pipeline_tarefas t
        WHERE t.pipeline_lead_id = pl.id
          AND t.concluida_em IS NULL
          AND COALESCE(t.status,'') <> 'concluida'
          AND t.vence_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS prox_tarefa
    FROM pipeline_leads pl
    JOIN pipeline_stages s ON s.id = pl.stage_id
    JOIN cfg ON cfg.stage_id = pl.stage_id
    WHERE pl.corretor_id = auth.uid()
      AND pl.estagnado IS NOT TRUE
      AND pl.arquivado IS NOT TRUE
      AND pl.negocio_id IS NULL
      AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_parcerias pp
        WHERE pp.pipeline_lead_id = pl.id AND pp.status = 'ativa'
      )
  ),
  calc AS (
    SELECT
      b.*,
      -- Aviso final só vale se NÃO houve revivência (tarefa futura ou ação posterior ao aviso)
      (b.estagnado_aviso_em IS NOT NULL
        AND b.estagnado_prazo_em > now()
        AND NOT b.tem_tarefa_futura
        AND b.ref <= b.estagnado_aviso_em) AS aviso_valido,
      CASE
        WHEN b.estagnado_aviso_em IS NOT NULL AND b.estagnado_prazo_em > now()
             AND NOT b.tem_tarefa_futura AND b.ref <= b.estagnado_aviso_em
          THEN b.estagnado_prazo_em
        WHEN b.tem_tarefa_futura AND b.prox_tarefa IS NOT NULL
          THEN b.prox_tarefa
        ELSE b.ref + (b.dias_limite || ' days')::interval
      END AS prazo_real
    FROM base b
  )
  SELECT
    c.id,
    c.nome,
    c.empreendimento,
    c.etapa,
    c.stage_id,
    c.dias_limite,
    GREATEST(EXTRACT(day FROM now() - c.ref)::int, 0) AS dias_sem_acao,
    c.prazo_real AS prazo_em,
    GREATEST(CEIL(EXTRACT(epoch FROM c.prazo_real - now()) / 86400.0)::int, 0) AS dias_para_estagnar,
    CASE
      WHEN c.aviso_valido THEN 'em_aviso'
      ELSE 'proximo'
    END AS categoria
  FROM calc c
  -- Só mostra urgência real: dentro das 48h antes do prazo (ou já vencido)
  WHERE c.prazo_real <= now() + interval '48 hours'
  ORDER BY c.prazo_real ASC;
$function$;

-- Limpeza pontual: leads presos em aviso que já reviveram (tarefa futura ou ação posterior)
UPDATE pipeline_leads pl
  SET estagnado_aviso_em = NULL,
      estagnado_aviso2_em = NULL,
      estagnado_prazo_em = NULL,
      updated_at = now()
  WHERE pl.estagnado IS NOT TRUE
    AND pl.estagnado_aviso_em IS NOT NULL
    AND (
      public._pipeline_tem_tarefa_pendente_futura(pl.id)
      OR public._pipeline_referencia_estagnacao(pl.id) > pl.estagnado_aviso_em
    );