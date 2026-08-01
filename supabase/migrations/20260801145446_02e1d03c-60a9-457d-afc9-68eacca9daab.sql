-- ============ BASE ÚNICA DE LEADS ============

CREATE TABLE public.base_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  sobrenome text,
  telefone text,
  telefone_normalizado text,
  telefone_key text,
  email text,
  email_key text,
  primeira_conversao_em timestamptz,
  ultima_conversao_em timestamptz,
  primeiro_formulario text,
  ultimo_formulario text,
  campanha text,
  empreendimento_canonico_id uuid REFERENCES public.empreendimentos_canonicos(id) ON DELETE SET NULL,
  empreendimento_texto text,
  produto_extinto boolean NOT NULL DEFAULT false,
  fonte_dado text NOT NULL DEFAULT 'hubspot',
  external_id text,
  situacao_crm text NOT NULL DEFAULT 'inedito',
  pipeline_lead_id uuid,
  oferta_ativa_lead_id uuid,
  total_conversoes integer NOT NULL DEFAULT 1,
  ultima_campanha_oa_id uuid,
  ultima_liberacao_em timestamptz,
  vezes_trabalhado integer NOT NULL DEFAULT 0,
  opt_out boolean NOT NULL DEFAULT false,
  opt_out_motivo text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT base_leads_situacao_chk CHECK (situacao_crm IN ('inedito','no_pipeline','na_oferta_ativa','ambos'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_leads TO authenticated;
GRANT ALL ON public.base_leads TO service_role;
ALTER TABLE public.base_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao pode ver base_leads" ON public.base_leads FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Admin/diretor gerencia base_leads" ON public.base_leads FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor'));

CREATE UNIQUE INDEX base_leads_telefone_key_uniq ON public.base_leads(telefone_key) WHERE telefone_key IS NOT NULL;
CREATE UNIQUE INDEX base_leads_email_key_uniq ON public.base_leads(email_key) WHERE email_key IS NOT NULL AND telefone_key IS NULL;
CREATE INDEX base_leads_email_idx ON public.base_leads(email_key);
CREATE INDEX base_leads_emp_idx ON public.base_leads(empreendimento_canonico_id);
CREATE INDEX base_leads_situacao_idx ON public.base_leads(situacao_crm);
CREATE INDEX base_leads_ultima_conv_idx ON public.base_leads(ultima_conversao_em DESC);
CREATE INDEX base_leads_form_idx ON public.base_leads(ultimo_formulario);

-- ============ HISTÓRICO DE CONVERSÕES ============

CREATE TABLE public.base_leads_conversoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_lead_id uuid NOT NULL REFERENCES public.base_leads(id) ON DELETE CASCADE,
  formulario text,
  campanha text,
  empreendimento_canonico_id uuid REFERENCES public.empreendimentos_canonicos(id) ON DELETE SET NULL,
  convertido_em timestamptz,
  fonte_dado text NOT NULL DEFAULT 'hubspot',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_leads_conversoes TO authenticated;
GRANT ALL ON public.base_leads_conversoes TO service_role;
ALTER TABLE public.base_leads_conversoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao pode ver conversoes" ON public.base_leads_conversoes FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Admin/diretor gerencia conversoes" ON public.base_leads_conversoes FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor'));

CREATE INDEX base_leads_conv_lead_idx ON public.base_leads_conversoes(base_lead_id);
CREATE UNIQUE INDEX base_leads_conv_uniq ON public.base_leads_conversoes(base_lead_id, coalesce(formulario,''), coalesce(convertido_em, '1970-01-01'::timestamptz));

-- ============ AUDITORIA DE IMPORTAÇÕES ============

CREATE TABLE public.base_leads_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo text,
  fonte_dado text NOT NULL DEFAULT 'hubspot',
  total_linhas integer NOT NULL DEFAULT 0,
  novos integer NOT NULL DEFAULT 0,
  atualizados integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0,
  duplicados_arquivo integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento',
  erro text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.base_leads_import_runs TO authenticated;
GRANT ALL ON public.base_leads_import_runs TO service_role;
ALTER TABLE public.base_leads_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao ve imports" ON public.base_leads_import_runs FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Admin/diretor gerencia imports" ON public.base_leads_import_runs FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor'));

-- ============ MAPA FORMULÁRIO -> EMPREENDIMENTO ============

CREATE TABLE public.base_leads_form_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario text NOT NULL UNIQUE,
  empreendimento_canonico_id uuid REFERENCES public.empreendimentos_canonicos(id) ON DELETE SET NULL,
  empreendimento_texto text,
  extinto boolean NOT NULL DEFAULT false,
  revisado boolean NOT NULL DEFAULT false,
  total_leads integer NOT NULL DEFAULT 0,
  revisado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_leads_form_map TO authenticated;
GRANT ALL ON public.base_leads_form_map TO service_role;
ALTER TABLE public.base_leads_form_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao ve form_map" ON public.base_leads_form_map FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Admin/diretor gerencia form_map" ON public.base_leads_form_map FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor'));

CREATE INDEX base_leads_form_map_rev_idx ON public.base_leads_form_map(revisado) WHERE revisado = false;

-- ============ TRIGGERS updated_at ============

CREATE OR REPLACE FUNCTION public.base_leads_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_base_leads_touch BEFORE UPDATE ON public.base_leads
FOR EACH ROW EXECUTE FUNCTION public.base_leads_touch();
CREATE TRIGGER trg_base_leads_import_touch BEFORE UPDATE ON public.base_leads_import_runs
FOR EACH ROW EXECUTE FUNCTION public.base_leads_touch();
CREATE TRIGGER trg_base_leads_form_map_touch BEFORE UPDATE ON public.base_leads_form_map
FOR EACH ROW EXECUTE FUNCTION public.base_leads_touch();