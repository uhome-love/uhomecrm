ALTER TABLE public.oferta_ativa_ligacoes ALTER COLUMN pipeline_lead_id DROP NOT NULL;
ALTER TABLE public.oferta_ativa_ligacoes ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'mutirao';

CREATE OR REPLACE FUNCTION public.trg_visita_conta_mutirao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessao_id uuid;
  v_profile_id uuid;
  v_nome text;
  v_gerente uuid;
  v_equipe text;
BEGIN
  SELECT id INTO v_sessao_id
    FROM public.oferta_ativa_sessoes
   WHERE status = 'ao_vivo' AND inicio_at <= now() AND fim_at >= now()
   ORDER BY inicio_at DESC LIMIT 1;
  IF v_sessao_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.corretor_id IS NULL THEN RETURN NEW; END IF;

  SELECT p.id, p.nome INTO v_profile_id, v_nome
    FROM public.profiles p
   WHERE p.user_id = NEW.corretor_id
   LIMIT 1;

  IF v_profile_id IS NULL THEN
    SELECT p.id, p.nome INTO v_profile_id, v_nome
      FROM public.profiles p WHERE p.id = NEW.corretor_id LIMIT 1;
  END IF;
  IF v_profile_id IS NULL THEN RETURN NEW; END IF;

  -- Dedup: visita criada pelo próprio fluxo do mutirão já registrou a ligação
  IF EXISTS (
    SELECT 1 FROM public.oferta_ativa_ligacoes l
     WHERE l.sessao_id = v_sessao_id
       AND l.corretor_id = v_profile_id
       AND l.resultado = 'visita_agendada'
       AND l.created_at > now() - interval '5 minutes'
       AND (NEW.pipeline_lead_id IS NULL OR l.pipeline_lead_id = NEW.pipeline_lead_id)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT tm.gerente_id, gp.nome INTO v_gerente, v_equipe
    FROM public.team_members tm
    LEFT JOIN public.profiles gp ON gp.id = tm.gerente_id OR gp.user_id = tm.gerente_id
   WHERE tm.corretor_id = v_profile_id OR tm.corretor_id = NEW.corretor_id
   LIMIT 1;

  INSERT INTO public.oferta_ativa_participantes
    (sessao_id, corretor_id, gerente_id, equipe_text, visitas_count, pontos, ultima_acao_at)
  VALUES (v_sessao_id, v_profile_id, v_gerente, v_equipe, 1, 30, now())
  ON CONFLICT (sessao_id, corretor_id) DO UPDATE
    SET visitas_count = public.oferta_ativa_participantes.visitas_count + 1,
        pontos = public.oferta_ativa_participantes.pontos + 30,
        ultima_acao_at = now(),
        updated_at = now();

  INSERT INTO public.oferta_ativa_ligacoes
    (sessao_id, pipeline_lead_id, corretor_id, resultado, pontos, origem, observacao)
  VALUES (v_sessao_id, NEW.pipeline_lead_id, v_profile_id, 'visita_agendada', 30, 'pipeline',
          'Visita marcada fora do mutirão');

  INSERT INTO public.pulse_events (tipo, titulo, descricao, corretor_id, metadata)
  VALUES ('oa_visita',
          COALESCE(v_nome, 'Corretor') || ' agendou uma visita',
          COALESCE(NEW.nome_cliente, 'Cliente') || COALESCE(' · ' || NEW.empreendimento, ''),
          v_profile_id,
          jsonb_build_object('sessao_id', v_sessao_id, 'visita_id', NEW.id, 'origem', 'pipeline'));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_visita_conta_mutirao falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visita_conta_mutirao ON public.visitas;
CREATE TRIGGER trg_visita_conta_mutirao
AFTER INSERT ON public.visitas
FOR EACH ROW EXECUTE FUNCTION public.trg_visita_conta_mutirao();