
-- 1. Create nurturing_cadencias table
CREATE TABLE public.nurturing_cadencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_tipo TEXT NOT NULL,
  step_number INT NOT NULL,
  delay_dias INT NOT NULL DEFAULT 0,
  canal TEXT NOT NULL,
  template_name TEXT NOT NULL,
  descricao TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stage_tipo, step_number)
);

ALTER TABLE public.nurturing_cadencias ENABLE ROW LEVEL SECURITY;

-- Admin/gestor can do everything
CREATE POLICY "Admin/gestor full access on nurturing_cadencias"
  ON public.nurturing_cadencias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- All authenticated can read
CREATE POLICY "Authenticated can read nurturing_cadencias"
  ON public.nurturing_cadencias FOR SELECT TO authenticated
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_nurturing_cadencias_updated_at
  BEFORE UPDATE ON public.nurturing_cadencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Insert cadência: descarte_reengajamento (5 steps)
INSERT INTO public.nurturing_cadencias (stage_tipo, step_number, delay_dias, canal, template_name, descricao) VALUES
  ('descarte_reengajamento', 1, 1,  'whatsapp', 'reengajamento_01',       'Primeiro contato WhatsApp pós-descarte'),
  ('descarte_reengajamento', 2, 3,  'email',    'reengajamento_email_01', 'E-mail de reengajamento inicial'),
  ('descarte_reengajamento', 3, 7,  'whatsapp', 'reengajamento_02',       'Segundo contato WhatsApp com novidades'),
  ('descarte_reengajamento', 4, 10, 'email',    'reengajamento_email_02', 'E-mail com condições especiais'),
  ('descarte_reengajamento', 5, 14, 'whatsapp', 'reengajamento_final',    'Último contato antes de encerrar');

-- 3. Insert cadência: descarte_reengajamento_financeiro (5 steps, starts at day 30)
INSERT INTO public.nurturing_cadencias (stage_tipo, step_number, delay_dias, canal, template_name, descricao) VALUES
  ('descarte_reengajamento_financeiro', 1, 30, 'whatsapp', 'reengajamento_01',       'Primeiro contato WhatsApp (30 dias após descarte)'),
  ('descarte_reengajamento_financeiro', 2, 33, 'email',    'reengajamento_email_01', 'E-mail de reengajamento financeiro'),
  ('descarte_reengajamento_financeiro', 3, 37, 'whatsapp', 'reengajamento_02',       'Segundo contato WhatsApp com opções'),
  ('descarte_reengajamento_financeiro', 4, 40, 'email',    'reengajamento_email_02', 'E-mail com novas condições'),
  ('descarte_reengajamento_financeiro', 5, 44, 'whatsapp', 'reengajamento_final',    'Último contato antes de encerrar');

-- 4. New trigger function for descarte reengajamento
CREATE OR REPLACE FUNCTION public.handle_descarte_reengajamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_descarte_stage_id UUID := '1dd66c25-3848-4053-9f66-82e902989b4d';
  v_stage_tipo TEXT;
  v_cadencia RECORD;
  v_max_step INT;
BEGIN
  -- Only fire when stage changes TO descarte AND tipo_descarte = reengajavel
  IF NEW.stage_id = v_descarte_stage_id
     AND (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
     AND NEW.tipo_descarte = 'reengajavel'
  THEN
    -- Determine which cadência to use based on motivo
    IF NEW.motivo_descarte ILIKE '%financ%' OR NEW.motivo_descarte ILIKE '%valor%' OR NEW.motivo_descarte ILIKE '%caro%' OR NEW.motivo_descarte ILIKE '%preço%' THEN
      v_stage_tipo := 'descarte_reengajamento_financeiro';
    ELSE
      v_stage_tipo := 'descarte_reengajamento';
    END IF;

    -- Cancel any existing pending nurturing for this lead
    UPDATE lead_nurturing_sequences
    SET status = 'cancelado'
    WHERE pipeline_lead_id = NEW.id AND status = 'pendente';

    -- Get max step for detecting last step
    SELECT MAX(step_number) INTO v_max_step
    FROM nurturing_cadencias
    WHERE stage_tipo = v_stage_tipo AND is_active = true;

    -- Insert execution rows from cadência definitions
    FOR v_cadencia IN
      SELECT * FROM nurturing_cadencias
      WHERE stage_tipo = v_stage_tipo AND is_active = true
      ORDER BY step_number
    LOOP
      INSERT INTO lead_nurturing_sequences (
        pipeline_lead_id, stage_tipo, step_key, canal, template_name,
        mensagem, scheduled_at, status
      ) VALUES (
        NEW.id,
        v_stage_tipo,
        v_stage_tipo || '_step' || v_cadencia.step_number,
        v_cadencia.canal,
        v_cadencia.template_name,
        v_cadencia.descricao,
        now() + (v_cadencia.delay_dias * interval '1 day'),
        'pendente'
      )
      ON CONFLICT (pipeline_lead_id, step_key) DO NOTHING;
    END LOOP;

    -- Create/update lead_nurturing_state
    INSERT INTO lead_nurturing_state (
      pipeline_lead_id, sequencia_ativa, step_atual, status, proximo_step_at
    ) VALUES (
      NEW.id,
      v_stage_tipo,
      1,
      'ativo',
      now() + ((SELECT delay_dias FROM nurturing_cadencias WHERE stage_tipo = v_stage_tipo AND step_number = 1 AND is_active = true) * interval '1 day')
    )
    ON CONFLICT (pipeline_lead_id) DO UPDATE SET
      sequencia_ativa = EXCLUDED.sequencia_ativa,
      step_atual = 1,
      status = 'ativo',
      proximo_step_at = EXCLUDED.proximo_step_at,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Create trigger on pipeline_leads
CREATE TRIGGER trg_descarte_reengajamento
  AFTER UPDATE ON public.pipeline_leads
  FOR EACH ROW
  WHEN (NEW.stage_id IS DISTINCT FROM OLD.stage_id)
  EXECUTE FUNCTION public.handle_descarte_reengajamento();
