ALTER TABLE public.midia_lead_jornada
  ADD COLUMN IF NOT EXISTS visitas_site integer,
  ADD COLUMN IF NOT EXISTS primeira_origem jsonb,
  ADD COLUMN IF NOT EXISTS ultima_origem jsonb,
  ADD COLUMN IF NOT EXISTS imoveis_vistos jsonb,
  ADD COLUMN IF NOT EXISTS pedido_site jsonb;

CREATE OR REPLACE FUNCTION public.midia_refresh_jornada(p_dias integer DEFAULT 400)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_cutoff timestamptz := now() - make_interval(days => p_dias); v_n integer;
begin
  delete from public.midia_lead_jornada where created_at >= v_cutoff;
  insert into public.midia_lead_jornada
  select j.*, now(),
    nullif(pl.dados_site->'jornada'->>'numero_visitas','')::integer,
    pl.dados_site->'jornada'->'primeira_origem',
    pl.dados_site->'jornada'->'ultima_origem',
    pl.dados_site->'jornada'->'imoveis_vistos',
    pl.dados_site->'jornada'->'pedido'
  from public.v_midia_lead_jornada j
  left join public.pipeline_leads pl on pl.id = j.lead_id
  where j.created_at >= v_cutoff;
  get diagnostics v_n = row_count;
  return v_n;
end $function$;

CREATE OR REPLACE FUNCTION public.site_evento_max(p jsonb)
 RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  select max((e->>'quando')::timestamptz)
  from jsonb_array_elements(case when jsonb_typeof(p->'jornada'->'site_events')='array' then p->'jornada'->'site_events' else '[]'::jsonb end) e
  where coalesce(e->>'is_bot','false') <> 'true'
    and coalesce(e->>'tipo','') not in ('imovel_visualizado','busca_realizada','whatsapp_click','galeria_aberta','formulario_enviado')
    and e->>'quando' ~ '^\d{4}-'
$$;

CREATE OR REPLACE FUNCTION public.trg_site_voltou_aviso()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare v_novo timestamptz; v_ant timestamptz; v_key text;
begin
  begin
    if NEW.corretor_id is null or NEW.dados_site is null then return NEW; end if;
    v_novo := public.site_evento_max(NEW.dados_site);
    v_ant := public.site_evento_max(OLD.dados_site);
    if v_novo is null or v_novo <= coalesce(v_ant, '-infinity') or v_novo <= NEW.created_at then return NEW; end if;
    v_key := 'site_voltou:' || NEW.id;
    if exists (select 1 from public.notifications where agrupamento_key = v_key and created_at > now() - interval '1 hour') then return NEW; end if;
    perform public.criar_notificacao(
      p_user_id => NEW.corretor_id, p_tipo => 'leads', p_categoria => 'site_voltou',
      p_titulo => 'Lead voltou ao site',
      p_mensagem => coalesce(NEW.nome,'Seu lead') || ' voltou ao site da Uhome. Veja a jornada na ficha.',
      p_dados => jsonb_build_object('lead_id', NEW.id, 'evento_em', v_novo),
      p_agrupamento_key => v_key || ':' || to_char(now(),'YYYYMMDDHH24MI'));
  exception when others then null;
  end;
  return NEW;
end $$;

DROP TRIGGER IF EXISTS site_voltou_aviso ON public.pipeline_leads;
CREATE TRIGGER site_voltou_aviso AFTER UPDATE OF dados_site ON public.pipeline_leads
  FOR EACH ROW WHEN (NEW.dados_site IS DISTINCT FROM OLD.dados_site)
  EXECUTE FUNCTION public.trg_site_voltou_aviso();