-- Rollback: restore homi_fato from 0075 and remove the homi_lacunas(j) call from homi_dossie_lead. Keep activation false.
CREATE OR REPLACE FUNCTION public.homi_fato(d timestamptz,f text,a uuid,c uuid,r timestamptz) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT jsonb_build_object('data',d,'fonte',f,'ciclo',CASE WHEN d<r THEN 'anterior' ELSE 'atual' END,'autor_id',a,'autor_tipo',CASE WHEN f LIKE 'lia_%' THEN 'Lia' WHEN a IS NULL OR a='00000000-0000-0000-0000-000000000000'::uuid THEN 'sistema' ELSE 'corretor' END,'outro_corretor',a IS NOT NULL AND a<>'00000000-0000-0000-0000-000000000000'::uuid AND a IS DISTINCT FROM c AND f NOT LIKE 'lia_%'); $$;
REVOKE ALL ON FUNCTION public.homi_fato(timestamptz,text,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.homi_lacunas(j jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE gaps jsonb:=coalesce(j->'lacunas','[]'::jsonb); k text; v jsonb; a jsonb; future_task boolean:=false; today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 IF j#>>'{qualificacao,status}'='ok' THEN
 FOREACH k IN ARRAY ARRAY['objetivo_cliente','faixa_valor','prazo_decisao','forma_pagamento'] LOOP
 v:=j#>ARRAY['qualificacao','dados',k];
 IF v IS NULL OR v='null'::jsonb OR v IN ('""'::jsonb,'[]'::jsonb,'{}'::jsonb) OR (jsonb_typeof(v)='string' AND btrim(v#>>'{}')='') THEN gaps:=gaps||jsonb_build_array(k||': não informado'); END IF;
 END LOOP; END IF;
 IF j#>>'{tarefas,status}' IN ('ok','vazio') THEN
 FOR a IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(j#>'{tarefas,dados}')='array' THEN j#>'{tarefas,dados}' ELSE '[]'::jsonb END) LOOP
 IF (a->>'vence_em')::date>today OR ((a->>'vence_em')::date=today AND ((a->>'hora_vencimento') IS NULL OR ((a->>'vence_em')||' '||coalesce(nullif(a->>'hora_vencimento',''),'23:59:59'))::timestamp AT TIME ZONE 'America/Sao_Paulo'>=now())) THEN future_task:=true; END IF;
 END LOOP;
 IF NOT future_task THEN gaps:=gaps||jsonb_build_array('sem tarefa futura'); END IF; END IF;
 IF j#>>'{visitas,status}'='ok' THEN
 FOR a IN SELECT value FROM jsonb_array_elements(j#>'{visitas,dados}') LOOP
 IF a->>'ciclo'='atual' AND coalesce(nullif(btrim(a->>'resultado_visita'),''),'')='' AND a->>'status' IN ('marcada','confirmada','reagendada','realizada') AND ((a->>'data_visita')::date<today OR ((a->>'data_visita')::date=today AND ((a->>'data_visita')||' '||coalesce(nullif(a->>'hora_visita',''),'23:59:59'))::timestamp AT TIME ZONE 'America/Sao_Paulo'<now())) THEN gaps:=gaps||jsonb_build_array('visita sem resultado: '||coalesce(a->>'id',a->>'data_visita')); END IF;
 END LOOP; END IF;
 IF j#>>'{timeline,status}'='ok' THEN
 SELECT value INTO a FROM jsonb_array_elements(j#>'{timeline,dados,fatos}') WHERE value->>'ciclo'='atual' AND (coalesce(value->>'tipo','')||' '||coalesce(value->>'titulo','')) ~* '(contato|liga[cç][aã]o|ligar|whatsapp|telefonema)' AND (coalesce(value->>'tipo','')||' '||coalesce(value->>'titulo','')) !~* '(visita|tarefa|agend)' ORDER BY value->>'data' DESC LIMIT 1;
 IF a IS NOT NULL AND coalesce(nullif(btrim(a->>'resultado'),''),'')='' AND coalesce(a->>'descricao_resumo','') !~* 'resultado\s*:' THEN gaps:=gaps||jsonb_build_array('contato sem resultado registrado'); END IF; END IF;
 RETURN gaps;
END $$;
REVOKE ALL ON FUNCTION public.homi_lacunas(jsonb) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.homi_dossie_lead(uuid)'::regprocedure) INTO def;
 IF position(' RETURN j;' IN def)=0 THEN RAISE EXCEPTION 'Dossier return signature changed'; END IF;
 def:=replace(def,' RETURN j;',' j:=jsonb_set(j,''{lacunas}'',public.homi_lacunas(j)); RETURN j;');
 EXECUTE def;
END $$;