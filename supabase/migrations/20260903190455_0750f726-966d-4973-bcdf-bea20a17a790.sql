-- Cron diário de reindexação do cérebro do HOMI (03:30 BRT = 06:30 UTC)
select cron.unschedule('homi-reindex-daily')
where exists (select 1 from cron.job where jobname = 'homi-reindex-daily');

select cron.schedule(
  'homi-reindex-daily',
  '30 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url' limit 1) || '/functions/v1/homi-reindex',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_role_key' limit 1)
    ),
    body := '{"sources":["metodo","material","academia","script","empreendimento","imovel"],"limit":400}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Status da base do HOMI (para o selo de "última atualização" no CRM)
create or replace function public.homi_base_status()
returns table (
  source_type text,
  docs bigint,
  chunks bigint,
  ultima_atualizacao timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    hd.source_type,
    count(*)::bigint as docs,
    coalesce(sum(hd.chunk_count), 0)::bigint as chunks,
    max(hd.updated_at) as ultima_atualizacao
  from public.homi_documents hd
  where hd.status in ('indexed', 'ready')
  group by hd.source_type
  order by hd.source_type;
$$;

grant execute on function public.homi_base_status() to authenticated, service_role;