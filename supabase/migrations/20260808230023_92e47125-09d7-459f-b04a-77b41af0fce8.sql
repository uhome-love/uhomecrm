CREATE TABLE public.ia_turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ia_lead_id uuid NOT NULL REFERENCES public.ia_leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'proposto',
  texto_proposto text NOT NULL,
  texto_editado text,
  editado boolean NOT NULL DEFAULT false,
  midias jsonb NOT NULL DEFAULT '[]'::jsonb,
  etapa_proposta text,
  etapa_aplicada boolean NOT NULL DEFAULT false,
  travas jsonb NOT NULL DEFAULT '[]'::jsonb,
  bloqueado_por text,
  modelo text,
  prompt_versao text,
  contexto jsonb,
  horarios_ofertados jsonb NOT NULL DEFAULT '[]'::jsonb,
  enviado_por uuid,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_turnos TO authenticated;
GRANT ALL ON public.ia_turnos TO service_role;

ALTER TABLE public.ia_turnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_turnos admin" ON public.ia_turnos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_ia_turnos_lead ON public.ia_turnos (ia_lead_id, created_at DESC);
CREATE INDEX idx_ia_turnos_status ON public.ia_turnos (status, created_at DESC);

CREATE TRIGGER trg_ia_turnos_updated_at
  BEFORE UPDATE ON public.ia_turnos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "lia midias admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lia-midias' AND public.has_role(auth.uid(), 'admin'::app_role));