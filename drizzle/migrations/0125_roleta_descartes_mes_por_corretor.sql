CREATE TABLE IF NOT EXISTS public.lead_descarte_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid NOT NULL,
  corretor_id uuid,
  movido_por uuid,
  origem text NOT NULL DEFAULT 'corretor',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_descarte_eventos TO authenticated;
GRANT ALL ON public.lead_descarte_eventos TO service_role;
ALTER TABLE public.lead_descarte_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestão lê descartes" ON public.lead_descarte_eventos FOR SELECT TO authenticated
  USING (movido_por = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'diretor'));
CREATE INDEX IF NOT EXISTS idx_lead_descarte_eventos_mov ON public.lead_descarte_eventos (movido_por, created_at);

CREATE OR REPLACE FUNCTION public.trg_log_descarte()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  BEGIN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id
       AND EXISTS (SELECT 1 FROM public.pipeline_stages s WHERE s.id = NEW.stage_id AND s.tipo::text = 'descarte') THEN
      INSERT INTO public.lead_descarte_eventos(pipeline_lead_id, corretor_id, movido_por, origem)
      VALUES (NEW.id, NEW.corretor_id, auth.uid(),
        CASE WHEN auth.uid() IS NULL THEN 'sistema'
             WHEN COALESCE(NEW.motivo_descarte,'') ILIKE '%(Bolsão)%' THEN 'bolsao'
             ELSE 'corretor' END);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_descarte ON public.pipeline_leads;
CREATE TRIGGER trg_log_descarte AFTER UPDATE OF stage_id ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_descarte();

INSERT INTO public.lead_descarte_eventos(pipeline_lead_id, corretor_id, movido_por, origem, created_at)
SELECT h.pipeline_lead_id, NULL, h.movido_por, 'corretor', h.created_at
FROM public.pipeline_historico h JOIN public.pipeline_stages s ON s.id = h.stage_novo_id
WHERE s.tipo::text = 'descarte' AND h.movido_por IS NOT NULL
  AND h.created_at >= '2026-11-01 03:00+00';

INSERT INTO public.lead_descarte_eventos(pipeline_lead_id, corretor_id, movido_por, origem, created_at)
SELECT pl.id, pl.corretor_id, pl.corretor_id, 'corretor', pl.stage_changed_at
FROM public.pipeline_leads pl JOIN public.pipeline_stages s ON s.id = pl.stage_id
WHERE s.tipo::text = 'descarte' AND pl.corretor_id IS NOT NULL
  AND pl.stage_changed_at >= '2026-11-01 03:00+00'
  AND COALESCE(pl.motivo_descarte,'') NOT ILIKE '%(Bolsão)%'
  AND NOT EXISTS (SELECT 1 FROM public.lead_descarte_eventos e WHERE e.pipeline_lead_id = pl.id AND e.created_at >= '2026-11-01 03:00+00');

CREATE OR REPLACE FUNCTION public.roleta_descartes_mes(p_corretor_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COUNT(DISTINCT e.pipeline_lead_id)::integer
  FROM public.lead_descarte_eventos e
  JOIN public.pipeline_leads pl ON pl.id = e.pipeline_lead_id
  WHERE e.origem = 'corretor'
    AND e.movido_por = ANY(public.resolve_corretor_scope_ids(p_corretor_id))
    AND COALESCE(pl.is_teste,false) = false
    AND e.created_at >= (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
    AND e.created_at <  ((date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month') AT TIME ZONE 'America/Sao_Paulo');
$$;
REVOKE ALL ON FUNCTION public.roleta_descartes_mes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roleta_descartes_mes(uuid) TO authenticated, service_role;

DO $do$
DECLARE f text; d text; n text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.corretor_pode_entrar_roleta(uuid,text)','public.get_elegibilidade_roleta(uuid)'] LOOP
    d := pg_get_functiondef(f::regprocedure);
    n := regexp_replace(d, 'SELECT COUNT\(\*\)::INTEGER INTO v_descartes_mes.*?INTERVAL ''1 month'';', 'v_descartes_mes := public.roleta_descartes_mes(p_corretor_id);', 's');
    IF n = d THEN RAISE EXCEPTION 'contagem de descartes não encontrada em %', f; END IF;
    EXECUTE n;
  END LOOP;
END $do$;