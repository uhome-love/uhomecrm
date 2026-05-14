create table if not exists public.network_telemetry (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  profile_role text,
  url text not null,
  method text,
  error_name text,
  error_message text,
  duration_ms integer,
  online boolean,
  connection_type text,
  user_agent text,
  origin_host text,
  retry_count integer not null default 0,
  cf_ray text,
  session_id text
);

create index if not exists idx_network_telemetry_created_at on public.network_telemetry (created_at desc);
create index if not exists idx_network_telemetry_origin_host on public.network_telemetry (origin_host);
create index if not exists idx_network_telemetry_method on public.network_telemetry (method);
create index if not exists idx_network_telemetry_error_name on public.network_telemetry (error_name);

alter table public.network_telemetry enable row level security;

drop policy if exists net_tel_insert on public.network_telemetry;
create policy net_tel_insert
  on public.network_telemetry
  for insert
  to authenticated
  with check (true);

drop policy if exists net_tel_select_admin on public.network_telemetry;
create policy net_tel_select_admin
  on public.network_telemetry
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.cleanup_old_network_telemetry()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.network_telemetry
   where created_at < now() - interval '30 days';
end;
$$;

create or replace function public.get_network_telemetry_summary(p_horas integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - (greatest(p_horas, 1) || ' hours')::interval;
  v_total bigint;
  v_by_method jsonb;
  v_by_error jsonb;
  v_by_host jsonb;
  v_by_conn jsonb;
  v_top_urls jsonb;
begin
  if v_uid is null or not public.has_role(v_uid, 'admin'::app_role) then
    raise exception 'forbidden';
  end if;

  perform public.cleanup_old_network_telemetry();

  select count(*) into v_total
    from public.network_telemetry where created_at >= v_since;

  select coalesce(jsonb_object_agg(method, c), '{}'::jsonb) into v_by_method
    from (select coalesce(method,'unknown') as method, count(*) c
            from public.network_telemetry where created_at >= v_since group by 1) s;

  select coalesce(jsonb_object_agg(error_name, c), '{}'::jsonb) into v_by_error
    from (select coalesce(error_name,'unknown') as error_name, count(*) c
            from public.network_telemetry where created_at >= v_since group by 1) s;

  select coalesce(jsonb_object_agg(origin_host, c), '{}'::jsonb) into v_by_host
    from (select coalesce(origin_host,'unknown') as origin_host, count(*) c
            from public.network_telemetry where created_at >= v_since group by 1) s;

  select coalesce(jsonb_object_agg(connection_type, c), '{}'::jsonb) into v_by_conn
    from (select coalesce(connection_type,'unknown') as connection_type, count(*) c
            from public.network_telemetry where created_at >= v_since group by 1) s;

  select coalesce(jsonb_agg(jsonb_build_object('url', url, 'count', c) order by c desc), '[]'::jsonb)
    into v_top_urls
    from (select url, count(*) c
            from public.network_telemetry where created_at >= v_since
            group by 1 order by c desc limit 5) s;

  return jsonb_build_object(
    'total_falhas', v_total,
    'por_method', v_by_method,
    'por_error_name', v_by_error,
    'por_origin_host', v_by_host,
    'por_connection_type', v_by_conn,
    'top_urls', v_top_urls,
    'janela_horas', p_horas,
    'desde', v_since
  );
end;
$$;

grant execute on function public.get_network_telemetry_summary(integer) to authenticated;