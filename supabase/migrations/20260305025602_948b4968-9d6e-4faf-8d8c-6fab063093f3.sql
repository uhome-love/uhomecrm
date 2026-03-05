
CREATE TABLE public.team_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id uuid NOT NULL,
  empreendimento text NOT NULL,
  campanha text,
  titulo text NOT NULL DEFAULT 'Script padrão',
  script_ligacao text,
  script_whatsapp text,
  script_email text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_scripts FORCE ROW LEVEL SECURITY;

CREATE POLICY "Gerentes can manage own team scripts" ON public.team_scripts
  FOR ALL TO authenticated
  USING (auth.uid() = gerente_id)
  WITH CHECK (auth.uid() = gerente_id);

CREATE POLICY "Corretores can view team scripts" ON public.team_scripts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.gerente_id = team_scripts.gerente_id
    AND tm.user_id = auth.uid()
    AND tm.status = 'ativo'
  ));

CREATE POLICY "Admins can view all team scripts" ON public.team_scripts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
