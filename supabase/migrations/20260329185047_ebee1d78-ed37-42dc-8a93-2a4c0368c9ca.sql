
-- Table for tracking nurturing sequence steps per lead
CREATE TABLE public.lead_nurturing_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  stage_tipo TEXT NOT NULL,
  step_key TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  template_name TEXT,
  mensagem TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lead_step UNIQUE (pipeline_lead_id, step_key)
);

-- Index for the cron processor
CREATE INDEX idx_nurturing_pending ON public.lead_nurturing_sequences (scheduled_at) WHERE status = 'pendente';
CREATE INDEX idx_nurturing_lead ON public.lead_nurturing_sequences (pipeline_lead_id);

-- Enable RLS (only service_role access)
ALTER TABLE public.lead_nurturing_sequences ENABLE ROW LEVEL SECURITY;

-- Function to create nurturing steps when lead changes stage
CREATE OR REPLACE FUNCTION public.create_nurturing_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_tipo TEXT;
  v_lead_id UUID;
BEGIN
  v_lead_id := NEW.id;
  
  -- Get stage tipo
  SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
  IF v_stage_tipo IS NULL THEN RETURN NEW; END IF;

  -- Cancel pending steps from previous stage
  UPDATE lead_nurturing_sequences 
  SET status = 'cancelado'
  WHERE pipeline_lead_id = v_lead_id AND status = 'pendente';

  -- Insert new steps based on stage
  IF v_stage_tipo IN ('novo', 'sem_contato') THEN
    INSERT INTO lead_nurturing_sequences (pipeline_lead_id, stage_tipo, step_key, canal, template_name, mensagem, scheduled_at)
    VALUES 
      (v_lead_id, v_stage_tipo, 'sem_contato_d0', 'whatsapp', 'boas_vindas', 'Boas-vindas + apresentação corretor', now()),
      (v_lead_id, v_stage_tipo, 'sem_contato_d2', 'whatsapp', 'follow_up_interesse', 'Follow-up interesse', now() + interval '2 days'),
      (v_lead_id, v_stage_tipo, 'sem_contato_d5', 'whatsapp', 'vitrine_imoveis_personalizada', 'Vitrine IA personalizada', now() + interval '5 days')
    ON CONFLICT (pipeline_lead_id, step_key) DO NOTHING;

  ELSIF v_stage_tipo = 'contato_iniciado' THEN
    INSERT INTO lead_nurturing_sequences (pipeline_lead_id, stage_tipo, step_key, canal, template_name, mensagem, scheduled_at)
    VALUES 
      (v_lead_id, v_stage_tipo, 'contato_d0', 'whatsapp', 'material_empreendimento', 'Material do empreendimento', now()),
      (v_lead_id, v_stage_tipo, 'contato_d3', 'whatsapp', 'follow_up_conexao', 'Follow-up conexão', now() + interval '3 days')
    ON CONFLICT (pipeline_lead_id, step_key) DO NOTHING;

  ELSIF v_stage_tipo = 'qualificacao' THEN
    INSERT INTO lead_nurturing_sequences (pipeline_lead_id, stage_tipo, step_key, canal, template_name, mensagem, scheduled_at)
    VALUES 
      (v_lead_id, v_stage_tipo, 'qualificacao_d0', 'whatsapp', 'vitrine_personalizada', 'Vitrine personalizada', now()),
      (v_lead_id, v_stage_tipo, 'qualificacao_d4', 'whatsapp', 'imoveis_novos', 'Imóveis novos para você', now() + interval '4 days')
    ON CONFLICT (pipeline_lead_id, step_key) DO NOTHING;

  ELSIF v_stage_tipo = 'possivel_visita' THEN
    INSERT INTO lead_nurturing_sequences (pipeline_lead_id, stage_tipo, step_key, canal, template_name, mensagem, scheduled_at)
    VALUES 
      (v_lead_id, v_stage_tipo, 'possivel_visita_d0', 'whatsapp', 'destaques_imovel', 'Destaques do imóvel', now()),
      (v_lead_id, v_stage_tipo, 'possivel_visita_d2', 'whatsapp', 'proposta_agenda', 'Proposta de agenda', now() + interval '2 days')
    ON CONFLICT (pipeline_lead_id, step_key) DO NOTHING;

  ELSIF v_stage_tipo = 'visita_marcada' THEN
    INSERT INTO lead_nurturing_sequences (pipeline_lead_id, stage_tipo, step_key, canal, template_name, mensagem, scheduled_at)
    VALUES 
      (v_lead_id, v_stage_tipo, 'visita_marcada_d0', 'whatsapp', 'confirmacao_visita', 'Confirmação da visita', now())
    ON CONFLICT (pipeline_lead_id, step_key) DO NOTHING;

  ELSIF v_stage_tipo = 'visita_realizada' THEN
    INSERT INTO lead_nurturing_sequences (pipeline_lead_id, stage_tipo, step_key, canal, template_name, mensagem, scheduled_at)
    VALUES 
      (v_lead_id, v_stage_tipo, 'visita_realizada_d0', 'whatsapp', 'agradecimento_visita', 'Agradecimento pós-visita', now()),
      (v_lead_id, v_stage_tipo, 'visita_realizada_d3', 'whatsapp', 'envio_simulacao', 'Envio de simulação', now() + interval '3 days')
    ON CONFLICT (pipeline_lead_id, step_key) DO NOTHING;

  ELSIF v_stage_tipo IN ('negociacao', 'proposta') THEN
    INSERT INTO lead_nurturing_sequences (pipeline_lead_id, stage_tipo, step_key, canal, template_name, mensagem, scheduled_at)
    VALUES 
      (v_lead_id, v_stage_tipo, 'negociacao_d3', 'whatsapp', 'follow_up_proposta', 'Follow-up proposta', now() + interval '3 days'),
      (v_lead_id, v_stage_tipo, 'negociacao_d7', 'whatsapp', 'condicoes_especiais', 'Condições especiais / urgência', now() + interval '7 days')
    ON CONFLICT (pipeline_lead_id, step_key) DO NOTHING;

  ELSIF v_stage_tipo = 'venda_realizada' THEN
    INSERT INTO lead_nurturing_sequences (pipeline_lead_id, stage_tipo, step_key, canal, template_name, mensagem, scheduled_at)
    VALUES 
      (v_lead_id, v_stage_tipo, 'venda_d0', 'whatsapp', 'parabens_venda', 'Parabéns pela compra', now()),
      (v_lead_id, v_stage_tipo, 'venda_d30', 'whatsapp', 'check_in_30d', 'Check-in 30 dias', now() + interval '30 days')
    ON CONFLICT (pipeline_lead_id, step_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on stage_id change
CREATE TRIGGER trg_nurturing_on_stage_change
AFTER UPDATE OF stage_id ON public.pipeline_leads
FOR EACH ROW
WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
EXECUTE FUNCTION public.create_nurturing_sequence();
