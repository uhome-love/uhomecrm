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
    v_key := 'site_voltou:' || NEW.id || ':';
    if exists (select 1 from public.notifications where agrupamento_key like v_key || '%' and created_at > now() - interval '1 hour') then return NEW; end if;
    perform public.criar_notificacao(
      p_user_id => NEW.corretor_id, p_tipo => 'leads', p_categoria => 'site_voltou',
      p_titulo => 'Lead voltou ao site',
      p_mensagem => coalesce(NEW.nome,'Seu lead') || ' voltou ao site da Uhome. Veja a jornada na ficha.',
      p_dados => jsonb_build_object('lead_id', NEW.id, 'evento_em', v_novo),
      p_agrupamento_key => v_key || to_char(now(),'YYYYMMDDHH24MI'));
  exception when others then null;
  end;
  return NEW;
end $$;