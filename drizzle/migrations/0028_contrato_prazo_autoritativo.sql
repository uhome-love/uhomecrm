CREATE OR REPLACE FUNCTION public.preservar_situacao_contrato_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_situacao text; v_tipo text;
BEGIN
  IF NEW.negocio_id IS NULL THEN RETURN NEW; END IF;
  SELECT tipo INTO v_tipo FROM public.pipeline_stages WHERE id=NEW.stage_id;
  IF v_tipo='contrato_gerado' THEN
    SELECT contrato_situacao INTO v_situacao FROM public.negocios WHERE id=NEW.negocio_id AND pipeline_lead_id=NEW.id AND status='ativo' AND fase='contrato';
    IF v_situacao IN ('em_confeccao','gerado','em_leitura') THEN
      NEW.flag_status:=COALESCE(NEW.flag_status,'{}'::jsonb)||jsonb_build_object('status_contrato',v_situacao);
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preservar_situacao_contrato_lead() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_preservar_situacao_contrato BEFORE UPDATE OF flag_status,stage_id,negocio_id ON public.pipeline_leads FOR EACH ROW EXECUTE FUNCTION public.preservar_situacao_contrato_lead();

CREATE OR REPLACE FUNCTION public.registrar_referencia_contrato_negocio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_etapa uuid;
BEGIN
  IF OLD.fase='ganho' OR NEW.fase='ganho' THEN RETURN NEW; END IF;
  IF NEW.fase='contrato' AND NEW.contrato_situacao IN ('em_confeccao','gerado','em_leitura') THEN
    IF NEW.fase IS DISTINCT FROM OLD.fase OR NEW.contrato_situacao IS DISTINCT FROM OLD.contrato_situacao THEN
      SELECT id INTO v_etapa FROM public.pipeline_stages WHERE ativo AND pipeline_tipo='leads' AND tipo='contrato_gerado' ORDER BY ordem LIMIT 1;
      IF v_etapa IS NOT NULL THEN
        NEW.jornada:=COALESCE(NEW.jornada,'{}'::jsonb)||jsonb_build_object('contrato',jsonb_build_object('status',NEW.contrato_situacao,'desde',now(),'etapa_id',v_etapa));
      END IF;
    ELSE
      NEW.jornada:=COALESCE(NEW.jornada,'{}'::jsonb)-'contrato';
      IF OLD.jornada ? 'contrato' THEN NEW.jornada:=NEW.jornada||jsonb_build_object('contrato',OLD.jornada->'contrato'); END IF;
    END IF;
  ELSE
    NEW.jornada:=COALESCE(NEW.jornada,'{}'::jsonb)-'contrato';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.registrar_referencia_contrato_negocio() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_referencia_contrato_negocio BEFORE UPDATE OF fase,contrato_situacao,jornada ON public.negocios FOR EACH ROW EXECUTE FUNCTION public.registrar_referencia_contrato_negocio();

CREATE OR REPLACE FUNCTION public.sincronizar_referencia_contrato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tipo text; v_situacao text;
BEGIN
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id AND NEW.negocio_id IS NOT DISTINCT FROM OLD.negocio_id THEN RETURN NEW; END IF;
  IF OLD.negocio_id IS NOT NULL AND OLD.negocio_id IS DISTINCT FROM NEW.negocio_id THEN
    UPDATE public.negocios SET jornada=COALESCE(jornada,'{}'::jsonb)-'contrato' WHERE id=OLD.negocio_id AND pipeline_lead_id=NEW.id AND status='ativo' AND fase<>'ganho';
  END IF;
  IF NEW.negocio_id IS NULL THEN RETURN NEW; END IF;
  SELECT tipo INTO v_tipo FROM public.pipeline_stages WHERE id=NEW.stage_id;
  SELECT contrato_situacao INTO v_situacao FROM public.negocios WHERE id=NEW.negocio_id AND pipeline_lead_id=NEW.id AND status='ativo' AND fase='contrato';
  IF v_tipo='contrato_gerado' AND v_situacao IN ('em_confeccao','gerado','em_leitura') THEN
    UPDATE public.negocios SET jornada=COALESCE(jornada,'{}'::jsonb)||jsonb_build_object('contrato',jsonb_build_object('status',v_situacao,'desde',now(),'etapa_id',NEW.stage_id))
      WHERE id=NEW.negocio_id AND pipeline_lead_id=NEW.id AND status='ativo' AND fase<>'ganho';
  ELSE
    UPDATE public.negocios SET jornada=COALESCE(jornada,'{}'::jsonb)-'contrato' WHERE id=NEW.negocio_id AND pipeline_lead_id=NEW.id AND status='ativo' AND fase<>'ganho';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sincronizar_referencia_contrato() FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.sincronizar_referencia_contrato() IS 'Mudança de etapa/vínculo acompanha a situação autoritativa do negócio. Flags antigas de tarefas/atividades nunca alteram o prazo do contrato.';