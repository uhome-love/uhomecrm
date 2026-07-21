
-- ============================================================
-- FASE 1 — Correções críticas backend do pipeline
-- ============================================================

-- 1) DROP trigger fantasma + função (procurava tipos que não existem)
DROP TRIGGER IF EXISTS trg_visita_status_pipeline ON public.visitas;
DROP FUNCTION IF EXISTS public.visita_status_to_pipeline();

-- 2) DROP funções órfãs
DROP FUNCTION IF EXISTS public.trg_lead_to_negocio_on_visita_realizada();
DROP FUNCTION IF EXISTS public.auto_criar_negocio_visita_realizada();
DROP FUNCTION IF EXISTS public.auto_criar_negocio_visita_agenda();

-- 3) Trigger para manter stage_changed_at atualizado
CREATE OR REPLACE FUNCTION public.trg_touch_stage_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_leads_stage_changed_at ON public.pipeline_leads;
CREATE TRIGGER trg_pipeline_leads_stage_changed_at
BEFORE UPDATE OF stage_id ON public.pipeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_touch_stage_changed_at();

-- 4) Limpa ref morta 'ganho' -> 'venda'
CREATE OR REPLACE FUNCTION public.trg_clear_negocio_on_stage_regress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ordem INT;
  new_tipo TEXT;
  old_ordem INT;
BEGIN
  SELECT ordem, tipo INTO new_ordem, new_tipo
  FROM public.pipeline_stages WHERE id = NEW.stage_id;

  SELECT ordem INTO old_ordem
  FROM public.pipeline_stages WHERE id = OLD.stage_id;

  IF new_ordem IS NULL OR new_ordem >= 5 THEN RETURN NEW; END IF;
  IF new_tipo IN ('descarte','venda','caiu') THEN RETURN NEW; END IF;
  IF old_ordem IS NULL OR old_ordem < 5 THEN RETURN NEW; END IF;

  NEW.flag_status := COALESCE(NEW.flag_status,'{}'::jsonb) - 'status_negociacao' - 'status_contrato';

  IF NEW.negocio_id IS NOT NULL THEN
    UPDATE public.negocios
       SET status='arquivado', updated_at=now()
     WHERE id = NEW.negocio_id AND status='ativo';
    NEW.negocio_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Função para reconciliar visitas vencidas
CREATE OR REPLACE FUNCTION public.reconciliar_visitas_vencidas()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH atualizadas AS (
    UPDATE public.visitas
       SET status = 'no_show',
           updated_at = now()
     WHERE status = 'marcada'
       AND data_visita IS NOT NULL
       AND (data_visita + COALESCE(hora_visita, '23:59'::time)) < (now() - interval '24 hours')
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM atualizadas;

  RETURN v_count;
END;
$$;

-- 6) Backfill origem_ref (cast correto para uuid)
UPDATE public.pipeline_tarefas t
   SET origem_ref = v.id
  FROM public.visitas v
 WHERE t.origem = 'visita_auto'
   AND t.origem_ref IS NULL
   AND t.pipeline_lead_id = v.pipeline_lead_id
   AND v.id = (
     SELECT id FROM public.visitas v2
      WHERE v2.pipeline_lead_id = t.pipeline_lead_id
      ORDER BY v2.created_at DESC
      LIMIT 1
   );

-- 7) Executa reconciliação inicial
SELECT public.reconciliar_visitas_vencidas();

-- 8) Log de auditoria (schema correto de ops_events)
INSERT INTO public.ops_events (fn, level, category, message, ctx)
VALUES (
  'migration:pipeline_audit_fase1',
  'info',
  'audit',
  'Fase 1 aplicada: correcoes criticas do pipeline',
  jsonb_build_object(
    'actions', jsonb_build_array(
      'drop trg_visita_status_pipeline no-op',
      'drop 3 funcoes orfas de auto_negocio',
      'create trg_pipeline_leads_stage_changed_at',
      'fix ganho->venda em trg_clear_negocio_on_stage_regress',
      'add reconciliar_visitas_vencidas',
      'backfill origem_ref em visita_auto'
    )
  )
);
