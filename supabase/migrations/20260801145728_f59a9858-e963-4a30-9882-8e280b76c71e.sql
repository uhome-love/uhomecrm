-- ===== colunas de campanha temporária =====
ALTER TABLE public.oferta_ativa_listas
  ADD COLUMN IF NOT EXISTS liberada_em timestamptz,
  ADD COLUMN IF NOT EXISTS expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS filtro jsonb,
  ADD COLUMN IF NOT EXISTS origem_base boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS encerrada_em timestamptz;

ALTER TABLE public.oferta_ativa_leads
  ADD COLUMN IF NOT EXISTS base_lead_id uuid REFERENCES public.base_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_oa_leads_base_lead ON public.oferta_ativa_leads(base_lead_id);
CREATE INDEX IF NOT EXISTS idx_oa_listas_expira ON public.oferta_ativa_listas(expira_em) WHERE status = 'liberada';

-- corretor só vê lista liberada e dentro do prazo
DROP POLICY IF EXISTS "Corretores can view liberadas" ON public.oferta_ativa_listas;
CREATE POLICY "Corretores can view liberadas" ON public.oferta_ativa_listas FOR SELECT TO authenticated
USING (status = 'liberada' AND (expira_em IS NULL OR expira_em > now()));

-- ===== gerar campanha a partir da base =====
CREATE OR REPLACE FUNCTION public.criar_campanha_da_base(
  p_nome text,
  p_filtro jsonb,
  p_expira_em timestamptz,
  p_limite integer DEFAULT 500,
  p_liberar boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lista_id uuid;
  v_uid uuid := auth.uid();
  v_emp uuid := nullif(p_filtro->>'empreendimento_canonico_id','')::uuid;
  v_emp_nome text;
  v_ano_min int := nullif(p_filtro->>'ano_min','')::int;
  v_ano_max int := nullif(p_filtro->>'ano_max','')::int;
  v_situacao text := nullif(p_filtro->>'situacao','');
  v_nunca_trab boolean := coalesce((p_filtro->>'nunca_trabalhado')::boolean, true);
  v_com_tel boolean := coalesce((p_filtro->>'com_telefone')::boolean, true);
  v_qtd int := 0;
BEGIN
  IF NOT (has_role(v_uid,'admin') OR has_role(v_uid,'diretor')) THEN
    RAISE EXCEPTION 'Sem permissão para criar campanha';
  END IF;

  SELECT nome INTO v_emp_nome FROM empreendimentos_canonicos WHERE id = v_emp;

  INSERT INTO oferta_ativa_listas (nome, empreendimento, empreendimento_canonico_id, origem, status,
    criado_por, filtro, origem_base, liberada_em, expira_em, tipo)
  VALUES (p_nome, coalesce(v_emp_nome,'Base Única'), v_emp, 'base_unica',
    CASE WHEN p_liberar THEN 'liberada' ELSE 'pendente' END,
    v_uid, p_filtro, true, CASE WHEN p_liberar THEN now() END, p_expira_em, 'empreendimento')
  RETURNING id INTO v_lista_id;

  WITH sel AS (
    SELECT b.* FROM base_leads b
    WHERE b.opt_out = false
      AND b.produto_extinto = false
      AND (NOT v_com_tel OR b.telefone_key IS NOT NULL)
      AND (v_emp IS NULL OR b.empreendimento_canonico_id = v_emp)
      AND (v_ano_min IS NULL OR extract(year from b.ultima_conversao_em) >= v_ano_min)
      AND (v_ano_max IS NULL OR extract(year from b.ultima_conversao_em) <= v_ano_max)
      AND (v_situacao IS NULL OR b.situacao_crm = v_situacao)
      AND (NOT v_nunca_trab OR b.vezes_trabalhado = 0)
      AND NOT EXISTS (
        SELECT 1 FROM oferta_ativa_leads o
        WHERE o.telefone_normalizado IS NOT NULL
          AND b.telefone_key IS NOT NULL
          AND right(o.telefone_normalizado, 8) = b.telefone_key
          AND o.status IN ('na_fila','em_cooldown','aproveitado')
      )
    ORDER BY b.ultima_conversao_em DESC NULLS LAST
    LIMIT greatest(coalesce(p_limite,500), 1)
  ), ins AS (
    INSERT INTO oferta_ativa_leads (lista_id, base_lead_id, nome, telefone, telefone_normalizado, email,
      empreendimento, campanha, origem, data_lead, status)
    SELECT v_lista_id, s.id, coalesce(nullif(trim(coalesce(s.nome,'') || ' ' || coalesce(s.sobrenome,'')),''),'Sem nome'),
      s.telefone, s.telefone_normalizado, s.email,
      coalesce(v_emp_nome, s.empreendimento_texto), p_nome, 'base_unica',
      s.ultima_conversao_em::date, 'na_fila'
    FROM sel s
    RETURNING base_lead_id
  )
  SELECT count(*) INTO v_qtd FROM ins;

  UPDATE base_leads b SET vezes_trabalhado = b.vezes_trabalhado + 1,
    ultima_campanha_oa_id = v_lista_id, ultima_liberacao_em = now()
  WHERE b.id IN (SELECT base_lead_id FROM oferta_ativa_leads WHERE lista_id = v_lista_id AND base_lead_id IS NOT NULL);

  UPDATE oferta_ativa_listas SET total_leads = v_qtd WHERE id = v_lista_id;

  RETURN jsonb_build_object('ok', true, 'lista_id', v_lista_id, 'total', v_qtd);
END; $$;

GRANT EXECUTE ON FUNCTION public.criar_campanha_da_base(text,jsonb,timestamptz,integer,boolean) TO authenticated;

-- ===== prévia do filtro (contagem) =====
CREATE OR REPLACE FUNCTION public.preview_campanha_da_base(p_filtro jsonb)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM base_leads b
  WHERE b.opt_out = false AND b.produto_extinto = false
    AND (NOT coalesce((p_filtro->>'com_telefone')::boolean, true) OR b.telefone_key IS NOT NULL)
    AND (nullif(p_filtro->>'empreendimento_canonico_id','') IS NULL
         OR b.empreendimento_canonico_id = (p_filtro->>'empreendimento_canonico_id')::uuid)
    AND (nullif(p_filtro->>'ano_min','') IS NULL OR extract(year from b.ultima_conversao_em) >= (p_filtro->>'ano_min')::int)
    AND (nullif(p_filtro->>'ano_max','') IS NULL OR extract(year from b.ultima_conversao_em) <= (p_filtro->>'ano_max')::int)
    AND (nullif(p_filtro->>'situacao','') IS NULL OR b.situacao_crm = p_filtro->>'situacao')
    AND (NOT coalesce((p_filtro->>'nunca_trabalhado')::boolean, true) OR b.vezes_trabalhado = 0);
$$;

GRANT EXECUTE ON FUNCTION public.preview_campanha_da_base(jsonb) TO authenticated;

-- ===== encerrar campanhas vencidas =====
CREATE OR REPLACE FUNCTION public.encerrar_campanhas_expiradas()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_listas int := 0; v_leads int := 0;
BEGIN
  WITH exp AS (
    UPDATE oferta_ativa_listas SET status = 'encerrada', encerrada_em = now()
    WHERE status = 'liberada' AND expira_em IS NOT NULL AND expira_em <= now()
    RETURNING id
  ), l AS (
    UPDATE oferta_ativa_leads o SET status = 'devolvido_base', updated_at = now()
    WHERE o.lista_id IN (SELECT id FROM exp) AND o.status = 'na_fila'
    RETURNING o.id
  )
  SELECT (SELECT count(*) FROM exp), (SELECT count(*) FROM l) INTO v_listas, v_leads;
  RETURN jsonb_build_object('listas_encerradas', v_listas, 'leads_devolvidos', v_leads);
END; $$;

GRANT EXECUTE ON FUNCTION public.encerrar_campanhas_expiradas() TO authenticated, service_role;

-- ===== resultado por campanha =====
CREATE OR REPLACE VIEW public.v_oa_campanha_resultado
WITH (security_invoker = true) AS
SELECT l.id AS lista_id, l.nome, l.empreendimento, l.status, l.liberada_em, l.expira_em, l.encerrada_em,
  l.total_leads AS liberados,
  count(o.id) FILTER (WHERE o.status = 'aproveitado') AS aproveitados,
  count(o.id) FILTER (WHERE o.status = 'na_fila') AS na_fila,
  count(o.id) FILTER (WHERE o.status = 'descartado') AS descartados,
  coalesce(sum(o.tentativas_count), 0) AS tentativas,
  CASE WHEN coalesce(sum(o.tentativas_count),0) > 0
    THEN round(100.0 * count(o.id) FILTER (WHERE o.status='aproveitado') / sum(o.tentativas_count), 1)
    ELSE 0 END AS conversao_pct
FROM oferta_ativa_listas l
LEFT JOIN oferta_ativa_leads o ON o.lista_id = l.id
GROUP BY l.id;

GRANT SELECT ON public.v_oa_campanha_resultado TO authenticated;