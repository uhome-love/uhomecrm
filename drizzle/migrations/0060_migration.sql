create or replace function public.natal_mural_vendas()
returns table(negocio_id uuid, data_assinatura date, empreendimento text, assinado_em timestamptz, corretores jsonb, equipe text)
language sql stable security definer set search_path=public as $$
  select n.id, n.data_assinatura,
    coalesce(e.nome, n.empreendimento, 'Imóvel'),
    coalesce(n.fase_changed_at, n.data_assinatura::timestamptz),
    (select jsonb_agg(jsonb_build_object('nome', p.nome, 'foto', coalesce(p.avatar_url, p.avatar_gamificado_url)) order by x.ord)
       from (select n.auth_user_id uid, 0 ord
             union select pp.corretor_parceiro_id, 1 from pipeline_parcerias pp
               where pp.pipeline_lead_id = n.pipeline_lead_id and pp.status='ativa' and pp.corretor_parceiro_id <> n.auth_user_id
             union select pp.corretor_principal_id, 1 from pipeline_parcerias pp
               where pp.pipeline_lead_id = n.pipeline_lead_id and pp.status='ativa' and pp.corretor_principal_id <> n.auth_user_id) x
       join profiles p on p.user_id = x.uid),
    (select 'Equipe ' || split_part(g.nome,' ',1) from profiles g where g.user_id = n.equipe_gerente_auth_id)
  from negocios n
  left join empreendimentos_canonicos e on e.id = n.empreendimento_canonico_id
  where auth.uid() is not null
    and n.fase in ('ganho','vendido') and n.distrato_em is null
    and n.data_assinatura between date '2026-11-01' and date '2026-12-18'
  order by n.data_assinatura desc, n.fase_changed_at desc nulls last
  limit 200;
$$;
revoke all on function public.natal_mural_vendas() from public, anon;
grant execute on function public.natal_mural_vendas() to authenticated;