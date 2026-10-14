-- Regra da direção (14/10): quem já está credenciado no turno não perde o turno por cair abaixo de 80%;
-- a checagem de CRM/visitas vale só no próximo credenciamento.
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.distribuir_lead_atomico(uuid,text,uuid,boolean)'::regprocedure);
  d := replace(d, E'        AND public.roleta_apto_janela(p.user_id, v_target_janela)\n', '');
  IF position('roleta_apto_janela' in d) > 0 THEN
    RAISE EXCEPTION 'filtro roleta_apto_janela não removido';
  END IF;
  EXECUTE d;
END
$do$;