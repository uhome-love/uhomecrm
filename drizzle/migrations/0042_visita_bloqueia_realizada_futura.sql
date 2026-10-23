CREATE OR REPLACE FUNCTION public.trg_visita_bloqueia_resultado_futuro()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('realizada','no_show')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status
          OR OLD.data_visita IS DISTINCT FROM NEW.data_visita OR OLD.hora_visita IS DISTINCT FROM NEW.hora_visita)
     AND NEW.data_visita IS NOT NULL
     AND (NEW.data_visita + COALESCE(NEW.hora_visita, time '00:00')) > (now() AT TIME ZONE 'America/Sao_Paulo') THEN
    RAISE EXCEPTION 'A visita ainda não aconteceu (% às %). Só é possível registrar resultado depois do horário marcado.',
      to_char(NEW.data_visita,'DD/MM'), COALESCE(to_char(NEW.hora_visita,'HH24:MI'),'--:--')
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_visita_bloqueia_resultado_futuro ON public.visitas;
CREATE TRIGGER trg_visita_bloqueia_resultado_futuro BEFORE INSERT OR UPDATE ON public.visitas
FOR EACH ROW EXECUTE FUNCTION public.trg_visita_bloqueia_resultado_futuro();