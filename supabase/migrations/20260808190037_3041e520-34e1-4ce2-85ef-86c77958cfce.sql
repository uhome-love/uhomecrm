
-- ============ ENUM ============
DO $$ BEGIN
  CREATE TYPE public.ia_etapa AS ENUM (
    'entrada','bloqueado','atendendo','sem_resposta','qualificado',
    'perfil_busca','nutricao','desqualificado','migrado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ updated_at helper (reuso) ============
CREATE OR REPLACE FUNCTION public.ia_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ ia_leads ============
CREATE TABLE public.ia_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  email text,
  telefone text,
  telefone_normalizado text,
  telefone_last8 text,
  meta_lead_id text NOT NULL,
  form_id text NOT NULL,
  campaign_id text,
  adset_id text,
  ad_id text,
  origem text NOT NULL DEFAULT 'meta_lia',
  payload_bruto jsonb,
  etapa public.ia_etapa NOT NULL DEFAULT 'entrada',
  etapa_motivo text,
  checagem_resultado text,
  checagem_detalhe jsonb,
  pausado boolean NOT NULL DEFAULT false,
  assumido_por uuid,
  assumido_em timestamptz,
  opt_out boolean NOT NULL DEFAULT false,
  opt_out_at timestamptz,
  toques_enviados integer NOT NULL DEFAULT 0,
  ultima_mensagem_em timestamptz,
  pipeline_lead_id uuid,
  migrado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_leads_meta_lead_id_key UNIQUE (meta_lead_id)
);
CREATE INDEX ia_leads_telefone_normalizado_idx ON public.ia_leads (telefone_normalizado);
CREATE INDEX ia_leads_telefone_last8_idx ON public.ia_leads (telefone_last8);
CREATE INDEX ia_leads_etapa_idx ON public.ia_leads (etapa);
CREATE INDEX ia_leads_campaign_id_idx ON public.ia_leads (campaign_id);
CREATE INDEX ia_leads_form_id_idx ON public.ia_leads (form_id);
CREATE INDEX ia_leads_pipeline_lead_id_idx ON public.ia_leads (pipeline_lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_leads TO authenticated;
GRANT ALL ON public.ia_leads TO service_role;
ALTER TABLE public.ia_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_leads admin" ON public.ia_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ia_leads_updated_at BEFORE UPDATE ON public.ia_leads
  FOR EACH ROW EXECUTE FUNCTION public.ia_set_updated_at();

-- ============ ia_mensagens ============
CREATE TABLE public.ia_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ia_lead_id uuid NOT NULL REFERENCES public.ia_leads(id) ON DELETE CASCADE,
  direcao text NOT NULL,
  autor text NOT NULL DEFAULT 'lia',
  tipo text NOT NULL DEFAULT 'texto',
  conteudo text,
  media_url text,
  idempotency_key text NOT NULL,
  evolution_message_id text,
  delivery_status text,
  erro text,
  timestamp_origem timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_mensagens_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT ia_mensagens_direcao_chk CHECK (direcao IN ('in','out','note'))
);
CREATE INDEX ia_mensagens_lead_created_idx ON public.ia_mensagens (ia_lead_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_mensagens TO authenticated;
GRANT ALL ON public.ia_mensagens TO service_role;
ALTER TABLE public.ia_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_mensagens admin" ON public.ia_mensagens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ ia_eventos ============
CREATE TABLE public.ia_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ia_lead_id uuid REFERENCES public.ia_leads(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  etapa_de public.ia_etapa,
  etapa_para public.ia_etapa,
  motivo text,
  trecho text,
  ator text NOT NULL DEFAULT 'sistema',
  ator_user_id uuid,
  detalhe jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ia_eventos_lead_idx ON public.ia_eventos (ia_lead_id, created_at DESC);
CREATE INDEX ia_eventos_tipo_idx ON public.ia_eventos (tipo, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_eventos TO authenticated;
GRANT ALL ON public.ia_eventos TO service_role;
ALTER TABLE public.ia_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_eventos admin" ON public.ia_eventos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ ia_followups ============
CREATE TABLE public.ia_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ia_lead_id uuid NOT NULL REFERENCES public.ia_leads(id) ON DELETE CASCADE,
  numero_toque integer NOT NULL,
  agendado_para timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  enviado_em timestamptz,
  cancelado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_followups_lead_toque_key UNIQUE (ia_lead_id, numero_toque),
  CONSTRAINT ia_followups_status_chk CHECK (status IN ('pendente','enviado','cancelado','falhou'))
);
CREATE INDEX ia_followups_pendentes_idx ON public.ia_followups (status, agendado_para);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_followups TO authenticated;
GRANT ALL ON public.ia_followups TO service_role;
ALTER TABLE public.ia_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_followups admin" ON public.ia_followups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ia_followups_updated_at BEFORE UPDATE ON public.ia_followups
  FOR EACH ROW EXECUTE FUNCTION public.ia_set_updated_at();

-- ============ ia_perfil_busca ============
CREATE TABLE public.ia_perfil_busca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ia_lead_id uuid NOT NULL REFERENCES public.ia_leads(id) ON DELETE CASCADE,
  tipo_imovel text,
  dormitorios text,
  regioes text,
  faixa_valor text,
  finalidade text,
  prazo text,
  observacoes text,
  autorizou_repasse boolean NOT NULL DEFAULT false,
  encaminhado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ia_perfil_busca_lead_idx ON public.ia_perfil_busca (ia_lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_perfil_busca TO authenticated;
GRANT ALL ON public.ia_perfil_busca TO service_role;
ALTER TABLE public.ia_perfil_busca ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_perfil_busca admin" ON public.ia_perfil_busca FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ia_perfil_busca_updated_at BEFORE UPDATE ON public.ia_perfil_busca
  FOR EACH ROW EXECUTE FUNCTION public.ia_set_updated_at();

-- ============ ia_apresentacoes ============
CREATE TABLE public.ia_apresentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ia_lead_id uuid NOT NULL REFERENCES public.ia_leads(id) ON DELETE CASCADE,
  data_hora timestamptz,
  status text NOT NULL DEFAULT 'proposta',
  aceite_em timestamptz,
  confirmada_em timestamptz,
  conduzida_por uuid,
  lia_responsavel boolean NOT NULL DEFAULT true,
  link text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_apresentacoes_status_chk CHECK (status IN ('proposta','aceita','confirmada','realizada','no_show','cancelada'))
);
CREATE INDEX ia_apresentacoes_lead_idx ON public.ia_apresentacoes (ia_lead_id);
CREATE INDEX ia_apresentacoes_data_idx ON public.ia_apresentacoes (data_hora);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_apresentacoes TO authenticated;
GRANT ALL ON public.ia_apresentacoes TO service_role;
ALTER TABLE public.ia_apresentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_apresentacoes admin" ON public.ia_apresentacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ia_apresentacoes_updated_at BEFORE UPDATE ON public.ia_apresentacoes
  FOR EACH ROW EXECUTE FUNCTION public.ia_set_updated_at();

-- ============ ia_midias ============
CREATE TABLE public.ia_midias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotulo text NOT NULL,
  url text NOT NULL,
  tipo text NOT NULL DEFAULT 'imagem',
  gatilho text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_midias TO authenticated;
GRANT ALL ON public.ia_midias TO service_role;
ALTER TABLE public.ia_midias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_midias admin" ON public.ia_midias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ia_midias_updated_at BEFORE UPDATE ON public.ia_midias
  FOR EACH ROW EXECUTE FUNCTION public.ia_set_updated_at();

-- ============ ia_config (linha única) ============
CREATE TABLE public.ia_config (
  id boolean PRIMARY KEY DEFAULT true,
  enviar_habilitado boolean NOT NULL DEFAULT false,
  modo_liberacao text NOT NULL DEFAULT 'sombra',
  lia_model text NOT NULL DEFAULT 'google/gemini-3.6-flash',
  prompt_versao text NOT NULL DEFAULT 'lia-canoas-v3.1',
  debounce_segundos integer NOT NULL DEFAULT 10,
  debounce_teto_segundos integer NOT NULL DEFAULT 25,
  max_mensagens_turno integer NOT NULL DEFAULT 3,
  max_midias_conversa integer NOT NULL DEFAULT 3,
  janela_envio_inicio time NOT NULL DEFAULT '08:00',
  janela_envio_fim time NOT NULL DEFAULT '23:59',
  agenda_inicio time NOT NULL DEFAULT '10:00',
  agenda_fim time NOT NULL DEFAULT '20:00',
  agenda_antecedencia_horas integer NOT NULL DEFAULT 2,
  instancia text NOT NULL DEFAULT 'uhome-lia-canoas',
  webhook_secret text,
  webhook_secret_anterior text,
  captura_lia jsonb NOT NULL DEFAULT '{"campaign_ids": [], "form_ids": []}'::jsonb,
  notificacao_canal jsonb NOT NULL DEFAULT '{"push": true, "in_app": true}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_config_singleton_chk CHECK (id = true)
);
GRANT SELECT, INSERT, UPDATE ON public.ia_config TO authenticated;
GRANT ALL ON public.ia_config TO service_role;
ALTER TABLE public.ia_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_config admin" ON public.ia_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ia_config_updated_at BEFORE UPDATE ON public.ia_config
  FOR EACH ROW EXECUTE FUNCTION public.ia_set_updated_at();
INSERT INTO public.ia_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ============ ia_prompt_versoes ============
CREATE TABLE public.ia_prompt_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao text NOT NULL,
  arquivo text NOT NULL,
  ativa boolean NOT NULL DEFAULT false,
  ativada_em timestamptz,
  ativada_por uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_prompt_versoes_versao_key UNIQUE (versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_prompt_versoes TO authenticated;
GRANT ALL ON public.ia_prompt_versoes TO service_role;
ALTER TABLE public.ia_prompt_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_prompt_versoes admin" ON public.ia_prompt_versoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.ia_prompt_versoes (versao, arquivo, ativa, ativada_em)
VALUES ('lia-canoas-v3.1', 'supabase/functions/lia-brain/prompt/lia-canoas-v3.1.txt', true, now())
ON CONFLICT (versao) DO NOTHING;
