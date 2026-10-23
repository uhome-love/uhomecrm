CREATE UNIQUE INDEX IF NOT EXISTS negocios_recebimentos_parcela_uniq
  ON public.negocios_recebimentos (negocio_id, intermediacao_id, parcela_num)
  WHERE negocio_id IS NOT NULL AND intermediacao_id IS NOT NULL AND parcela_num IS NOT NULL;

-- Cria no "A receber" as parcelas FUTURAS da intermediação ligada à venda.
-- Nunca presume pagamento; nunca duplica; vencidas ficam para conferência manual.
CREATE OR REPLACE FUNCTION public.financeiro_gerar_parcelas_intermediacao(p_negocio_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n public.negocios; v_i public.intermediacoes; v_qtd integer := 0; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO v_n FROM public.negocios WHERE id = p_negocio_id;
  IF NOT FOUND OR v_n.intermediacao_id IS NULL OR v_n.fase <> 'ganho' OR v_n.status <> 'ativo' THEN RETURN 0; END IF;
  SELECT * INTO v_i FROM public.intermediacoes WHERE id = v_n.intermediacao_id;
  IF NOT FOUND OR v_i.status <> 'ativa' OR jsonb_typeof(v_i.parcelas) IS DISTINCT FROM 'array' THEN RETURN 0; END IF;
  WITH p AS (
    SELECT ord::int AS num, (e->>'vencimento')::date AS venc, (e->>'valor')::numeric AS valor
    FROM jsonb_array_elements(v_i.parcelas) WITH ORDINALITY AS t(e, ord)
    WHERE (e->>'vencimento') ~ '^\d{4}-\d{2}-\d{2}$' AND (e->>'valor') ~ '^[0-9.]+$'
  ), ins AS (
    INSERT INTO public.negocios_recebimentos (negocio_id, intermediacao_id, parcela_num, vencimento, valor, forma, status, observacao)
    SELECT v_n.id, v_i.id, p.num, p.venc, p.valor,
           CASE v_i.forma_pagamento WHEN 'nf' THEN 'nota_fiscal' WHEN 'nota_fiscal' THEN 'nota_fiscal' WHEN 'pix' THEN 'pix' WHEN 'zemo' THEN 'zemo' ELSE NULL END,
           'pendente', 'Gerada da intermediação'
    FROM p
    WHERE p.venc >= v_hoje AND p.valor > 0
      AND NOT EXISTS (SELECT 1 FROM public.negocios_recebimentos r
                      WHERE r.intermediacao_id = v_i.id AND r.parcela_num = p.num)
    ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_qtd FROM ins;
  RETURN v_qtd;
END $$;

REVOKE ALL ON FUNCTION public.financeiro_gerar_parcelas_intermediacao(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_gerar_parcelas_intermediacao(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_negocio_gerar_parcelas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.intermediacao_id IS NOT NULL AND NEW.fase = 'ganho' AND NEW.status = 'ativo'
     AND (TG_OP = 'INSERT' OR OLD.intermediacao_id IS DISTINCT FROM NEW.intermediacao_id
          OR OLD.fase IS DISTINCT FROM NEW.fase OR OLD.status IS DISTINCT FROM NEW.status) THEN
    BEGIN
      PERFORM public.financeiro_gerar_parcelas_intermediacao(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.ops_events(fn, level, category, message, ctx)
      VALUES ('trg_negocio_gerar_parcelas', 'error', 'financeiro', SQLERRM, jsonb_build_object('negocio_id', NEW.id));
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS negocio_gerar_parcelas ON public.negocios;
CREATE TRIGGER negocio_gerar_parcelas AFTER INSERT OR UPDATE OF intermediacao_id, fase, status ON public.negocios
FOR EACH ROW EXECUTE FUNCTION public.trg_negocio_gerar_parcelas();