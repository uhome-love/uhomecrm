
-- Pulse Events
CREATE TABLE pulse_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'media',
  corretor_id UUID NOT NULL,
  gerente_id UUID,
  titulo TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB DEFAULT '{}',
  desafio_id UUID,
  agrupamento_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pulse Reactions
CREATE TABLE pulse_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES pulse_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Pulse Desafios
CREATE TABLE pulse_desafios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  metrica TEXT NOT NULL,
  meta INT NOT NULL,
  progresso_atual INT DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'time_inteiro',
  criado_por UUID NOT NULL,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  recompensa_badge TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pulse Desafio Contribuicoes
CREATE TABLE pulse_desafio_contribuicoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  desafio_id UUID NOT NULL REFERENCES pulse_desafios(id) ON DELETE CASCADE,
  corretor_id UUID NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  event_id UUID REFERENCES pulse_events(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE pulse_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_desafios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_desafio_contribuicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY pulse_events_select ON pulse_events FOR SELECT TO authenticated USING (true);
CREATE POLICY pulse_events_insert ON pulse_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY pulse_reactions_select ON pulse_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY pulse_reactions_insert ON pulse_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY pulse_reactions_update ON pulse_reactions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY pulse_reactions_delete ON pulse_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY pulse_desafios_select ON pulse_desafios FOR SELECT TO authenticated USING (true);
CREATE POLICY pulse_desafios_insert ON pulse_desafios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY pulse_desafios_update ON pulse_desafios FOR UPDATE TO authenticated USING (true);

CREATE POLICY pulse_contribuicoes_select ON pulse_desafio_contribuicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY pulse_contribuicoes_insert ON pulse_desafio_contribuicoes FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX idx_pulse_events_created ON pulse_events(created_at DESC);
CREATE INDEX idx_pulse_events_tipo ON pulse_events(tipo, created_at DESC);
CREATE INDEX idx_pulse_events_corretor ON pulse_events(corretor_id, created_at DESC);
CREATE INDEX idx_pulse_reactions_event ON pulse_reactions(event_id);
CREATE INDEX idx_pulse_desafios_status ON pulse_desafios(status, data_fim);
CREATE INDEX idx_pulse_contribuicoes_desafio ON pulse_desafio_contribuicoes(desafio_id, corretor_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pulse_events;
ALTER PUBLICATION supabase_realtime ADD TABLE pulse_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE pulse_desafios;

-- Helper function
CREATE OR REPLACE FUNCTION criar_pulse_event(
  p_tipo TEXT,
  p_corretor_id UUID,
  p_titulo TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_prioridade TEXT DEFAULT 'media'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_gerente_id UUID;
BEGIN
  SELECT gerente_id INTO v_gerente_id 
  FROM team_members WHERE user_id = p_corretor_id AND status = 'ativo'
  LIMIT 1;

  INSERT INTO pulse_events (tipo, corretor_id, gerente_id, titulo, descricao, metadata, prioridade)
  VALUES (p_tipo, p_corretor_id, v_gerente_id, p_titulo, p_descricao, p_metadata, p_prioridade)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
