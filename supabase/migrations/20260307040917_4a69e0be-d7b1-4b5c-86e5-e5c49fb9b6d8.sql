
-- Add approval columns to distribuicao_escala
ALTER TABLE public.distribuicao_escala 
  ADD COLUMN IF NOT EXISTS aprovacao_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

-- Create campaign-to-segment mapping table
CREATE TABLE IF NOT EXISTS public.segmento_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento_id uuid NOT NULL REFERENCES public.pipeline_segmentos(id) ON DELETE CASCADE,
  campanha_nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campanha_nome)
);

ALTER TABLE public.segmento_campanhas ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read campaign mappings
CREATE POLICY "Authenticated can view segmento_campanhas" ON public.segmento_campanhas
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage segmento_campanhas" ON public.segmento_campanhas
  FOR ALL TO authenticated 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Round-robin distribution function
CREATE OR REPLACE FUNCTION public.distribuir_lead_roleta(
  p_pipeline_lead_id uuid,
  p_segmento_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead pipeline_leads%ROWTYPE;
  v_segmento_id uuid;
  v_corretor_id uuid;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_active_count int;
  v_max_leads int := 20;
BEGIN
  -- Get lead
  SELECT * INTO v_lead FROM pipeline_leads WHERE id = p_pipeline_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  -- Already assigned?
  IF v_lead.corretor_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned', 'corretor_id', v_lead.corretor_id);
  END IF;

  -- Determine segmento
  v_segmento_id := COALESCE(p_segmento_id, v_lead.segmento_id);
  
  -- If no segmento, try to map from empreendimento/campanha
  IF v_segmento_id IS NULL AND v_lead.empreendimento IS NOT NULL THEN
    SELECT sc.segmento_id INTO v_segmento_id
    FROM segmento_campanhas sc
    WHERE UPPER(sc.campanha_nome) = UPPER(v_lead.empreendimento)
    LIMIT 1;
  END IF;

  IF v_segmento_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_segmento_identified');
  END IF;

  -- Find best corretor: escalado today, approved, with fewest active leads, under limit
  SELECT de.corretor_id INTO v_corretor_id
  FROM distribuicao_escala de
  WHERE de.data = v_today
    AND de.segmento_id = v_segmento_id
    AND de.ativo = true
    AND de.aprovacao_status = 'aprovado'
    -- Corretor must be available (na_empresa)
    AND EXISTS (
      SELECT 1 FROM corretor_disponibilidade cd
      WHERE cd.user_id = de.corretor_id
        AND cd.status = 'na_empresa'
        AND cd.na_roleta = true
    )
    -- Under max leads limit
    AND (
      SELECT COUNT(*) FROM pipeline_leads pl
      JOIN pipeline_stages ps ON ps.id = pl.stage_id
      WHERE pl.corretor_id = de.corretor_id
        AND ps.tipo NOT IN ('venda', 'descarte')
    ) < v_max_leads
  ORDER BY
    -- Round-robin: fewest leads received today
    (SELECT COUNT(*) FROM distribuicao_historico dh
     WHERE dh.corretor_id = de.corretor_id
       AND dh.created_at >= (v_today::text || 'T00:00:00-03:00')::timestamptz) ASC,
    random()
  LIMIT 1;

  IF v_corretor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_corretor_available', 'segmento_id', v_segmento_id);
  END IF;

  -- Assign lead
  UPDATE pipeline_leads
  SET corretor_id = v_corretor_id,
      segmento_id = v_segmento_id,
      distribuido_em = now(),
      aceite_expira_em = now() + interval '10 minutes',
      updated_at = now()
  WHERE id = p_pipeline_lead_id;

  -- Record distribution history
  INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao)
  VALUES (p_pipeline_lead_id, v_corretor_id, v_segmento_id, 'distribuido');

  -- Increment leads counter
  UPDATE corretor_disponibilidade
  SET leads_recebidos_turno = leads_recebidos_turno + 1
  WHERE user_id = v_corretor_id;

  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_corretor_id,
    'segmento_id', v_segmento_id,
    'expires_at', (now() + interval '10 minutes')
  );
END;
$function$;

-- Function to return expired leads to queue (10-min timeout)
CREATE OR REPLACE FUNCTION public.reciclar_leads_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE pipeline_leads
  SET corretor_id = NULL,
      distribuido_em = NULL,
      aceite_expira_em = NULL,
      updated_at = now()
  WHERE aceite_expira_em < now()
    AND aceito_em IS NULL
    AND corretor_id IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
