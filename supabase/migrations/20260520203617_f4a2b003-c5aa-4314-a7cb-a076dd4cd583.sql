ALTER TABLE public.pipeline_atividades
  ADD COLUMN IF NOT EXISTS tipo_contato TEXT NULL,
  ADD COLUMN IF NOT EXISTS resultado    TEXT NULL;

ALTER TABLE public.pipeline_atividades
  ADD CONSTRAINT pipeline_atividades_tipo_contato_chk
    CHECK (
      tipo_contato IS NULL
      OR tipo_contato IN ('ligacao','whatsapp','email','visita')
    );

ALTER TABLE public.pipeline_atividades
  ADD CONSTRAINT pipeline_atividades_resultado_chk
    CHECK (
      resultado IS NULL
      OR resultado IN ('atendeu','nao_atendeu','agendou_proximo','sem_interesse','outro')
    );

CREATE INDEX IF NOT EXISTS idx_pipeline_atividades_tipo_contato_resultado
  ON public.pipeline_atividades (tipo_contato, resultado)
  WHERE tipo_contato IS NOT NULL;

COMMENT ON COLUMN public.pipeline_atividades.tipo_contato IS
  'Sprint 1 R3-V2 (2026-05-20): canal real do contato realizado no Focus Mode. Enum honesto (4 valores). Atividades antigas e fora do Focus Mode V2 permanecem NULL.';

COMMENT ON COLUMN public.pipeline_atividades.resultado IS
  'Sprint 1 R3-V2 (2026-05-20): resultado do contato (5 valores). Base da métrica "Eficácia de contato" = (atendeu + agendou_proximo) / total. NULL = atividade fora do fluxo V2.';