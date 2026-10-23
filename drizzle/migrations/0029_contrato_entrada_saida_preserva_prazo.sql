CREATE OR REPLACE FUNCTION public.registrar_referencia_contrato_negocio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_etapa uuid;
BEGIN
  IF OLD.fase='ganho' OR NEW.fase='ganho' THEN RETURN NEW; END IF;
  IF NEW.fase='contrato' AND NEW.contrato_situacao IN ('em_confeccao','gerado','em_leitura') THEN
    IF NEW.fase IS DISTINCT FROM OLD.fase OR NEW.contrato_situacao IS DISTINCT FROM OLD.contrato_situacao THEN
      SELECT id INTO v_etapa FROM public.pipeline_stages WHERE ativo AND pipeline_tipo='leads' AND tipo='contrato_gerado' ORDER BY ordem LIMIT 1;
      IF v_etapa IS NOT NULL THEN NEW.jornada:=COALESCE(NEW.jornada,'{}'::jsonb)||jsonb_build_object('contrato',jsonb_build_object('status',NEW.contrato_situacao,'desde',now(),'etapa_id',v_etapa)); END IF;
    ELSIF pg_trigger_depth()<=1 THEN
      NEW.jornada:=COALESCE(NEW.jornada,'{}'::jsonb)-'contrato';
      IF OLD.jornada ? 'contrato' THEN NEW.jornada:=NEW.jornada||jsonb_build_object('contrato',OLD.jornada->'contrato'); END IF;
    END IF;
  ELSE NEW.jornada:=COALESCE(NEW.jornada,'{}'::jsonb)-'contrato';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.registrar_referencia_contrato_negocio() FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.registrar_referencia_contrato_negocio() IS 'Alteração real de fase/situação reinicia o prazo; escrita comum preserva a referência. Sincronização encadeada por mudança de etapa/vínculo pode remover/reiniciar o acompanhamento sem mudar a fase do negócio.';