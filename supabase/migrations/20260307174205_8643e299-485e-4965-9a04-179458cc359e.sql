
-- ============================
-- MOTOR 4: Stale lead detection trigger
-- ============================
-- Add last_escalation_at to pipeline_leads for notification escalation tracking
ALTER TABLE public.pipeline_leads 
ADD COLUMN IF NOT EXISTS last_escalation_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS oportunidade_score integer DEFAULT 0;

-- Function to detect and alert stale leads
CREATE OR REPLACE FUNCTION public.detectar_leads_parados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead record;
  v_count integer := 0;
  v_stage_tipo text;
  v_mins integer;
  v_threshold integer;
  v_gerente_ids uuid[];
  v_gid uuid;
  v_corretor_nome text;
BEGIN
  -- Thresholds by stage type (in minutes)
  -- novo_lead/sem_contato: 15min, contato_inicial: 60min, atendimento: 120min, others: 240min
  
  FOR v_lead IN
    SELECT pl.id, pl.nome, pl.corretor_id, pl.stage_id, pl.stage_changed_at, 
           pl.empreendimento, pl.valor_estimado, ps.tipo, ps.nome as stage_nome,
           EXTRACT(EPOCH FROM (now() - pl.stage_changed_at)) / 60 as minutos_parado
    FROM pipeline_leads pl
    JOIN pipeline_stages ps ON ps.id = pl.stage_id
    WHERE ps.tipo NOT IN ('venda', 'descarte')
      AND pl.stage_changed_at < now() - interval '15 minutes'
      -- Only alert once per 30min window
      AND (pl.last_escalation_at IS NULL OR pl.last_escalation_at < now() - interval '30 minutes')
  LOOP
    -- Dynamic threshold based on stage
    v_threshold := CASE v_lead.tipo
      WHEN 'novo_lead' THEN 15
      WHEN 'sem_contato' THEN 30
      WHEN 'contato_inicial' THEN 60
      WHEN 'atendimento' THEN 120
      WHEN 'qualificacao' THEN 120
      ELSE 240
    END;

    IF v_lead.minutos_parado >= v_threshold THEN
      -- Get manager IDs
      SELECT array_agg(DISTINCT ur.user_id) INTO v_gerente_ids
      FROM user_roles ur WHERE ur.role IN ('gestor', 'admin');

      SELECT nome INTO v_corretor_nome FROM profiles WHERE user_id = v_lead.corretor_id;

      IF v_gerente_ids IS NOT NULL THEN
        FOREACH v_gid IN ARRAY v_gerente_ids LOOP
          PERFORM criar_notificacao(
            v_gid, 'alertas', 'lead_parado',
            '⏰ Lead parado: ' || COALESCE(v_lead.nome, 'N/A'),
            COALESCE(v_corretor_nome, 'Sem corretor') || ' — ' || v_lead.stage_nome || ' há ' || 
            CASE 
              WHEN v_lead.minutos_parado >= 1440 THEN round(v_lead.minutos_parado / 1440) || ' dias'
              WHEN v_lead.minutos_parado >= 60 THEN round(v_lead.minutos_parado / 60) || 'h'
              ELSE round(v_lead.minutos_parado) || 'min'
            END,
            jsonb_build_object('lead_id', v_lead.id, 'nome', v_lead.nome, 'stage', v_lead.stage_nome, 'minutos', round(v_lead.minutos_parado)),
            'lead_parado_' || v_lead.id::text
          );
        END LOOP;
      END IF;

      -- Also notify the corretor
      IF v_lead.corretor_id IS NOT NULL THEN
        PERFORM criar_notificacao(
          v_lead.corretor_id, 'alertas', 'lead_parado',
          '⏰ Seu lead precisa de atenção',
          v_lead.nome || ' está na etapa "' || v_lead.stage_nome || '" há ' ||
          CASE 
            WHEN v_lead.minutos_parado >= 60 THEN round(v_lead.minutos_parado / 60) || 'h'
            ELSE round(v_lead.minutos_parado) || 'min'
          END || '. Atualize o status!',
          jsonb_build_object('lead_id', v_lead.id),
          'lead_parado_corretor_' || v_lead.id::text
        );
      END IF;

      -- Update escalation tracking
      UPDATE pipeline_leads SET last_escalation_at = now(), escalation_level = escalation_level + 1
      WHERE id = v_lead.id;

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================
-- MOTOR 7: Opportunity scoring function
-- ============================
CREATE OR REPLACE FUNCTION public.calcular_oportunidade_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score integer := 0;
  v_stage_tipo text;
  v_days_in_stage integer;
  v_has_visit boolean;
  v_has_proposal boolean;
