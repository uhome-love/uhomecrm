-- ============================================================
-- PASSO 1b — segurança das views homi_* e da homi_consulta
-- Troca de dono para homi_ro NÃO aplicada: o executor de migrations não pode assumir o papel homi_ro
-- (erro 42501 "must be able to SET ROLE homi_ro"). Compensação: somente leitura + cada tabela/view citada
-- precisa ser legível por homi_ro (has_table_privilege), conferido antes de executar.
-- COMO DESFAZER (estado anterior):
--   6 views (homi_corretores, homi_equipe, homi_leads_etapa, homi_negocios, homi_vendas, homi_visitas):
--     antes: postgres/anon/authenticated/service_role = ALL; sandbox_exec* = SELECT,INSERT; homi_ro = SELECT.
--     desfazer: GRANT ALL ON public.<view> TO anon, authenticated;
--   homi_consulta antes: dono postgres, SECURITY DEFINER, search_path public,
--     EXECUTE para postgres, anon, authenticated, service_role, sandbox_exec_hunbxqzhvuemgntklyzb.
--   Corpo anterior:
--   CREATE OR REPLACE FUNCTION public.homi_consulta(p_chave text, p_sql text) RETURNS json
--   LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
--   DECLARE v_resultado json; v_sql text := btrim(p_sql);
--     v_permitidas text[] := ARRAY['homi_visitas','homi_negocios','homi_vendas','homi_equipe','homi_leads_etapa','homi_saude_leads','homi_corretores'];
--     v_alvo text;
--   BEGIN
--     IF p_chave IS DISTINCT FROM '<chave antiga>' THEN RAISE EXCEPTION 'acesso negado'; END IF;
--     IF v_sql !~* '^(select|with)\s' THEN RAISE EXCEPTION 'somente SELECT'; END IF;
--     IF v_sql ~* '\y(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|set\s+role|pg_|information_schema|auth\.|storage\.)\y' THEN RAISE EXCEPTION 'comando ou objeto bloqueado'; END IF;
--     FOR v_alvo IN SELECT lower(m[1]) FROM regexp_matches(v_sql, '(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_\.]*)', 'gi') AS m LOOP
--       v_alvo := regexp_replace(v_alvo, '^public\.', '');
--       IF NOT (v_alvo = ANY(v_permitidas)) THEN RAISE EXCEPTION 'view nao permitida: %', v_alvo; END IF;
--     END LOOP;
--     EXECUTE 'select coalesce(json_agg(t), ''[]''::json) from (' || rtrim(v_sql,';') || ' limit 200) t' INTO v_resultado;
--     RETURN v_resultado;
--   END; $f$;
--   Para voltar: recriar o corpo acima; DROP FUNCTION public.homi_consulta_chave_ok(text);
--     DROP FUNCTION public.homi_consulta_registrar(text); DROP TABLE public.homi_consulta_log; DROP TABLE public.homi_consulta_segredo;
-- ============================================================

REVOKE ALL ON public.homi_corretores, public.homi_equipe, public.homi_leads_etapa,
  public.homi_negocios, public.homi_vendas, public.homi_visitas FROM anon, authenticated;

CREATE TABLE public.homi_consulta_segredo (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  chave_sha256 text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.homi_consulta_segredo FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.homi_consulta_segredo TO service_role;
ALTER TABLE public.homi_consulta_segredo ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.homi_consulta_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  papel text,
  ip text,
  user_agent text,
  consulta text
);
CREATE INDEX homi_consulta_log_created_idx ON public.homi_consulta_log (created_at DESC);
GRANT SELECT ON public.homi_consulta_log TO authenticated;
GRANT ALL ON public.homi_consulta_log TO service_role;
ALTER TABLE public.homi_consulta_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consulta_log: admin/diretor leem" ON public.homi_consulta_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
COMMENT ON TABLE public.homi_consulta_log IS 'Somente acréscimo. Uma linha por chamada de homi_consulta com chave válida.';

CREATE OR REPLACE FUNCTION public.homi_consulta_chave_ok(p_chave text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_chave IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.homi_consulta_segredo
    WHERE chave_sha256 = encode(sha256(convert_to(p_chave,'UTF8')),'hex'))
$$;
REVOKE ALL ON FUNCTION public.homi_consulta_chave_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.homi_consulta_chave_ok(text) TO homi_ro;

CREATE OR REPLACE FUNCTION public.homi_consulta_registrar(p_consulta text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h json;
BEGIN
  BEGIN h := nullif(current_setting('request.headers', true),'')::json; EXCEPTION WHEN others THEN h := NULL; END;
  INSERT INTO public.homi_consulta_log(papel, ip, user_agent, consulta)
  VALUES (nullif(current_setting('request.jwt.claim.role', true),''),
          coalesce(h->>'x-forwarded-for', h->>'x-real-ip', h->>'cf-connecting-ip'),
          left(h->>'user-agent', 300), left(p_consulta, 500));
END $$;
REVOKE ALL ON FUNCTION public.homi_consulta_registrar(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.homi_consulta_registrar(text) TO homi_ro;

CREATE OR REPLACE FUNCTION public.homi_consulta(p_chave text, p_sql text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '5s'
AS $function$
DECLARE
  v_resultado json;
  v_sql text := btrim(coalesce(p_sql,''));
  v_alvo text;
  v_oid oid;
BEGIN
  IF NOT public.homi_consulta_chave_ok(p_chave) THEN
    RAISE EXCEPTION 'acesso negado';
  END IF;
  PERFORM public.homi_consulta_registrar(v_sql);
  IF v_sql !~* '^(select|with)\s' THEN
    RAISE EXCEPTION 'somente SELECT';
  END IF;
  IF v_sql ~* '\y(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|copy|lock|vacuum|call|pg_|information_schema|auth\.|storage\.)\y' THEN
    RAISE EXCEPTION 'comando ou objeto bloqueado';
  END IF;
  -- cada tabela/view citada precisa ser legível por homi_ro (as 21 views de relatório)
  FOR v_alvo IN SELECT m[1] FROM regexp_matches(v_sql, '(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_\.]*)', 'gi') AS m LOOP
    v_oid := to_regclass(v_alvo);
    IF v_oid IS NOT NULL AND NOT has_table_privilege('homi_ro', v_oid, 'SELECT') THEN
      RAISE EXCEPTION 'sem permissão: %', v_alvo;
    END IF;
  END LOOP;
  PERFORM set_config('transaction_read_only', 'on', true);
  EXECUTE 'select coalesce(json_agg(t), ''[]''::json) from (' || rtrim(v_sql,'; ') || ' limit 5000) t'
    INTO v_resultado;
  RETURN v_resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.homi_consulta(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.homi_consulta(text, text) TO anon, authenticated, service_role;