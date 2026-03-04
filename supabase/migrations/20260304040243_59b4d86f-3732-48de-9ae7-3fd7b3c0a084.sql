
-- ============================================
-- CHECKPOINT DO GERENTE - Database Schema
-- ============================================

-- Team members managed by a gerente
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id UUID NOT NULL,
  nome TEXT NOT NULL,
  equipe TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerentes can view own team" ON public.team_members
  FOR SELECT USING (auth.uid() = gerente_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gerentes can insert own team" ON public.team_members
  FOR INSERT WITH CHECK (auth.uid() = gerente_id);

CREATE POLICY "Gerentes can update own team" ON public.team_members
  FOR UPDATE USING (auth.uid() = gerente_id);

CREATE POLICY "Gerentes can delete own team" ON public.team_members
  FOR DELETE USING (auth.uid() = gerente_id);

-- Daily checkpoints
CREATE TABLE public.checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id UUID NOT NULL,
  data DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gerente_id, data)
);

ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerentes can view own checkpoints" ON public.checkpoints
  FOR SELECT USING (auth.uid() = gerente_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gerentes can insert own checkpoints" ON public.checkpoints
  FOR INSERT WITH CHECK (auth.uid() = gerente_id);

CREATE POLICY "Gerentes can update own checkpoints" ON public.checkpoints
  FOR UPDATE USING (auth.uid() = gerente_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gerentes can delete own checkpoints" ON public.checkpoints
  FOR DELETE USING (auth.uid() = gerente_id);

-- Checkpoint lines (per corretor per day)
CREATE TABLE public.checkpoint_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id UUID NOT NULL REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  corretor_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  -- Metas
  meta_ligacoes INT DEFAULT 0,
  meta_presenca TEXT DEFAULT 'sim',
  meta_visitas_marcadas INT DEFAULT 0,
  meta_visitas_realizadas INT DEFAULT 0,
  meta_propostas INT DEFAULT 0,
  meta_vgv_gerado NUMERIC(15,2) DEFAULT 0,
  meta_vgv_assinado NUMERIC(15,2) DEFAULT 0,
  obs_gerente TEXT,
  -- Resultados
  real_ligacoes INT,
  real_presenca TEXT,
  real_visitas_marcadas INT,
  real_visitas_realizadas INT,
  real_propostas INT,
  real_vgv_gerado NUMERIC(15,2),
  real_vgv_assinado NUMERIC(15,2),
  obs_dia TEXT,
  status_dia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(checkpoint_id, corretor_id)
);

ALTER TABLE public.checkpoint_lines ENABLE ROW LEVEL SECURITY;

-- RLS via checkpoint's gerente_id
CREATE POLICY "Users can view own checkpoint lines" ON public.checkpoint_lines
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.checkpoints c WHERE c.id = checkpoint_id AND (c.gerente_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

CREATE POLICY "Users can insert own checkpoint lines" ON public.checkpoint_lines
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.checkpoints c WHERE c.id = checkpoint_id AND c.gerente_id = auth.uid())
  );

CREATE POLICY "Users can update own checkpoint lines" ON public.checkpoint_lines
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.checkpoints c WHERE c.id = checkpoint_id AND (c.gerente_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

CREATE POLICY "Users can delete own checkpoint lines" ON public.checkpoint_lines
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.checkpoints c WHERE c.id = checkpoint_id AND c.gerente_id = auth.uid())
  );

-- Manager daily checklist
CREATE TABLE public.manager_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id UUID NOT NULL,
  data DATE NOT NULL,
  item TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gerente_id, data, item)
);

ALTER TABLE public.manager_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerentes can view own checklist" ON public.manager_checklist
  FOR SELECT USING (auth.uid() = gerente_id);

CREATE POLICY "Gerentes can insert own checklist" ON public.manager_checklist
  FOR INSERT WITH CHECK (auth.uid() = gerente_id);

CREATE POLICY "Gerentes can update own checklist" ON public.manager_checklist
  FOR UPDATE USING (auth.uid() = gerente_id);

CREATE POLICY "Gerentes can delete own checklist" ON public.manager_checklist
  FOR DELETE USING (auth.uid() = gerente_id);

-- Triggers for updated_at
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checkpoints_updated_at
  BEFORE UPDATE ON public.checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checkpoint_lines_updated_at
  BEFORE UPDATE ON public.checkpoint_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
