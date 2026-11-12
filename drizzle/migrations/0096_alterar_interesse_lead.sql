CREATE OR REPLACE FUNCTION public.alterar_interesse_lead(p_lead_id uuid, p_nome text, p_canonico_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_antigo text; v_nome text; v_autor text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_lead(p_lead_id) THEN
    RAISE EXCEPTION 'sem_acesso';
  END IF;
  IF p_canonico_id IS NOT NULL THEN
    SELECT nome INTO v_nome FROM empreendimentos_canonicos WHERE id = p_canonico_id;
    IF v_nome IS NULL THEN RAISE EXCEPTION 'produto_invalido'; END IF;
  ELSE
    v_nome := nullif(btrim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g')), '');
  END IF;
  IF v_nome IS NULL OR length(v_nome) > 120 THEN RAISE EXCEPTION 'nome_invalido'; END IF;

  SELECT empreendimento INTO v_antigo FROM pipeline_leads WHERE id = p_lead_id;
  UPDATE pipeline_leads SET empreendimento = v_nome, campanha = v_nome, updated_at = now() WHERE id = p_lead_id;
  IF p_canonico_id IS NOT NULL THEN
    UPDATE pipeline_leads SET empreendimento_canonico_id = p_canonico_id WHERE id = p_lead_id;
  END IF;

  SELECT coalesce(nome, 'Corretor') INTO v_autor FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  INSERT INTO pipeline_anotacoes (pipeline_lead_id, conteudo, autor_id, autor_nome)
  VALUES (p_lead_id, '✎ Interesse alterado de ' || coalesce(nullif(v_antigo,''), 'não informado') || ' para ' || v_nome
          || CASE WHEN p_canonico_id IS NULL THEN ' (digitado)' ELSE '' END, auth.uid(), coalesce(v_autor, 'Corretor'));
  RETURN v_nome;
END $$;
REVOKE ALL ON FUNCTION public.alterar_interesse_lead(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.alterar_interesse_lead(uuid, text, uuid) TO authenticated;