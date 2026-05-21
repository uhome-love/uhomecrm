
INSERT INTO public.system_flags (flag_name, flag_value, reason)
VALUES ('campanha_atrio_enabled', false, 'Kill switch global da Campanha Átrio Boutique Haus')
ON CONFLICT (flag_name) DO NOTHING;

CREATE TABLE public.campanha_atrio_audiencia (
  lead_id UUID PRIMARY KEY REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  onda SMALLINT NOT NULL CHECK (onda IN (1,2,3)),
  empreendimento_origem TEXT,
  telefone_normalizado TEXT NOT NULL,
  nome TEXT,
  ordem INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_atrio_aud_onda_status ON public.campanha_atrio_audiencia(onda, status);

CREATE TABLE public.campanha_atrio_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  nome TEXT,
  onda SMALLINT NOT NULL,
  empreendimento_origem TEXT,
  status_envio TEXT NOT NULL CHECK (status_envio IN ('sucesso','erro','pulado')),
  mensagem_id_meta TEXT,
  codigo_erro_meta TEXT,
  detalhe_erro TEXT,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_atrio_ev_lead ON public.campanha_atrio_eventos(lead_id);
CREATE INDEX idx_atrio_ev_onda ON public.campanha_atrio_eventos(onda);
CREATE INDEX idx_atrio_ev_wamid ON public.campanha_atrio_eventos(mensagem_id_meta) WHERE mensagem_id_meta IS NOT NULL;
CREATE INDEX idx_atrio_ev_recente ON public.campanha_atrio_eventos(enviado_em DESC);

CREATE TABLE public.campanha_atrio_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  tipo_resposta TEXT NOT NULL CHECK (tipo_resposta IN ('sim','nao','texto_livre')),
  conteudo_resposta TEXT,
  wamid_origem TEXT,
  enviado_para_roleta BOOLEAN NOT NULL DEFAULT false,
  corretor_designado_id UUID,
  motivo_falha_roleta TEXT,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_atrio_resp_tipo ON public.campanha_atrio_respostas(tipo_resposta);
CREATE INDEX idx_atrio_resp_recente ON public.campanha_atrio_respostas(recebido_em DESC);

CREATE TABLE public.campanha_atrio_controle (
  onda SMALLINT PRIMARY KEY CHECK (onda IN (1,2,3)),
  status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','em_curso','pausada','concluida')),
  total_alvo INTEGER NOT NULL,
  total_enviado INTEGER NOT NULL DEFAULT 0,
  total_erros INTEGER NOT NULL DEFAULT 0,
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  pausada_em TIMESTAMPTZ,
  motivo_pausa TEXT
);
INSERT INTO public.campanha_atrio_controle (onda, total_alvo) VALUES (1,50),(2,150),(3,244);

ALTER TABLE public.campanha_atrio_audiencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanha_atrio_eventos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanha_atrio_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanha_atrio_controle  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atrio_aud_admin_select"  ON public.campanha_atrio_audiencia  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "atrio_ev_admin_select"   ON public.campanha_atrio_eventos    FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "atrio_resp_admin_select" ON public.campanha_atrio_respostas  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "atrio_ctrl_admin_select" ON public.campanha_atrio_controle   FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
