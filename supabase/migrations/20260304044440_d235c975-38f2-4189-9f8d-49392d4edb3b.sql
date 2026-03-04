
CREATE TABLE public.saved_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'ligacao', -- 'ligacao' ou 'followup'
  empreendimento TEXT NOT NULL,
  tipo_abordagem TEXT,
  situacao_lead TEXT,
  objetivo TEXT,
  conteudo TEXT NOT NULL,
  titulo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scripts" ON public.saved_scripts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scripts" ON public.saved_scripts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own scripts" ON public.saved_scripts FOR DELETE USING (auth.uid() = user_id);