BEGIN
  SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
  
  -- Stage advancement score (max 40)
  v_score := v_score + CASE v_stage_tipo
    WHEN 'novo_lead' THEN 5
    WHEN 'sem_contato' THEN 5
    WHEN 'contato_inicial' THEN 10
    WHEN 'atendimento' THEN 15
    WHEN 'qualificacao' THEN 20
    WHEN 'possibilidade_visita' THEN 25
    WHEN 'visita_marcada' THEN 30
    WHEN 'visita_realizada' THEN 35
    WHEN 'negociacao' THEN 38
    WHEN 'proposta' THEN 40
    WHEN 'assinatura' THEN 40
    ELSE 0
  END;

  -- Value score (max 25)
  IF COALESCE(NEW.valor_estimado, 0) >= 800000 THEN v_score := v_score + 25;
  ELSIF COALESCE(NEW.valor_estimado, 0) >= 500000 THEN v_score := v_score + 20;
  ELSIF COALESCE(NEW.valor_estimado, 0) >= 300000 THEN v_score := v_score + 15;
  ELSIF COALESCE(NEW.valor_estimado, 0) >= 150000 THEN v_score := v_score + 10;
  ELSIF COALESCE(NEW.valor_estimado, 0) > 0 THEN v_score := v_score + 5;
  END IF;

  -- Velocity score: fast progression = higher score (max 20)
  v_days_in_stage := EXTRACT(EPOCH FROM (now() - COALESCE(NEW.stage_changed_at, NEW.created_at))) / 86400;
  IF v_days_in_stage < 1 THEN v_score := v_score + 20;
  ELSIF v_days_in_stage < 3 THEN v_score := v_score + 15;
  ELSIF v_days_in_stage < 7 THEN v_score := v_score + 10;
  ELSIF v_days_in_stage < 14 THEN v_score := v_score + 5;
  END IF;

  -- Has gerente involved = +5
  IF NEW.gerente_id IS NOT NULL THEN v_score := v_score + 5; END IF;

  -- Priority bonus (max 10)
  IF NEW.prioridade_lead = 'alta' THEN v_score := v_score + 10;
  ELSIF NEW.prioridade_lead = 'media' THEN v_score := v_score + 5;
  END IF;

  NEW.oportunidade_score := LEAST(v_score, 100);
  RETURN NEW;
END;
$$;

-- Create trigger for opportunity scoring
DROP TRIGGER IF EXISTS trg_calcular_oportunidade ON public.pipeline_leads;
CREATE TRIGGER trg_calcular_oportunidade
  BEFORE INSERT OR UPDATE ON public.pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION calcular_oportunidade_score();

-- ============================
-- MOTOR 3: Notification escalation function
-- ============================
CREATE OR REPLACE FUNCTION public.escalonar_notificacoes_leads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead record;
  v_count integer := 0;
  v_mins integer;
BEGIN
  -- Process leads that are pending acceptance (distribuídos mas sem aceite)
  FOR v_lead IN
    SELECT pl.id, pl.nome, pl.corretor_id, pl.distribuido_em, pl.escalation_level,
           pl.telefone, pl.empreendimento,
           EXTRACT(EPOCH FROM (now() - pl.distribuido_em)) / 60 as minutos
    FROM pipeline_leads pl
    WHERE pl.aceite_status = 'pendente'
      AND pl.corretor_id IS NOT NULL
      AND pl.distribuido_em IS NOT NULL
  LOOP
    v_mins := v_lead.minutos::integer;
    
    -- Level 0 → 20s: already handled by push (immediate)
    -- Level 1 → 2min: WhatsApp + push reminder  
    IF v_mins >= 2 AND v_lead.escalation_level < 1 THEN
      PERFORM criar_notificacao(
        v_lead.corretor_id, 'leads', 'lead_urgente',
        '⚡ Lead aguardando aceite há 2 min!',
        'Aceite o lead ' || COALESCE(v_lead.nome, 'N/A') || ' AGORA ou será redistribuído.',
        jsonb_build_object('lead_id', v_lead.id, 'urgencia', 'alta'),
        NULL
      );
      UPDATE pipeline_leads SET escalation_level = 1, last_escalation_at = now() WHERE id = v_lead.id;
      v_count := v_count + 1;
    
    -- Level 2 → 4min: Final alert
    ELSIF v_mins >= 4 AND v_lead.escalation_level < 2 THEN
      PERFORM criar_notificacao(
        v_lead.corretor_id, 'leads', 'lead_ultimo_alerta',
        '🚨 ÚLTIMO ALERTA — Lead será redistribuído!',
        v_lead.nome || ' será redistribuído em 1 minuto. Aceite AGORA!',
        jsonb_build_object('lead_id', v_lead.id, 'urgencia', 'critica'),
        NULL
      );
      UPDATE pipeline_leads SET escalation_level = 2, last_escalation_at = now() WHERE id = v_lead.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
