
-- Custom lists table (stores filters, not leads)
CREATE TABLE public.custom_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corretor_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT 'Lista personalizada',
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  criada_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ultima_usada_at TIMESTAMP WITH TIME ZONE,
  vezes_usada INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.custom_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom lists" ON public.custom_lists
  FOR SELECT TO authenticated USING (corretor_id = auth.uid());

CREATE POLICY "Users can insert own custom lists" ON public.custom_lists
  FOR INSERT TO authenticated WITH CHECK (corretor_id = auth.uid());

CREATE POLICY "Users can update own custom lists" ON public.custom_lists
  FOR UPDATE TO authenticated USING (corretor_id = auth.uid());

CREATE POLICY "Users can delete own custom lists" ON public.custom_lists
  FOR DELETE TO authenticated USING (corretor_id = auth.uid());

-- Custom list sessions table
CREATE TABLE public.custom_list_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_id UUID NOT NULL REFERENCES public.custom_lists(id) ON DELETE CASCADE,
  corretor_id UUID NOT NULL,
  iniciada_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  encerrada_at TIMESTAMP WITH TIME ZONE,
  ligacoes INTEGER NOT NULL DEFAULT 0,
  aproveitados INTEGER NOT NULL DEFAULT 0,
  pts_ganhos INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.custom_list_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.custom_list_sessions
  FOR SELECT TO authenticated USING (corretor_id = auth.uid());

CREATE POLICY "Users can insert own sessions" ON public.custom_list_sessions
  FOR INSERT TO authenticated WITH CHECK (corretor_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON public.custom_list_sessions
  FOR UPDATE TO authenticated USING (corretor_id = auth.uid());
