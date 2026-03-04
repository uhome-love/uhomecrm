
-- Create PDN entries table
CREATE TABLE public.pdn_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gerente_id UUID NOT NULL,
  mes TEXT NOT NULL, -- format: 'yyyy-MM' e.g. '2026-03'
  nome TEXT NOT NULL,
  und TEXT,
  empreendimento TEXT,
  docs_status TEXT NOT NULL DEFAULT 'sem_docs', -- sem_docs, em_andamento, doc_completa
  temperatura TEXT NOT NULL DEFAULT 'morno', -- frio, morno, quente
  corretor TEXT,
  equipe TEXT,
  ultimo_contato TEXT,
  data_visita DATE DEFAULT CURRENT_DATE,
  tipo_visita TEXT, -- 1a_visita, retorno, visita_tecnica, plantao
  proxima_acao TEXT, -- ligar, whatsapp, enviar_docs, agendar_retorno, proposta
  data_proxima_acao DATE,
  valor_potencial NUMERIC,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pdn_entries ENABLE ROW LEVEL SECURITY;

-- Gerentes can view own PDN
CREATE POLICY "Gerentes can view own pdn"
ON public.pdn_entries FOR SELECT
TO authenticated
USING (auth.uid() = gerente_id OR public.has_role(auth.uid(), 'admin'));

-- Gerentes can insert own PDN
CREATE POLICY "Gerentes can insert own pdn"
ON public.pdn_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = gerente_id);

-- Gerentes can update own PDN
CREATE POLICY "Gerentes can update own pdn"
ON public.pdn_entries FOR UPDATE
TO authenticated
USING (auth.uid() = gerente_id);

-- Gerentes can delete own PDN
CREATE POLICY "Gerentes can delete own pdn"
ON public.pdn_entries FOR DELETE
TO authenticated
USING (auth.uid() = gerente_id);

-- Trigger for updated_at
CREATE TRIGGER update_pdn_entries_updated_at
BEFORE UPDATE ON public.pdn_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast monthly queries
CREATE INDEX idx_pdn_entries_gerente_mes ON public.pdn_entries (gerente_id, mes);
CREATE INDEX idx_pdn_entries_temperatura ON public.pdn_entries (temperatura);
CREATE INDEX idx_pdn_entries_docs ON public.pdn_entries (docs_status);
