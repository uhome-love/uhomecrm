-- Agenda do gestor/diretora/CEO — "1 tela que se adapta".
-- Libera o lembrete/anotação a existir SEM cliente (anotação pessoal solta),
-- ex.: "reunião de metas terça 15h", "cobrar proposta do negócio X".
-- Mudança aditiva e reversível: nenhum lembrete existente é afetado.
-- As policies de RLS já permitem o dono (created_by/responsavel_id) ver e
-- gerenciar suas próprias tarefas independente do lead, então nada mais muda.
ALTER TABLE public.pipeline_tarefas
  ALTER COLUMN pipeline_lead_id DROP NOT NULL;

COMMENT ON COLUMN public.pipeline_tarefas.pipeline_lead_id IS
  'Lead vinculado. NULL = anotação/lembrete pessoal solto (Agenda do gestor).';
