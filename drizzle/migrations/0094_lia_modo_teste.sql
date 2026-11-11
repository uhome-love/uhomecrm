ALTER TABLE public.ia_config ADD COLUMN IF NOT EXISTS modo_teste boolean NOT NULL DEFAULT true;
ALTER TABLE public.ia_config ADD COLUMN IF NOT EXISTS numero_teste text;
ALTER TABLE public.ia_config ADD COLUMN IF NOT EXISTS modo_teste_alterado_por uuid;
ALTER TABLE public.ia_config ADD COLUMN IF NOT EXISTS modo_teste_alterado_em timestamptz;
UPDATE public.ia_config SET numero_teste = '5551992597097' WHERE numero_teste IS NULL;

CREATE OR REPLACE FUNCTION public.lia_salvar_modo_teste(p_ligado boolean, p_numero text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_num text := regexp_replace(coalesce(p_numero,''), '\D', '', 'g');
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor')) THEN
    RAISE EXCEPTION 'sem permissao';
  END IF;
  IF p_ligado AND length(v_num) < 10 THEN RAISE EXCEPTION 'numero_invalido'; END IF;
  UPDATE public.ia_config SET modo_teste = p_ligado, numero_teste = nullif(v_num,''),
    modo_teste_alterado_por = auth.uid(), modo_teste_alterado_em = now(), updated_at = now();
  INSERT INTO public.audit_log(user_id, acao, modulo, descricao)
  VALUES (auth.uid(), 'lia_modo_teste', 'lia', format('Modo teste %s · número %s', CASE WHEN p_ligado THEN 'ligado' ELSE 'desligado' END, v_num));
  RETURN jsonb_build_object('modo_teste', p_ligado, 'numero_teste', v_num);
END $$;
REVOKE ALL ON FUNCTION public.lia_salvar_modo_teste(boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lia_salvar_modo_teste(boolean, text) TO authenticated;