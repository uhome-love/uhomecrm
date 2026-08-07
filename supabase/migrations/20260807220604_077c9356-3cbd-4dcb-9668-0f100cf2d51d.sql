-- 1) Arquivar linhas legadas sem vínculo com lead (março/2026)
CREATE TABLE IF NOT EXISTS public.pdn_entries_legado (LIKE public.pdn_entries);
GRANT ALL ON public.pdn_entries_legado TO service_role;
ALTER TABLE public.pdn_entries_legado ENABLE ROW LEVEL SECURITY;

INSERT INTO public.pdn_entries_legado
SELECT * FROM public.pdn_entries WHERE pipeline_lead_id IS NULL;

DELETE FROM public.pdn_entries WHERE pipeline_lead_id IS NULL;

-- 2) Função legada não usada pela aplicação (depende de colunas mortas)
DROP FUNCTION IF EXISTS public.get_corretor_pdn(text);

-- 3) Índices sobre colunas mortas
DROP INDEX IF EXISTS public.idx_pdn_entries_temperatura;
DROP INDEX IF EXISTS public.idx_pdn_entries_docs;

-- 4) Remover colunas desnormalizadas (dados agora vêm do pipeline/negócio)
ALTER TABLE public.pdn_entries
  DROP COLUMN IF EXISTS nome,
  DROP COLUMN IF EXISTS und,
  DROP COLUMN IF EXISTS empreendimento,
  DROP COLUMN IF EXISTS docs_status,
  DROP COLUMN IF EXISTS temperatura,
  DROP COLUMN IF EXISTS corretor,
  DROP COLUMN IF EXISTS equipe,
  DROP COLUMN IF EXISTS ultimo_contato,
  DROP COLUMN IF EXISTS data_visita,
  DROP COLUMN IF EXISTS tipo_visita,
  DROP COLUMN IF EXISTS data_proxima_acao,
  DROP COLUMN IF EXISTS valor_potencial,
  DROP COLUMN IF EXISTS situacao,
  DROP COLUMN IF EXISTS vgv,
  DROP COLUMN IF EXISTS quando_assina,
  DROP COLUMN IF EXISTS status_pagamento,
  DROP COLUMN IF EXISTS motivo_queda,
  DROP COLUMN IF EXISTS linked_visit_id,
  DROP COLUMN IF EXISTS created_from_visit,
  DROP COLUMN IF EXISTS objecao_cliente,
  DROP COLUMN IF EXISTS construtora,
  DROP COLUMN IF EXISTS caiu,
  DROP COLUMN IF EXISTS oculto,
  DROP COLUMN IF EXISTS grupo_override;