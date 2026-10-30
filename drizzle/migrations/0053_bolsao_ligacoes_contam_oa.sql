CREATE OR REPLACE FUNCTION public._trg_bolsao_conta_oa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res text; v_pts int;
BEGIN
  IF NEW.corretor_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.tentativas > COALESCE(OLD.tentativas,0) THEN
    v_res := CASE WHEN NEW.ultimo_resultado = 'sem_interesse' THEN 'sem_interesse' ELSE 'nao_atendeu' END;
    v_pts := 1;
  ELSIF NEW.ultimo_resultado = 'aproveitado' AND OLD.ultimo_resultado IS DISTINCT FROM 'aproveitado' THEN
    v_res := 'com_interesse'; v_pts := 3;
  ELSE
    RETURN NEW;
  END IF;
  BEGIN
    INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, canal, resultado, feedback, pontos, idempotency_key)
    VALUES (NEW.pipeline_lead_id, NEW.corretor_id, 'ligacao', v_res, 'Bolsão (' || COALESCE(NEW.porta,'') || ')', v_pts,
            'bolsao:' || NEW.pipeline_lead_id || ':' || v_res || ':' || NEW.tentativas || ':' || extract(epoch from now())::bigint)
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bolsao->oa tentativa falhou: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bolsao_conta_oa ON public.bolsao_reservas;
CREATE TRIGGER trg_bolsao_conta_oa AFTER UPDATE ON public.bolsao_reservas
FOR EACH ROW EXECUTE FUNCTION public._trg_bolsao_conta_oa();