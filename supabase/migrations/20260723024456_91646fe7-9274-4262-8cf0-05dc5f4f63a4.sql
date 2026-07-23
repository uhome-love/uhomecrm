-- ============================================================================
-- MUTIRÃO INTELIGENTE (Oferta Ativa Ao Vivo) — Fase 1 · Migration única
-- ============================================================================

CREATE OR REPLACE FUNCTION public.oa_ao_vivo_is_gestor_of(_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.profiles p ON p.user_id = tm.user_id
    WHERE p.id = _profile_id
      AND tm.gerente_id = auth.uid()
      AND tm.status = 'ativo'
  );
$$;

CREATE OR REPLACE FUNCTION public.oa_ao_vivo_my_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 1) oferta_ativa_sessoes
CREATE TABLE public.oferta_ativa_sessoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data        date NOT NULL,
  inicio_at   timestamptz NOT NULL,
  fim_at      timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'agendada'
              CHECK (status IN ('agendada','ao_vivo','encerrada')),
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oa_sessoes_status ON public.oferta_ativa_sessoes(status);
CREATE INDEX idx_oa_sessoes_data ON public.oferta_ativa_sessoes(data DESC);

GRANT SELECT ON public.oferta_ativa_sessoes TO authenticated;
GRANT ALL ON public.oferta_ativa_sessoes TO service_role;

ALTER TABLE public.oferta_ativa_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OA sessoes: authenticated read"
  ON public.oferta_ativa_sessoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "OA sessoes: admin/diretor write"
  ON public.oferta_ativa_sessoes FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "OA sessoes: admin/diretor update"
  ON public.oferta_ativa_sessoes FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "OA sessoes: admin/diretor delete"
  ON public.oferta_ativa_sessoes FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
  );

-- 2) oferta_ativa_participantes
CREATE TABLE public.oferta_ativa_participantes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id             uuid NOT NULL REFERENCES public.oferta_ativa_sessoes(id) ON DELETE CASCADE,
  corretor_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gerente_id            uuid REFERENCES public.profiles(id),
  equipe_text           text,
  status_online         text NOT NULL DEFAULT 'offline'
                        CHECK (status_online IN ('online','ausente','ocioso','offline')),
  ultima_acao_at        timestamptz,
  ultimo_heartbeat_at   timestamptz,
  meta_ligacoes         int NOT NULL DEFAULT 0,
  meta_aproveitamentos  int NOT NULL DEFAULT 0,
  meta_visitas          int NOT NULL DEFAULT 0,
  pontos                int NOT NULL DEFAULT 0,
  ligacoes_count        int NOT NULL DEFAULT 0,
  aproveitamentos_count int NOT NULL DEFAULT 0,
  visitas_count         int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sessao_id, corretor_id)
);
CREATE INDEX idx_oa_part_sessao ON public.oferta_ativa_participantes(sessao_id);
CREATE INDEX idx_oa_part_gerente ON public.oferta_ativa_participantes(sessao_id, gerente_id);
CREATE INDEX idx_oa_part_status ON public.oferta_ativa_participantes(sessao_id, status_online);

GRANT SELECT, INSERT, UPDATE ON public.oferta_ativa_participantes TO authenticated;
GRANT ALL ON public.oferta_ativa_participantes TO service_role;

ALTER TABLE public.oferta_ativa_participantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OA part: read scoped"
  ON public.oferta_ativa_participantes FOR SELECT TO authenticated
  USING (
    corretor_id = oa_ao_vivo_my_profile_id()
    OR oa_ao_vivo_is_gestor_of(corretor_id)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "OA part: self insert"
  ON public.oferta_ativa_participantes FOR INSERT TO authenticated
  WITH CHECK (corretor_id = oa_ao_vivo_my_profile_id());

CREATE POLICY "OA part: self update"
  ON public.oferta_ativa_participantes FOR UPDATE TO authenticated
  USING (
    corretor_id = oa_ao_vivo_my_profile_id()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
  );

-- 3) oferta_ativa_fila
CREATE TABLE public.oferta_ativa_fila (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id                 uuid NOT NULL REFERENCES public.oferta_ativa_sessoes(id) ON DELETE CASCADE,
  pipeline_lead_id          uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  balde                     text NOT NULL CHECK (balde IN ('verde','verde_hot','amarelo')),
  bucket_order              int  NOT NULL DEFAULT 1,
  locked_by                 uuid REFERENCES public.profiles(id),
  locked_until              timestamptz,
  cooldown_ate              timestamptz,
  ultimo_corretor_id        uuid REFERENCES public.profiles(id),
  ultimo_oferecido_em       timestamptz,
  claimed_by                uuid REFERENCES public.profiles(id),
  claimed_until             timestamptz,
  empreendimento_id         uuid REFERENCES public.empreendimentos_canonicos(id),
  segmento_id               uuid REFERENCES public.roleta_segmentos(id),
  motivo_descarte_raw       text,
  reengajamento_status_raw  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sessao_id, pipeline_lead_id)
);
CREATE INDEX idx_oa_fila_serve
  ON public.oferta_ativa_fila (sessao_id, bucket_order, created_at)
  WHERE locked_by IS NULL AND claimed_by IS NULL;
