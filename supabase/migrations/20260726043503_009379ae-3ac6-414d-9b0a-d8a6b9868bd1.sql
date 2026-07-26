-- Migration A — Fase 1A
-- Adiciona empreendimento_canonico_id em visitas e negocios + trigger auto-resolvedor.
-- Sem backfill, sem CHECK em cancel_reason.

ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS empreendimento_canonico_id UUID REFERENCES public.empreendimentos_canonicos(id);

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS empreendimento_canonico_id UUID REFERENCES public.empreendimentos_canonicos(id);

CREATE INDEX IF NOT EXISTS idx_visitas_empreendimento_canonico_id
  ON public.visitas(empreendimento_canonico_id);

CREATE INDEX IF NOT EXISTS idx_negocios_empreendimento_canonico_id
  ON public.negocios(empreendimento_canonico_id);

-- Trigger function: resolve canônico a partir do texto livre, sem sobrescrever valor manual.
CREATE OR REPLACE FUNCTION public.trg_resolve_empreendimento_canonico_generic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empreendimento_canonico_id IS NULL
     AND NEW.empreendimento IS NOT NULL
     AND btrim(NEW.empreendimento) <> '' THEN
    BEGIN
      NEW.empreendimento_canonico_id := public.resolver_empreendimento_canonico(
        NULL, NULL, NULL, NULL, NEW.empreendimento, NULL
      );
    EXCEPTION WHEN OTHERS THEN
      -- Nunca derruba o INSERT/UPDATE original por falha do resolver.
      NEW.empreendimento_canonico_id := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visitas_empreendimento_canonico ON public.visitas;
CREATE TRIGGER trg_visitas_empreendimento_canonico
BEFORE INSERT OR UPDATE OF empreendimento ON public.visitas
FOR EACH ROW EXECUTE FUNCTION public.trg_resolve_empreendimento_canonico_generic();

DROP TRIGGER IF EXISTS trg_negocios_empreendimento_canonico ON public.negocios;
CREATE TRIGGER trg_negocios_empreendimento_canonico
BEFORE INSERT OR UPDATE OF empreendimento ON public.negocios
FOR EACH ROW EXECUTE FUNCTION public.trg_resolve_empreendimento_canonico_generic();