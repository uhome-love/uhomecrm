
-- Gatilho para espelhar mudanças do Pipeline no PDN (pdn_entries).
-- Quando o corretor descarta, arquiva ou o negócio é perdido/arquivado, marca
-- as entradas do PDN vinculadas como "caiu" para que o gestor veja no PDN.

CREATE OR REPLACE FUNCTION public.trg_pdn_mirror_pipeline_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stage_tipo text;
  motivo_txt text;
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR NEW.arquivado IS DISTINCT FROM OLD.arquivado THEN
    SELECT tipo INTO new_stage_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;
    IF NEW.arquivado = true OR new_stage_tipo IN ('descarte','caiu') THEN
      motivo_txt := COALESCE(
        NULLIF(NEW.motivo_descarte, ''),
        CASE
          WHEN NEW.arquivado = true THEN 'Lead inativado pelo corretor'
          WHEN new_stage_tipo = 'descarte' THEN 'Descartado no pipeline pelo corretor'
          WHEN new_stage_tipo = 'caiu' THEN 'Caiu no pipeline'
          ELSE 'Encerrado pelo corretor'
        END
      );
      UPDATE public.pdn_entries
         SET caiu = true,
             motivo_queda = COALESCE(NULLIF(motivo_queda,''), motivo_txt),
             updated_at = now()
       WHERE pipeline_lead_id = NEW.id
         AND (caiu IS DISTINCT FROM true OR COALESCE(motivo_queda,'') = '');
      -- também via negocio_id
      IF NEW.negocio_id IS NOT NULL THEN
        UPDATE public.pdn_entries
           SET caiu = true,
               motivo_queda = COALESCE(NULLIF(motivo_queda,''), motivo_txt),
               updated_at = now()
         WHERE negocio_id = NEW.negocio_id
           AND (caiu IS DISTINCT FROM true OR COALESCE(motivo_queda,'') = '');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pdn_mirror_pipeline_lead ON public.pipeline_leads;
CREATE TRIGGER trg_pdn_mirror_pipeline_lead
AFTER UPDATE OF stage_id, arquivado ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_pdn_mirror_pipeline_lead();


CREATE OR REPLACE FUNCTION public.trg_pdn_mirror_negocio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  motivo_txt text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('perdido','arquivado','cancelado') THEN
      motivo_txt := COALESCE(
        NULLIF(NEW.motivo_queda, ''),
        CASE NEW.status
          WHEN 'perdido' THEN 'Negócio perdido no pipeline'
          WHEN 'arquivado' THEN 'Negócio arquivado no pipeline'
          WHEN 'cancelado' THEN 'Negócio cancelado no pipeline'
          ELSE 'Negócio encerrado'
        END
      );
      UPDATE public.pdn_entries
         SET caiu = true,
             motivo_queda = COALESCE(NULLIF(motivo_queda,''), motivo_txt),
             updated_at = now()
       WHERE negocio_id = NEW.id
         AND (caiu IS DISTINCT FROM true OR COALESCE(motivo_queda,'') = '');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pdn_mirror_negocio ON public.negocios;
CREATE TRIGGER trg_pdn_mirror_negocio
AFTER UPDATE OF status ON public.negocios
FOR EACH ROW EXECUTE FUNCTION public.trg_pdn_mirror_negocio();

-- Log
INSERT INTO public.ops_events (fn, level, category, message, ctx)
VALUES (
  'migration:pdn_reverse_sync_v1',
  'info',
  'audit',
  'Espelhamento pipeline → PDN ativado (descarte/arquivamento/perdido → pdn_entries.caiu)',
  '{}'::jsonb
);
