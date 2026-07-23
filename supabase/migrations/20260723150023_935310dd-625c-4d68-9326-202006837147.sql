CREATE OR REPLACE FUNCTION public.trg_pdn_mirror_pipeline_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_stage_tipo text;
  motivo_txt text;
  new_situacao text;
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
      IF NEW.negocio_id IS NOT NULL THEN
        UPDATE public.pdn_entries
           SET caiu = true,
               motivo_queda = COALESCE(NULLIF(motivo_queda,''), motivo_txt),
               updated_at = now()
         WHERE negocio_id = NEW.negocio_id
           AND (caiu IS DISTINCT FROM true OR COALESCE(motivo_queda,'') = '');
      END IF;
    ELSE
      -- Etapa ativa: mapear tipo do pipeline → situacao do PDN
      new_situacao := CASE new_stage_tipo
        WHEN 'proposta' THEN 'em_negociacao'
        WHEN 'contrato_gerado' THEN 'contrato'
        WHEN 'venda' THEN 'ganho'
        WHEN 'visita' THEN 'visita_realizada'
        ELSE NULL
      END;
      IF new_situacao IS NOT NULL THEN
        UPDATE public.pdn_entries
           SET situacao = new_situacao,
               grupo_override = NULL,
               caiu = false,
               motivo_queda = NULL,
               updated_at = now()
         WHERE pipeline_lead_id = NEW.id
           AND (situacao IS DISTINCT FROM new_situacao OR caiu = true OR grupo_override IS NOT NULL);
        IF NEW.negocio_id IS NOT NULL THEN
          UPDATE public.pdn_entries
             SET situacao = new_situacao,
                 grupo_override = NULL,
                 caiu = false,
                 motivo_queda = NULL,
                 updated_at = now()
           WHERE negocio_id = NEW.negocio_id
             AND (situacao IS DISTINCT FROM new_situacao OR caiu = true OR grupo_override IS NOT NULL);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;