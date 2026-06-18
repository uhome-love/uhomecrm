ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS equipe_gerente_auth_id uuid;

COMMENT ON COLUMN public.negocios.equipe_gerente_auth_id IS
  'Foto (snapshot) da equipe dona do VGV assinado: auth.users.id do gerente na data da assinatura. NAO altera auth_user_id (corretor). Usado para agregacao de VGV assinado por equipe.';

CREATE INDEX IF NOT EXISTS idx_negocios_equipe_gerente_auth_id
  ON public.negocios (equipe_gerente_auth_id);

CREATE OR REPLACE FUNCTION public.stamp_negocio_equipe_gerente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gerente uuid;
BEGIN
  -- Apenas estampa quando vira venda assinada e ainda nao tem etiqueta de equipe
  IF NEW.equipe_gerente_auth_id IS NULL
     AND (NEW.fase = 'vendido' OR NEW.data_assinatura IS NOT NULL)
     AND NEW.auth_user_id IS NOT NULL
  THEN
    SELECT tm.gerente_id
      INTO v_gerente
      FROM public.team_members tm
     WHERE tm.user_id = NEW.auth_user_id
       AND tm.status = 'ativo'
       AND tm.gerente_id IS NOT NULL
     LIMIT 1;

    NEW.equipe_gerente_auth_id := v_gerente;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_negocio_equipe_gerente ON public.negocios;
CREATE TRIGGER trg_stamp_negocio_equipe_gerente
  BEFORE INSERT OR UPDATE OF fase, data_assinatura ON public.negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_negocio_equipe_gerente();