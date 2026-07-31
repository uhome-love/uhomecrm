DO $$
DECLARE
  v_sessao_id uuid;
  v_rec record;
  v_profile_id uuid;
  v_gerente_auth uuid;
  v_gerente uuid;
  v_equipe text;
BEGIN
  SELECT id INTO v_sessao_id FROM public.oferta_ativa_sessoes
   WHERE status='ao_vivo' ORDER BY inicio_at DESC LIMIT 1;
  IF v_sessao_id IS NULL THEN RETURN; END IF;

  FOR v_rec IN
    SELECT * FROM public.visitas
     WHERE id IN ('32a08272-6013-4a82-a06c-c3c3749a697f',
                  '3aedf255-5b33-49f3-a1c5-ee0a7c5da3f0',
                  'e3f52af5-6814-4c66-a82e-32cfed504c0e')
     ORDER BY created_at
  LOOP
    SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.user_id = v_rec.corretor_id LIMIT 1;
    IF v_profile_id IS NULL THEN
      SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.id = v_rec.corretor_id LIMIT 1;
    END IF;
    IF v_profile_id IS NULL THEN CONTINUE; END IF;

    IF EXISTS (SELECT 1 FROM public.oferta_ativa_ligacoes l
                WHERE l.sessao_id=v_sessao_id AND l.corretor_id=v_profile_id
                  AND l.resultado='visita_agendada'
                  AND l.pipeline_lead_id = v_rec.pipeline_lead_id) THEN
      CONTINUE;
    END IF;

    v_gerente := NULL; v_equipe := NULL; v_gerente_auth := NULL;
    SELECT tm.gerente_id INTO v_gerente_auth FROM public.team_members tm
     WHERE tm.user_id = v_rec.corretor_id AND tm.status='ativo'
     ORDER BY tm.created_at DESC LIMIT 1;
    IF v_gerente_auth IS NOT NULL THEN
      SELECT gp.id, split_part(gp.nome,' ',1) INTO v_gerente, v_equipe
        FROM public.profiles gp WHERE gp.user_id=v_gerente_auth OR gp.id=v_gerente_auth LIMIT 1;
    END IF;

    INSERT INTO public.oferta_ativa_participantes
      (sessao_id, corretor_id, gerente_id, equipe_text, visitas_count, pontos, ultima_acao_at)
    VALUES (v_sessao_id, v_profile_id, v_gerente, v_equipe, 1, 30, now())
    ON CONFLICT (sessao_id, corretor_id) DO UPDATE
      SET visitas_count = public.oferta_ativa_participantes.visitas_count + 1,
          pontos = public.oferta_ativa_participantes.pontos + 30,
          ultima_acao_at = now(),
          updated_at = now();

    INSERT INTO public.oferta_ativa_ligacoes
      (sessao_id, pipeline_lead_id, corretor_id, resultado, pontos, origem, observacao, created_at)
    VALUES (v_sessao_id, v_rec.pipeline_lead_id, v_profile_id, 'visita_agendada', 30, 'pipeline',
            'Visita marcada fora do mutirão (backfill)', v_rec.created_at);
  END LOOP;
END $$;