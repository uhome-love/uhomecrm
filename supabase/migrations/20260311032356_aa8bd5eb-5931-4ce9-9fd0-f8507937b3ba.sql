
-- Tabela de solicitações de pagadoria
CREATE TABLE public.pagadoria_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE NOT NULL,
  solicitante_id UUID NOT NULL,
  
  -- Dados do comprador
  nome_cliente TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  email TEXT,
  telefone TEXT,
  
  -- Dados do negócio
  empreendimento TEXT,
  unidade TEXT,
  vgv_contrato NUMERIC,
  percentual_comissao NUMERIC,
  
  -- Documentos (Storage URLs)
  rg_url TEXT,
  cpf_url TEXT,
  comprovante_residencia_url TEXT,
  ficha_construtora_url TEXT,
  
  -- Status flow: enviado → producao → pronto
  status TEXT NOT NULL DEFAULT 'enviado',
  
  -- Anexo final (Ana)
  contrato_pdf_url TEXT,
  
  -- Observações
  observacoes TEXT,
  obs_backoffice TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pagadoria_solicitacoes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view their own solicitações or all if admin/backoffice
CREATE POLICY "Users can view own solicitacoes"
  ON public.pagadoria_solicitacoes FOR SELECT TO authenticated
  USING (
    solicitante_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'backoffice')
    OR public.has_role(auth.uid(), 'gestor')
  );

-- Authenticated users can create solicitações
CREATE POLICY "Users can create solicitacoes"
  ON public.pagadoria_solicitacoes FOR INSERT TO authenticated
  WITH CHECK (solicitante_id = auth.uid());

-- Admin/backoffice can update (change status, attach PDF)
CREATE POLICY "Admin/backoffice can update solicitacoes"
  ON public.pagadoria_solicitacoes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'backoffice')
    OR solicitante_id = auth.uid()
  );

-- Storage bucket for pagadoria documents
INSERT INTO storage.buckets (id, name, public) VALUES ('pagadoria-docs', 'pagadoria-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Auth users can upload pagadoria docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pagadoria-docs');

CREATE POLICY "Auth users can view pagadoria docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pagadoria-docs');
