CREATE TABLE public.alertas_busca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id UUID NOT NULL,
  filtros JSONB NOT NULL DEFAULT '{}',
  query_ia TEXT,
  nome TEXT NOT NULL,
  frequencia TEXT NOT NULL DEFAULT 'imediato' CHECK (frequencia IN ('imediato', 'diario', 'semanal')),
  canais JSONB NOT NULL DEFAULT '{"whatsapp": true, "email": false}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alertas_busca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alerts"
ON public.alertas_busca
FOR ALL
TO authenticated
USING (corretor_id = auth.uid())
WITH CHECK (corretor_id = auth.uid());