
CREATE TABLE public.oferta_ativa_reservados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  corretor_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('retorno', 'separado')),
  agendado_para TIMESTAMPTZ NULL,
  observacao TEXT NULL,
  lista_id UUID NULL REFERENCES public.oferta_ativa_listas(id) ON DELETE SET NULL,
  devolvido_at TIMESTAMPTZ NULL,
  devolvido_motivo TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX oa_reservados_ativo_unico
  ON public.oferta_ativa_reservados (pipeline_lead_id, corretor_id)
  WHERE devolvido_at IS NULL;

CREATE INDEX oa_reservados_corretor_ativo
  ON public.oferta_ativa_reservados (corretor_id, tipo)
  WHERE devolvido_at IS NULL;

CREATE INDEX oa_reservados_agendado
  ON public.oferta_ativa_reservados (agendado_para)
  WHERE devolvido_at IS NULL AND tipo = 'retorno';

GRANT SELECT ON public.oferta_ativa_reservados TO authenticated;
GRANT ALL ON public.oferta_ativa_reservados TO service_role;

ALTER TABLE public.oferta_ativa_reservados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corretor le seus reservados"
  ON public.oferta_ativa_reservados FOR SELECT TO authenticated
  USING (
    corretor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Gestao le todos reservados"
  ON public.oferta_ativa_reservados FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
    OR public.has_role(auth.uid(), 'diretor')
  );

CREATE OR REPLACE FUNCTION public.oa_reservados_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_oa_reservados_touch
  BEFORE UPDATE ON public.oferta_ativa_reservados
  FOR EACH ROW EXECUTE FUNCTION public.oa_reservados_touch_updated_at();

COMMENT ON TABLE public.oferta_ativa_reservados IS
  'Onda 3 · Reservados. tipo=retorno (com agendado_para) ou separado. '
  'Limite: 20 separados ativos/corretor (validado na edge fn). '
  'Devolucao automatica apos 30d sem contato (cron). '
  'Base publica ignora leads com reserva ativa.';
