-- Updates que mexem só em campos de sistema (avisos) não contam como atualização do lead.
CREATE OR REPLACE FUNCTION public._pipeline_lead_so_campos_sistema(p_old public.pipeline_leads, p_new public.pipeline_leads)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT (to_jsonb(p_old) - ARRAY['updated_at','ultima_acao_at','last_escalation_at','escalation_level','reciclagem_aviso_at','estagnado_aviso_em'])
       = (to_jsonb(p_new) - ARRAY['updated_at','ultima_acao_at','last_escalation_at','escalation_level','reciclagem_aviso_at','estagnado_aviso_em']);
$$;

CREATE OR REPLACE FUNCTION public.update_lead_ultima_acao()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF public._pipeline_lead_so_campos_sistema(OLD, NEW) THEN
    NEW.ultima_acao_at := OLD.ultima_acao_at;
    RETURN NEW;
  END IF;
  NEW.ultima_acao_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_leads_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF public._pipeline_lead_so_campos_sistema(OLD, NEW) THEN
    NEW.updated_at := OLD.updated_at;
  ELSE
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_pipeline_leads_updated_at ON public.pipeline_leads;
CREATE TRIGGER update_pipeline_leads_updated_at BEFORE UPDATE ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.pipeline_leads_set_updated_at();

-- Aviso segue a cor do Pipeline: avisa só quando o lead acabou de ficar amarelo ou vermelho.
CREATE OR REPLACE FUNCTION public.detectar_leads_parados()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_lead record;
  v_count integer := 0;
  v_key text;
  v_titulo text;
  v_msg text;
BEGIN
  FOR v_lead IN
    WITH base AS (
      SELECT pl.id, pl.nome, pl.corretor_id, ps.nome AS stage_nome, ps.tipo::text AS tipo,
             public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.aceito_em, pl.created_at), ps.tipo::text, pl.estagnacao_carencia_ate) AS cor,
             GREATEST(COALESCE(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.aceito_em, pl.created_at)),
                      COALESCE(COALESCE(pl.distribuido_em, pl.aceito_em, pl.created_at), pl.ultimo_toque_at)) AS relogio
      FROM pipeline_leads pl
      JOIN pipeline_stages ps ON ps.id = pl.stage_id
      WHERE ps.tipo NOT IN ('venda', 'descarte')
        AND pl.corretor_id IS NOT NULL
        AND pl.arquivado = false
        AND pl.aceite_status = 'aceito'
        AND NOT EXISTS (SELECT 1 FROM negocios n WHERE n.pipeline_lead_id = pl.id AND n.status IN ('ativo','assinado','ganho'))
    ), calc AS (
      SELECT b.*,
        EXTRACT(EPOCH FROM (now() - b.relogio))/86400.0 AS dias,
        CASE b.tipo WHEN 'novo_lead' THEN 1 WHEN 'sem_contato' THEN 2 WHEN 'qualificacao' THEN 7 WHEN 'aquecimento' THEN 15
          WHEN 'visita' THEN 2 WHEN 'proposta' THEN 7 WHEN 'contrato_gerado' THEN 7 ELSE 7 END AS prazo,
        CASE b.tipo WHEN 'sem_contato' THEN 15 WHEN 'qualificacao' THEN 21 WHEN 'aquecimento' THEN 21 ELSE NULL END AS estagna
      FROM base b WHERE b.cor IN ('ambar','vermelho')
    )
    SELECT * FROM calc
    -- só quem entrou na cor nos últimos 2 dias (sem avalanche de atrasados antigos)
    WHERE (cor = 'ambar' AND dias <= prazo + 2) OR (cor = 'vermelho' AND dias <= prazo * 2 + 2)
  LOOP
    v_key := 'saude_' || v_lead.cor || '_' || v_lead.id::text || '_' || to_char(v_lead.relogio, 'YYYYMMDDHH24MISS');
    CONTINUE WHEN EXISTS (SELECT 1 FROM notifications WHERE agrupamento_key = v_key);

    IF v_lead.cor = 'ambar' THEN
      v_titulo := '🟡 ' || COALESCE(v_lead.nome, 'Lead') || ' precisa de atenção';
      v_msg := floor(v_lead.dias)::int || ' dias sem contato.';
    ELSE
      v_titulo := '🔴 ' || COALESCE(v_lead.nome, 'Lead') || ' está desatualizado';
      v_msg := floor(v_lead.dias)::int || ' dias sem contato.';
    END IF;
    IF v_lead.estagna IS NOT NULL THEN
      v_msg := v_msg || ' Estagna em ' || GREATEST(0, ceil(v_lead.estagna - v_lead.dias))::int || ' dias se não houver contato.';
    ELSE
      v_msg := v_msg || ' Registre um contato ou tarefa.';
    END IF;

    PERFORM criar_notificacao(
      v_lead.corretor_id, 'alertas', 'lead_desatualizado', v_titulo, v_msg,
      jsonb_build_object('lead_id', v_lead.id, 'pipeline_lead_id', v_lead.id, 'lead_nome', v_lead.nome,
                         'etapa', v_lead.stage_nome, 'saude', v_lead.cor, 'dias_sem_contato', floor(v_lead.dias)::int),
      v_key
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;