CREATE INDEX idx_oa_fila_lock ON public.oferta_ativa_fila(sessao_id, locked_until);
CREATE INDEX idx_oa_fila_cooldown ON public.oferta_ativa_fila(sessao_id, cooldown_ate);
CREATE INDEX idx_oa_fila_claim ON public.oferta_ativa_fila(claimed_by, claimed_until);
CREATE INDEX idx_oa_fila_empreend ON public.oferta_ativa_fila(sessao_id, empreendimento_id);
CREATE INDEX idx_oa_fila_segmento ON public.oferta_ativa_fila(sessao_id, segmento_id);
CREATE INDEX idx_oa_fila_ultimo_corretor ON public.oferta_ativa_fila(pipeline_lead_id, ultimo_corretor_id);

GRANT SELECT ON public.oferta_ativa_fila TO authenticated;
GRANT ALL ON public.oferta_ativa_fila TO service_role;

ALTER TABLE public.oferta_ativa_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OA fila: read all authenticated"
  ON public.oferta_ativa_fila FOR SELECT TO authenticated USING (true);

-- 4) oferta_ativa_ligacoes
CREATE TABLE public.oferta_ativa_ligacoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id         uuid NOT NULL REFERENCES public.oferta_ativa_sessoes(id) ON DELETE CASCADE,
  pipeline_lead_id  uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  corretor_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resultado         text NOT NULL CHECK (resultado IN ('aproveitado','nao_atendeu','sem_interesse','visita_agendada')),
  observacao        text,
  motivo_perda      text,
  prospecto         jsonb,
  pontos            int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oa_lig_sessao ON public.oferta_ativa_ligacoes(sessao_id, created_at DESC);
CREATE INDEX idx_oa_lig_corretor ON public.oferta_ativa_ligacoes(sessao_id, corretor_id);
CREATE INDEX idx_oa_lig_lead_recent ON public.oferta_ativa_ligacoes(pipeline_lead_id, created_at DESC);
CREATE INDEX idx_oa_lig_resultado ON public.oferta_ativa_ligacoes(sessao_id, resultado);

GRANT SELECT ON public.oferta_ativa_ligacoes TO authenticated;
GRANT ALL ON public.oferta_ativa_ligacoes TO service_role;

ALTER TABLE public.oferta_ativa_ligacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OA ligacoes: read scoped"
  ON public.oferta_ativa_ligacoes FOR SELECT TO authenticated
  USING (
    corretor_id = oa_ao_vivo_my_profile_id()
    OR oa_ao_vivo_is_gestor_of(corretor_id)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
  );

-- 5) oferta_ativa_metas
CREATE TABLE public.oferta_ativa_metas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id             uuid NOT NULL REFERENCES public.oferta_ativa_sessoes(id) ON DELETE CASCADE,
  corretor_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meta_ligacoes         int NOT NULL DEFAULT 0,
  meta_aproveitamentos  int NOT NULL DEFAULT 0,
  meta_visitas          int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sessao_id, corretor_id)
);
CREATE INDEX idx_oa_metas_sessao ON public.oferta_ativa_metas(sessao_id);

GRANT SELECT, INSERT, UPDATE ON public.oferta_ativa_metas TO authenticated;
GRANT ALL ON public.oferta_ativa_metas TO service_role;

ALTER TABLE public.oferta_ativa_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OA metas: read scoped"
  ON public.oferta_ativa_metas FOR SELECT TO authenticated
  USING (
    corretor_id = oa_ao_vivo_my_profile_id()
    OR oa_ao_vivo_is_gestor_of(corretor_id)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
  );

CREATE POLICY "OA metas: self insert"
  ON public.oferta_ativa_metas FOR INSERT TO authenticated
  WITH CHECK (corretor_id = oa_ao_vivo_my_profile_id());

CREATE POLICY "OA metas: self update"
  ON public.oferta_ativa_metas FOR UPDATE TO authenticated
  USING (corretor_id = oa_ao_vivo_my_profile_id());

-- Triggers updated_at
CREATE TRIGGER trg_oa_sessoes_updated_at
  BEFORE UPDATE ON public.oferta_ativa_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_oa_participantes_updated_at
  BEFORE UPDATE ON public.oferta_ativa_participantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_oa_fila_updated_at
  BEFORE UPDATE ON public.oferta_ativa_fila
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_oa_metas_updated_at
  BEFORE UPDATE ON public.oferta_ativa_metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.oferta_ativa_participantes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.oferta_ativa_ligacoes;
