
-- Table for negocio-specific tasks
CREATE TABLE public.negocios_tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'outro',
  status TEXT NOT NULL DEFAULT 'pendente',
  prioridade TEXT NOT NULL DEFAULT 'media',
  vence_em DATE,
  hora_vencimento TEXT,
  concluida_em TIMESTAMPTZ,
  responsavel_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for negocio activity history
CREATE TABLE public.negocios_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  resultado TEXT,
  descricao TEXT,
  titulo TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.negocios_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocios_atividades ENABLE ROW LEVEL SECURITY;

-- RLS policies for negocios_tarefas
CREATE POLICY "Authenticated users can read negocios_tarefas" ON public.negocios_tarefas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert negocios_tarefas" ON public.negocios_tarefas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update negocios_tarefas" ON public.negocios_tarefas FOR UPDATE TO authenticated USING (true);

-- RLS policies for negocios_atividades
CREATE POLICY "Authenticated users can read negocios_atividades" ON public.negocios_atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert negocios_atividades" ON public.negocios_atividades FOR INSERT TO authenticated WITH CHECK (true);

-- Rename the documentacao phase label in the app (done via code, not DB)
-- But rename the column label: documentacao -> contrato_gerado is UI-only
