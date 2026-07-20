
-- 1) Recriar função de auto-presença (idempotente, mesma lógica; garante estado limpo)
CREATE OR REPLACE FUNCTION public.registrar_presenca_auto_credenciamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_turnos text[];
  v_turno text;
BEGIN
  IF NEW.janela = 'dia_todo' THEN
    v_turnos := ARRAY['manha','tarde'];
  ELSIF NEW.janela IN ('manha','tarde','noturna') THEN
    v_turnos := ARRAY[NEW.janela];
  ELSE
    RETURN NEW;
  END IF;

  FOREACH v_turno IN ARRAY v_turnos LOOP
    INSERT INTO public.roleta_presencas
      (corretor_id, data, turno, status, chegou_em, validado_por, validado_em, origem, observacao)
    VALUES
      (NEW.corretor_id, NEW.data, v_turno, 'na_empresa',
       COALESCE(NEW.created_at, now()), NEW.aprovado_por, now(),
       'auto_credenciamento', 'Presença registrada automaticamente pela aprovação do credenciamento')
    ON CONFLICT (corretor_id, data, turno) DO NOTHING;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- não bloquear o credenciamento se algo falhar
  RAISE WARNING 'registrar_presenca_auto_credenciamento falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 2) Backfill do dia (BRT): para cada credenciamento aprovado hoje que não tem presença, cria linha auto
WITH hoje AS (
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d
),
expandido AS (
  SELECT
    c.corretor_id,
    c.data,
    CASE WHEN c.janela = 'dia_todo' THEN t.turno ELSE c.janela END AS turno,
    COALESCE(c.created_at, now()) AS chegou_em,
    c.aprovado_por
  FROM public.roleta_credenciamentos c
  CROSS JOIN hoje
  LEFT JOIN LATERAL (VALUES ('manha'), ('tarde')) t(turno)
    ON c.janela = 'dia_todo'
  WHERE c.data = hoje.d
    AND c.status = 'aprovado'
    AND (c.janela IN ('manha','tarde','noturna') OR c.janela = 'dia_todo')
)
INSERT INTO public.roleta_presencas
  (corretor_id, data, turno, status, chegou_em, validado_por, validado_em, origem, observacao)
SELECT
  corretor_id, data, turno, 'na_empresa', chegou_em, aprovado_por, now(),
  'auto_credenciamento', 'Backfill: presença via credenciamento aprovado'
FROM expandido
ON CONFLICT (corretor_id, data, turno) DO NOTHING;
