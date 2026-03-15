CREATE TABLE public.brevo_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brevo_id text,
  nome text,
  sobrenome text,
  nome_completo text,
  telefone text,
  telefone_normalizado text,
  email text,
  conversao_recente text,
  primeira_conversao text,
  data_conversao_recente timestamptz,
  data_criacao timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_brevo_contacts_telefone ON public.brevo_contacts(telefone_normalizado);
CREATE INDEX idx_brevo_contacts_email ON public.brevo_contacts(email);

ALTER TABLE public.brevo_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on brevo_contacts"
  ON public.brevo_contacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read brevo_contacts"
  ON public.brevo_contacts
  FOR SELECT
  TO authenticated
  USING (true);