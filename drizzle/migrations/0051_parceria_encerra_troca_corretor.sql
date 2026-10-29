ALTER TABLE public.pipeline_parcerias ADD COLUMN IF NOT EXISTS encerrada_em timestamptz;

CREATE OR REPLACE FUNCTION public.encerrar_parcerias_troca_corretor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NEW.corretor_id IS DISTINCT FROM OLD.corretor_id AND NEW.corretor_id IS NOT NULL THEN
    UPDATE public.pipeline_parcerias
       SET status = 'encerrada', encerrada_em = now(), updated_at = now(),
           motivo = COALESCE(motivo || ' | ', '') || 'Encerrada automaticamente: lead mudou de corretor'
     WHERE pipeline_lead_id = NEW.id AND status = 'ativa'
       AND corretor_principal_id <> NEW.corretor_id AND corretor_parceiro_id <> NEW.corretor_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, observacao)
      VALUES (NEW.id, NEW.stage_id, NEW.stage_id, 'Parceria encerrada: lead mudou de corretor');
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_encerrar_parcerias_troca_corretor ON public.pipeline_leads;
CREATE TRIGGER trg_encerrar_parcerias_troca_corretor AFTER UPDATE OF corretor_id ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.encerrar_parcerias_troca_corretor();

CREATE OR REPLACE FUNCTION public.roleta_visitas_realizadas_periodo(p_auth_user_id uuid, p_inicio date, p_fim date)
 RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH v AS (
    SELECT COALESCE(v.pipeline_lead_id::text, v.id::text) AS cli, v.pipeline_lead_id, v.data_visita,
           COALESCE((SELECT p.user_id FROM public.profiles p WHERE p.id = v.corretor_id), v.corretor_id) AS dono
    FROM public.visitas v
    WHERE v.status = 'realizada' AND v.data_visita::date BETWEEN p_inicio AND p_fim
  ), vp AS (
    SELECT v.cli, v.dono, pp.pri, pp.parc
    FROM v
    LEFT JOIN LATERAL (
      SELECT x.pri, x.parc FROM (
        SELECT COALESCE(a.user_id, z.corretor_principal_id) AS pri,
               COALESCE(b.user_id, z.corretor_parceiro_id) AS parc, z.created_at
        FROM public.pipeline_parcerias z
        LEFT JOIN public.profiles a ON a.id = z.corretor_principal_id
        LEFT JOIN public.profiles b ON b.id = z.corretor_parceiro_id
        WHERE z.pipeline_lead_id = v.pipeline_lead_id
          AND (z.status = 'ativa' OR (z.status = 'encerrada' AND z.encerrada_em IS NOT NULL AND z.encerrada_em::date > v.data_visita::date))
      ) x
      WHERE x.pri <> x.parc AND v.dono IN (x.pri, x.parc)
      ORDER BY abs(extract(epoch FROM (x.created_at - v.data_visita::timestamp))) LIMIT 1
    ) pp ON true
  ), w AS (
    SELECT cli, CASE WHEN pri IS NULL THEN 1.0 ELSE 0.5 END AS peso
    FROM vp
    WHERE (pri IS NULL AND dono = p_auth_user_id) OR (pri IS NOT NULL AND p_auth_user_id IN (pri, parc))
  )
  SELECT COALESCE(sum(peso), 0)::numeric FROM (SELECT cli, max(peso) AS peso FROM w GROUP BY cli) t;
$function$;